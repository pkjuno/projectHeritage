const {
  request,
  app,
  resetDatabase,
  createUserAndLogin,
  createFestival,
  createPost,
  authHeader,
} = require('../helpers');
const Post = require('../../src/models/post.model');
const Notification = require('../../src/models/notification.model');

/**
 * 커뮤니티 대시보드 / 내 활동 / 알림 연동 통합 테스트.
 */
describe('커뮤니티 - 대시보드 / 내 활동 / 알림', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  /** N일 전 시각 */
  function daysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  describe('GET /api/community/dashboard', () => {
    it('비회원도 볼 수 있고 myActivity는 없다', async () => {
      const response = await request(app).get('/api/community/dashboard').expect(200);

      expect(response.body.data).toHaveProperty('trending');
      expect(response.body.data).toHaveProperty('latest');
      expect(response.body.data).toHaveProperty('categories');
      expect(response.body.data).toHaveProperty('festivalTalk');
      expect(response.body.data.myActivity).toBeNull();
    });

    it('글이 하나도 없어도 빈 배열로 응답한다', async () => {
      const response = await request(app).get('/api/community/dashboard').expect(200);

      expect(response.body.data.trending).toEqual([]);
      expect(response.body.data.latest).toEqual([]);
      // 글이 없어도 게시판 목록은 나와야 한다. 화면에서 게시판이 사라지면 안 된다.
      expect(response.body.data.categories).toHaveLength(5);
      expect(response.body.data.categories[0].postCount).toBe(0);
    });

    it('인기글은 반응/댓글/조회 가중치 순으로 정렬된다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id, title: '조회만 많음', viewCount: 200 });
      await createPost({ userId: user.id, title: '반응 많음', reactionCount: 10 });
      await createPost({ userId: user.id, title: '댓글 많음', commentCount: 12 });

      const response = await request(app).get('/api/community/dashboard').expect(200);

      // 반응 10개(x3=30) > 댓글 12개(x2=24) > 조회 200회(x0.1=20)
      expect(response.body.data.trending.map((p) => p.title)).toEqual([
        '반응 많음',
        '댓글 많음',
        '조회만 많음',
      ]);
    });

    it('7일이 지난 글은 아무리 반응이 많아도 인기글에서 빠진다', async () => {
      const { user } = await createUserAndLogin();
      const old = await createPost({ userId: user.id, title: '옛날 인기글', reactionCount: 999 });
      await createPost({ userId: user.id, title: '최근 글', reactionCount: 1 });

      // createdAt은 모델이 자동으로 채우므로 직접 과거로 돌린다.
      await Post.update({ createdAt: daysAgo(10) }, { where: { id: old.id }, silent: true });

      const response = await request(app).get('/api/community/dashboard').expect(200);

      // 한 달 전 글이 계속 상단에 남아 있으면 커뮤니티가 죽은 것처럼 보인다.
      expect(response.body.data.trending.map((p) => p.title)).toEqual(['최근 글']);
      // 최신글 목록에는 여전히 남아 있어야 한다. (기간 제한은 인기글에만 적용)
      expect(response.body.data.latest.map((p) => p.title)).toContain('옛날 인기글');
    });

    it('숨김/삭제된 글은 대시보드에 나오지 않는다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id, title: '정상', reactionCount: 1 });
      await createPost({ userId: user.id, title: '숨김', status: 'hidden', reactionCount: 99 });
      await createPost({ userId: user.id, title: '삭제', status: 'deleted', reactionCount: 99 });

      const response = await request(app).get('/api/community/dashboard').expect(200);

      expect(response.body.data.trending.map((p) => p.title)).toEqual(['정상']);
      expect(response.body.data.latest.map((p) => p.title)).toEqual(['정상']);
    });

    it('대시보드 응답에도 작성자 민감정보가 없다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id });

      const response = await request(app).get('/api/community/dashboard').expect(200);

      expect(response.body.data.latest[0].author).not.toHaveProperty('password');
      expect(response.body.data.latest[0].author).not.toHaveProperty('refreshToken');
    });

    it('요약이라 본문은 싣지 않는다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id, content: '아주 긴 본문'.repeat(500) });

      const response = await request(app).get('/api/community/dashboard').expect(200);

      // 대시보드에 본문을 실으면 첫 화면 응답이 불필요하게 커진다.
      expect(response.body.data.latest[0]).not.toHaveProperty('content');
    });

    describe('게시판 요약', () => {
      it('게시판별 전체 글 수와 오늘 글 수를 센다', async () => {
        const { user } = await createUserAndLogin();
        const yesterdayPost = await createPost({ userId: user.id, categoryCode: 'free' });
        await createPost({ userId: user.id, categoryCode: 'free' });
        await createPost({ userId: user.id, categoryCode: 'question' });

        await Post.update(
          { createdAt: daysAgo(1) },
          { where: { id: yesterdayPost.id }, silent: true }
        );

        const response = await request(app).get('/api/community/dashboard').expect(200);
        const byCode = Object.fromEntries(
          response.body.data.categories.map((c) => [c.code, c])
        );

        expect(byCode.free.postCount).toBe(2);
        expect(byCode.free.todayCount).toBe(1);
        expect(byCode.question.postCount).toBe(1);
        expect(byCode.notice.postCount).toBe(0);
      });
    });

    describe('축제 이야기', () => {
      it('진행 중인 축제를 글이 많은 순으로 보여준다', async () => {
        const { user } = await createUserAndLogin();
        const today = new Date().toISOString().slice(0, 10);

        const busy = await createFestival({
          name: '이야기 많은 축제',
          startDate: today,
          endDate: today,
        });
        const quiet = await createFestival({
          name: '조용한 축제',
          startDate: today,
          endDate: today,
        });

        await createPost({ userId: user.id, festivalId: busy.id });
        await createPost({ userId: user.id, festivalId: busy.id });
        await createPost({ userId: user.id, festivalId: quiet.id });

        const response = await request(app).get('/api/community/dashboard').expect(200);

        expect(response.body.data.festivalTalk).toHaveLength(2);
        expect(response.body.data.festivalTalk[0].festival.name).toBe('이야기 많은 축제');
        expect(response.body.data.festivalTalk[0].postCount).toBe(2);
      });

      it('이미 끝난 축제는 빠진다', async () => {
        const { user } = await createUserAndLogin();
        const ended = await createFestival({
          name: '끝난 축제',
          startDate: '2020-01-01',
          endDate: '2020-01-03',
        });

        await createPost({ userId: user.id, festivalId: ended.id });

        const response = await request(app).get('/api/community/dashboard').expect(200);

        // 끝난 축제의 후기가 상단에 남아 있으면 "지금 뭐가 열리는지"를 알 수 없다.
        expect(response.body.data.festivalTalk).toEqual([]);
      });

      it('축제에 연결되지 않은 글은 세지 않는다', async () => {
        const { user } = await createUserAndLogin();
        await createPost({ userId: user.id });

        const response = await request(app).get('/api/community/dashboard').expect(200);
        expect(response.body.data.festivalTalk).toEqual([]);
      });
    });

    describe('내 활동 요약', () => {
      it('로그인하면 내 글/댓글 수와 받은 반응 수가 나온다', async () => {
        const me = await createUserAndLogin();
        const other = await createUserAndLogin();
        const myPost = await createPost({ userId: me.user.id });

        await request(app)
          .post(`/api/community/posts/${myPost.id}/comments`)
          .set(authHeader(me.token))
          .send({ content: '내 댓글' });
        await request(app)
          .put(`/api/community/posts/${myPost.id}/reaction`)
          .set(authHeader(other.token))
          .send({ type: 'like' });

        const response = await request(app)
          .get('/api/community/dashboard')
          .set(authHeader(me.token))
          .expect(200);

        expect(response.body.data.myActivity).toEqual({
          postCount: 1,
          commentCount: 1,
          receivedReactionCount: 1,
        });
      });

      it('내가 내 글에 남긴 반응은 "받은 반응"이 아니다', async () => {
        const me = await createUserAndLogin();
        const myPost = await createPost({ userId: me.user.id });

        await request(app)
          .put(`/api/community/posts/${myPost.id}/reaction`)
          .set(authHeader(me.token))
          .send({ type: 'like' });

        const response = await request(app)
          .get('/api/community/dashboard')
          .set(authHeader(me.token))
          .expect(200);

        // 자기 글에 스스로 좋아요를 눌러 숫자를 올릴 수 있으면 의미 없는 지표가 된다.
        expect(response.body.data.myActivity.receivedReactionCount).toBe(0);
      });

      it('남의 글이 받은 반응은 내 숫자가 아니다', async () => {
        const me = await createUserAndLogin();
        const other = await createUserAndLogin();
        const othersPost = await createPost({ userId: other.user.id });

        await request(app)
          .put(`/api/community/posts/${othersPost.id}/reaction`)
          .set(authHeader(me.token))
          .send({ type: 'like' });

        const response = await request(app)
          .get('/api/community/dashboard')
          .set(authHeader(me.token))
          .expect(200);

        expect(response.body.data.myActivity.receivedReactionCount).toBe(0);
      });
    });
  });

  describe('내 활동 목록', () => {
    it('내가 쓴 글만 나온다', async () => {
      const me = await createUserAndLogin();
      const other = await createUserAndLogin();
      await createPost({ userId: me.user.id, title: '내 글' });
      await createPost({ userId: other.user.id, title: '남의 글' });

      const response = await request(app)
        .get('/api/community/me/posts')
        .set(authHeader(me.token))
        .expect(200);

      expect(response.body.data.items.map((p) => p.title)).toEqual(['내 글']);
    });

    it('내가 지운 글은 "내 글"에서 빠지고, 숨겨진 글은 남는다', async () => {
      const me = await createUserAndLogin();
      await createPost({ userId: me.user.id, title: '정상' });
      await createPost({ userId: me.user.id, title: '숨겨진 글', status: 'hidden' });
      await createPost({ userId: me.user.id, title: '지운 글', status: 'deleted' });

      const response = await request(app)
        .get('/api/community/me/posts')
        .set(authHeader(me.token))
        .expect(200);

      // 내가 지운 글이 목록에 계속 남아 있으면 지운 것이 아니다.
      // 숨겨진 글은 왜 숨겨졌는지 확인할 방법이 있어야 하므로 남긴다.
      const titles = response.body.data.items.map((p) => p.title);
      expect(titles).toContain('정상');
      expect(titles).toContain('숨겨진 글');
      expect(titles).not.toContain('지운 글');
    });

    it('내 댓글에는 원글 정보가 함께 온다', async () => {
      const me = await createUserAndLogin();
      const other = await createUserAndLogin();
      const post = await createPost({ userId: other.user.id, title: '원글 제목' });

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(me.token))
        .send({ content: '내 댓글' });

      const response = await request(app)
        .get('/api/community/me/comments')
        .set(authHeader(me.token))
        .expect(200);

      // 댓글만 보여주면 무슨 글에 단 댓글인지 알 수 없다.
      expect(response.body.data.items[0].content).toBe('내 댓글');
      expect(response.body.data.items[0].post.title).toBe('원글 제목');
    });

    it('원글이 삭제된 댓글은 목록에서 빠진다', async () => {
      const me = await createUserAndLogin();
      const other = await createUserAndLogin();
      const post = await createPost({ userId: other.user.id });

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(me.token))
        .send({ content: '댓글' });

      await post.update({ status: 'deleted' });

      // 눌러도 갈 곳이 없는 댓글을 목록에 남길 이유가 없다.
      const response = await request(app)
        .get('/api/community/me/comments')
        .set(authHeader(me.token))
        .expect(200);

      expect(response.body.data.items).toHaveLength(0);
    });

    it('내가 반응한 글에는 어떤 반응인지가 함께 온다', async () => {
      const me = await createUserAndLogin();
      const other = await createUserAndLogin();
      const post = await createPost({ userId: other.user.id, title: '반응한 글' });

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(me.token))
        .send({ type: 'wow' });

      const response = await request(app)
        .get('/api/community/me/reactions')
        .set(authHeader(me.token))
        .expect(200);

      expect(response.body.data.items[0].type).toBe('wow');
      expect(response.body.data.items[0].post.title).toBe('반응한 글');
    });

    it('비회원은 내 활동을 볼 수 없다', async () => {
      for (const path of ['me/posts', 'me/comments', 'me/reactions']) {
        await request(app).get(`/api/community/${path}`).expect(401);
      }
    });
  });

  describe('커뮤니티 알림', () => {
    it('내 글에 댓글이 달리면 알림이 온다', async () => {
      const author = await createUserAndLogin();
      const commenter = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id, title: '알림 테스트 글' });

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '댓글' })
        .expect(201);

      const notifications = await Notification.findAll({ where: { userId: author.user.id } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('post_comment');
      // 알림을 눌렀을 때 갈 곳이 있어야 한다.
      expect(notifications[0].postId).toBe(post.id);
    });

    it('내 글에 내가 댓글을 달면 알림이 오지 않는다', async () => {
      const author = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(author.token))
        .send({ content: '자문자답' })
        .expect(201);

      expect(await Notification.count({ where: { userId: author.user.id } })).toBe(0);
    });

    it('내 댓글에 답글이 달리면 답글 알림이 온다', async () => {
      const author = await createUserAndLogin();
      const commenter = await createUserAndLogin();
      const replier = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      const parent = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '부모 댓글' });

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(replier.token))
        .send({ content: '답글', parentId: parent.body.data.id })
        .expect(201);

      const toCommenter = await Notification.findAll({ where: { userId: commenter.user.id } });
      expect(toCommenter).toHaveLength(1);
      expect(toCommenter[0].type).toBe('comment_reply');
    });

    it('글쓴이와 댓글쓴이가 같으면 알림이 두 번 가지 않는다', async () => {
      const author = await createUserAndLogin();
      const replier = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      // 글쓴이가 자기 글에 댓글을 달고, 다른 사람이 거기에 답글을 단다.
      const parent = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(author.token))
        .send({ content: '내 글에 내 댓글' });

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(replier.token))
        .send({ content: '답글', parentId: parent.body.data.id })
        .expect(201);

      // 같은 사건으로 "댓글 알림"과 "답글 알림"이 둘 다 가면 안 된다.
      const notifications = await Notification.findAll({ where: { userId: author.user.id } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('comment_reply');
    });

    it('반응 알림은 하루에 한 건으로 묶이고 개수가 갱신된다', async () => {
      const author = await createUserAndLogin();
      const a = await createUserAndLogin();
      const b = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(a.token))
        .send({ type: 'like' });

      let notifications = await Notification.findAll({ where: { userId: author.user.id } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].body).toContain('반응 1개');

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(b.token))
        .send({ type: 'love' });

      // 건건이 알리면 인기 글은 하루에 수십 번 울린다. 하루 한 건으로 묶는다.
      notifications = await Notification.findAll({ where: { userId: author.user.id } });
      expect(notifications).toHaveLength(1);
      // 그렇다고 "1개"에서 멈춰 있으면 안 된다.
      expect(notifications[0].body).toContain('반응 2개');
    });

    it('반응 종류만 바꾸면 알림이 다시 가지 않는다', async () => {
      const author = await createUserAndLogin();
      const reactor = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .send({ type: 'like' });
      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .send({ type: 'sad' });

      const notifications = await Notification.findAll({ where: { userId: author.user.id } });
      expect(notifications).toHaveLength(1);
      // 이모지를 바꿀 때마다 반응 수가 올라간 것처럼 보이면 안 된다.
      expect(notifications[0].body).toContain('반응 1개');
    });

    it('내 글에 내가 반응하면 알림이 오지 않는다', async () => {
      const author = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(author.token))
        .send({ type: 'like' });

      expect(await Notification.count({ where: { userId: author.user.id } })).toBe(0);
    });

    it('알림함에 게시글 정보가 함께 내려온다', async () => {
      const author = await createUserAndLogin();
      const commenter = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id, title: '알림함 확인' });

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '댓글' });

      const response = await request(app)
        .get('/api/users/me/notifications')
        .set(authHeader(author.token))
        .expect(200);

      // 앱이 축제 상세로 갈지 게시글 상세로 갈지 판단할 수 있어야 한다.
      expect(response.body.data.items[0].post.title).toBe('알림함 확인');
      expect(response.body.data.items[0].festival).toBeNull();
    });
  });
});
