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
const PostView = require('../../src/models/postView.model');

/**
 * 커뮤니티 게시글 CRUD 통합 테스트.
 *
 * 특히 신경 쓴 부분:
 *  - 권한: 남의 글을 고치거나 지울 수 없어야 한다. 운영자도 "수정"은 못 한다.
 *  - 조회수: 새로고침으로 부풀지 않아야 한다.
 *  - 삭제: 행이 사라지지 않고 상태만 바뀌어야 한다.
 */
describe('커뮤니티 - 게시글', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('GET /api/community/categories', () => {
    it('게시판 목록을 노출 순서대로 내려준다', async () => {
      const response = await request(app).get('/api/community/categories').expect(200);

      const codes = response.body.data.map((category) => category.code);
      expect(codes).toEqual(['notice', 'free', 'review', 'companion', 'question']);
    });

    it('게시판별 작성 정책을 함께 내려준다', async () => {
      const response = await request(app).get('/api/community/categories').expect(200);

      const notice = response.body.data.find((category) => category.code === 'notice');
      const review = response.body.data.find((category) => category.code === 'review');

      // 공지는 운영자만, 후기는 축제 연결이 필수라는 것을 앱이 미리 알아야
      // 글쓰기 버튼과 입력 폼을 그에 맞게 그릴 수 있다.
      expect(notice.writeRole).toBe('admin');
      expect(review.requireFestival).toBe(true);
    });
  });

  describe('POST /api/community/posts (작성)', () => {
    it('로그인한 회원은 자유게시판에 글을 쓸 수 있다', async () => {
      const { token } = await createUserAndLogin();

      const response = await request(app)
        .post('/api/community/posts')
        .set(authHeader(token))
        .send({ category: 'free', title: '첫 글입니다', content: '반갑습니다.' })
        .expect(201);

      expect(response.body.data.title).toBe('첫 글입니다');
      expect(response.body.data.category.code).toBe('free');
      expect(response.body.data.author.id).toBeDefined();
      expect(response.body.data.isMine).toBe(true);
    });

    it('작성자 정보에 비밀번호나 토큰이 섞여 나가지 않는다', async () => {
      const { token } = await createUserAndLogin();

      const response = await request(app)
        .post('/api/community/posts')
        .set(authHeader(token))
        .send({ category: 'free', title: '민감정보 확인', content: '본문' })
        .expect(201);

      // include에 attributes를 지정하지 않으면 해시된 비밀번호와 refreshToken까지 실려 나간다.
      expect(response.body.data.author).not.toHaveProperty('password');
      expect(response.body.data.author).not.toHaveProperty('refreshToken');
      expect(response.body.data.author).not.toHaveProperty('email');
    });

    it('비회원은 글을 쓸 수 없다', async () => {
      await request(app)
        .post('/api/community/posts')
        .send({ category: 'free', title: '비회원 글', content: '본문' })
        .expect(401);
    });

    it('공지사항은 일반 회원이 쓸 수 없다', async () => {
      const { token } = await createUserAndLogin();

      const response = await request(app)
        .post('/api/community/posts')
        .set(authHeader(token))
        .send({ category: 'notice', title: '가짜 공지', content: '본문' })
        .expect(403);

      expect(response.body.message).toContain('운영자');
    });

    it('공지사항은 운영자가 쓸 수 있다', async () => {
      const { token } = await createUserAndLogin({ role: 'admin' });

      await request(app)
        .post('/api/community/posts')
        .set(authHeader(token))
        .send({ category: 'notice', title: '점검 안내', content: '본문' })
        .expect(201);
    });

    it('축제 후기는 축제를 선택해야 쓸 수 있다', async () => {
      const { token } = await createUserAndLogin();

      const response = await request(app)
        .post('/api/community/posts')
        .set(authHeader(token))
        .send({ category: 'review', title: '후기입니다', content: '재밌었어요' })
        .expect(400);

      expect(response.body.message).toContain('축제를 선택');
    });

    it('축제를 연결하면 후기를 쓸 수 있다', async () => {
      const { token } = await createUserAndLogin();
      const festival = await createFestival();

      const response = await request(app)
        .post('/api/community/posts')
        .set(authHeader(token))
        .send({
          category: 'review',
          title: '후기입니다',
          content: '재밌었어요',
          festivalId: festival.id,
        })
        .expect(201);

      expect(response.body.data.festival.id).toBe(festival.id);
    });

    it('없는 축제를 연결하면 404', async () => {
      const { token } = await createUserAndLogin();

      await request(app)
        .post('/api/community/posts')
        .set(authHeader(token))
        .send({ category: 'review', title: '후기', content: '본문', festivalId: 999999 })
        .expect(404);
    });

    it('없는 게시판이면 404', async () => {
      const { token } = await createUserAndLogin();

      await request(app)
        .post('/api/community/posts')
        .set(authHeader(token))
        .send({ category: 'nope', title: '제목', content: '본문' })
        .expect(404);
    });

    it('제목이 너무 짧거나 비어 있으면 400', async () => {
      const { token } = await createUserAndLogin();

      for (const title of ['', ' ', 'a']) {
        await request(app)
          .post('/api/community/posts')
          .set(authHeader(token))
          .send({ category: 'free', title, content: '본문' })
          .expect(400);
      }
    });

    it('공백만 있는 본문은 400', async () => {
      const { token } = await createUserAndLogin();

      // trim 없이 length만 재면 공백 문자열이 통과해 버린다.
      await request(app)
        .post('/api/community/posts')
        .set(authHeader(token))
        .send({ category: 'free', title: '제목입니다', content: '     ' })
        .expect(400);
    });

    it('제목 앞뒤 공백은 제거하고 저장한다', async () => {
      const { token } = await createUserAndLogin();

      const response = await request(app)
        .post('/api/community/posts')
        .set(authHeader(token))
        .send({ category: 'free', title: '  공백 제거  ', content: '본문' })
        .expect(201);

      expect(response.body.data.title).toBe('공백 제거');
    });
  });

  describe('GET /api/community/posts (목록)', () => {
    it('비회원도 목록을 볼 수 있다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id });

      const response = await request(app).get('/api/community/posts').expect(200);
      expect(response.body.data.total).toBe(1);
    });

    it('게시판 코드로 필터링한다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id, categoryCode: 'free', title: '자유글' });
      await createPost({ userId: user.id, categoryCode: 'question', title: '질문글' });

      const response = await request(app)
        .get('/api/community/posts')
        .query({ category: 'question' })
        .expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].title).toBe('질문글');
    });

    it('축제 ID로 필터링한다 (축제 상세의 "이 축제 후기")', async () => {
      const { user } = await createUserAndLogin();
      const festival = await createFestival();
      await createPost({ userId: user.id, title: '연결된 글', festivalId: festival.id });
      await createPost({ userId: user.id, title: '자유 글' });

      const response = await request(app)
        .get('/api/community/posts')
        .query({ festivalId: festival.id })
        .expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].title).toBe('연결된 글');
    });

    it('제목과 본문 모두에서 키워드를 찾는다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id, title: '불꽃축제 후기', content: '내용' });
      await createPost({ userId: user.id, title: '아무 글', content: '불꽃이 예뻤다' });
      await createPost({ userId: user.id, title: '관계없는 글', content: '내용' });

      const response = await request(app)
        .get('/api/community/posts')
        .query({ keyword: '불꽃' })
        .expect(200);

      expect(response.body.data.total).toBe(2);
    });

    it('목록에는 본문 대신 앞부분만 잘린 미리보기가 온다', async () => {
      const { user } = await createUserAndLogin();
      const longBody = '가'.repeat(500);
      await createPost({ userId: user.id, content: longBody });

      const response = await request(app).get('/api/community/posts').expect(200);
      const item = response.body.data.items[0];

      // 본문 전체를 실으면 20개짜리 한 페이지가 수백 KB가 된다.
      expect(item.content).toBeUndefined();
      expect(item.preview).toHaveLength(150);
      expect(longBody.startsWith(item.preview)).toBe(true);
    });

    it('짧은 본문은 그대로 미리보기가 된다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id, content: '짧은 본문' });

      const response = await request(app).get('/api/community/posts').expect(200);
      expect(response.body.data.items[0].preview).toBe('짧은 본문');
    });

    it('상세에는 잘리지 않은 본문이 온다', async () => {
      const { user } = await createUserAndLogin();
      const longBody = '나'.repeat(500);
      const post = await createPost({ userId: user.id, content: longBody });

      const response = await request(app)
        .get(`/api/community/posts/${post.id}`)
        .expect(200);

      expect(response.body.data.content).toBe(longBody);
    });

    it('숨김/삭제된 글은 목록에 나오지 않는다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id, title: '정상 글' });
      await createPost({ userId: user.id, title: '숨긴 글', status: 'hidden' });
      await createPost({ userId: user.id, title: '지운 글', status: 'deleted' });

      const response = await request(app).get('/api/community/posts').expect(200);

      expect(response.body.data.total).toBe(1);
      expect(response.body.data.items[0].title).toBe('정상 글');
    });

    it('고정 글은 최신 글보다 위에 온다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id, title: '고정 글', isPinned: true });
      await createPost({ userId: user.id, title: '나중에 쓴 글' });

      const response = await request(app).get('/api/community/posts').expect(200);

      expect(response.body.data.items[0].title).toBe('고정 글');
    });

    it('인기순 정렬은 반응이 많은 글을 먼저 보여준다', async () => {
      const { user } = await createUserAndLogin();
      await createPost({ userId: user.id, title: '조회만 많은 글', viewCount: 100 });
      await createPost({ userId: user.id, title: '반응이 많은 글', reactionCount: 5 });

      const response = await request(app)
        .get('/api/community/posts')
        .query({ sort: 'popular' })
        .expect(200);

      // 반응 5개(x3=15)가 조회 100회(x0.1=10)보다 높게 평가되어야 한다.
      expect(response.body.data.items[0].title).toBe('반응이 많은 글');
    });

    it('로그인하면 내 글에 isMine 플래그가 붙는다', async () => {
      const mine = await createUserAndLogin();
      const other = await createUserAndLogin();
      await createPost({ userId: mine.user.id, title: '내 글' });
      await createPost({ userId: other.user.id, title: '남의 글' });

      const response = await request(app)
        .get('/api/community/posts')
        .set(authHeader(mine.token))
        .expect(200);

      const byTitle = Object.fromEntries(
        response.body.data.items.map((post) => [post.title, post.isMine])
      );
      expect(byTitle['내 글']).toBe(true);
      expect(byTitle['남의 글']).toBe(false);
    });
  });

  describe('GET /api/community/posts/:id (상세)', () => {
    it('없는 글은 404', async () => {
      await request(app).get('/api/community/posts/999999').expect(404);
    });

    it('삭제된 글은 작성자에게도 404', async () => {
      const { user, token } = await createUserAndLogin();
      const post = await createPost({ userId: user.id, status: 'deleted' });

      await request(app)
        .get(`/api/community/posts/${post.id}`)
        .set(authHeader(token))
        .expect(404);
    });

    it('숨김 처리된 글은 남에게 404, 작성자에게는 보인다', async () => {
      const author = await createUserAndLogin();
      const other = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id, status: 'hidden' });

      // 작성자에게까지 404를 주면 자기 글이 왜 사라졌는지 알 방법이 없다.
      await request(app)
        .get(`/api/community/posts/${post.id}`)
        .set(authHeader(author.token))
        .expect(200);

      await request(app)
        .get(`/api/community/posts/${post.id}`)
        .set(authHeader(other.token))
        .expect(404);

      await request(app).get(`/api/community/posts/${post.id}`).expect(404);
    });

    it('숨김 처리된 글은 운영자에게 보인다', async () => {
      const author = await createUserAndLogin();
      const admin = await createUserAndLogin({ role: 'admin' });
      const post = await createPost({ userId: author.user.id, status: 'hidden' });

      await request(app)
        .get(`/api/community/posts/${post.id}`)
        .set(authHeader(admin.token))
        .expect(200);
    });
  });

  describe('조회수 집계', () => {
    it('다른 회원이 읽으면 조회수가 올라간다', async () => {
      const author = await createUserAndLogin();
      const reader = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      const response = await request(app)
        .get(`/api/community/posts/${post.id}`)
        .set(authHeader(reader.token))
        .expect(200);

      // 응답에도 방금 올린 값이 반영되어야 한다. (재조회 없이 맞춰주는 부분)
      expect(response.body.data.viewCount).toBe(1);
      await post.reload();
      expect(post.viewCount).toBe(1);
    });

    it('같은 사람이 여러 번 읽어도 하루에 한 번만 센다', async () => {
      const author = await createUserAndLogin();
      const reader = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      for (let i = 0; i < 3; i += 1) {
        await request(app)
          .get(`/api/community/posts/${post.id}`)
          .set(authHeader(reader.token))
          .expect(200);
      }

      await post.reload();
      expect(post.viewCount).toBe(1);
      // 로그도 하나만 남아야 한다. (유니크 인덱스가 실제로 걸려 있는지 확인)
      expect(await PostView.count({ where: { postId: post.id } })).toBe(1);
    });

    it('작성자 본인이 읽으면 세지 않는다', async () => {
      const author = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      await request(app)
        .get(`/api/community/posts/${post.id}`)
        .set(authHeader(author.token))
        .expect(200);

      await post.reload();
      expect(post.viewCount).toBe(0);
    });

    it('서로 다른 회원의 조회는 각각 센다', async () => {
      const author = await createUserAndLogin();
      const readerA = await createUserAndLogin();
      const readerB = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      await request(app)
        .get(`/api/community/posts/${post.id}`)
        .set(authHeader(readerA.token))
        .expect(200);
      await request(app)
        .get(`/api/community/posts/${post.id}`)
        .set(authHeader(readerB.token))
        .expect(200);

      await post.reload();
      expect(post.viewCount).toBe(2);
    });

    it('비회원 조회도 집계된다', async () => {
      const author = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      await request(app).get(`/api/community/posts/${post.id}`).expect(200);

      await post.reload();
      expect(post.viewCount).toBe(1);

      // 비로그인 방문자는 IP 해시로 식별한다. IP 원문이 저장되면 안 된다.
      const view = await PostView.findOne({ where: { postId: post.id } });
      expect(view.viewerKey).toMatch(/^a:[0-9a-f]{32}$/);
    });

    it('숨김 처리된 글은 조회수를 세지 않는다', async () => {
      const author = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id, status: 'hidden' });

      await request(app)
        .get(`/api/community/posts/${post.id}`)
        .set(authHeader(author.token))
        .expect(200);

      await post.reload();
      expect(post.viewCount).toBe(0);
    });
  });

  describe('PUT /api/community/posts/:id (수정)', () => {
    it('작성자는 자기 글을 수정할 수 있다', async () => {
      const { user, token } = await createUserAndLogin();
      const post = await createPost({ userId: user.id });

      const response = await request(app)
        .put(`/api/community/posts/${post.id}`)
        .set(authHeader(token))
        .send({ title: '고친 제목', content: '고친 본문' })
        .expect(200);

      expect(response.body.data.title).toBe('고친 제목');
      expect(response.body.data.content).toBe('고친 본문');
    });

    it('제목만 보내도 수정된다', async () => {
      const { user, token } = await createUserAndLogin();
      const post = await createPost({ userId: user.id, content: '원래 본문' });

      const response = await request(app)
        .put(`/api/community/posts/${post.id}`)
        .set(authHeader(token))
        .send({ title: '제목만 변경' })
        .expect(200);

      expect(response.body.data.content).toBe('원래 본문');
    });

    it('남의 글은 수정할 수 없다', async () => {
      const author = await createUserAndLogin();
      const other = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      await request(app)
        .put(`/api/community/posts/${post.id}`)
        .set(authHeader(other.token))
        .send({ title: '몰래 수정' })
        .expect(403);
    });

    it('운영자도 남의 글은 수정할 수 없다', async () => {
      const author = await createUserAndLogin();
      const admin = await createUserAndLogin({ role: 'admin' });
      const post = await createPost({ userId: author.user.id });

      // 운영자가 남의 글 내용을 바꿀 수 있다는 것 자체가 사고 원인이다.
      // 문제가 있는 글은 고치는 게 아니라 숨긴다.
      await request(app)
        .put(`/api/community/posts/${post.id}`)
        .set(authHeader(admin.token))
        .send({ title: '운영자가 고침' })
        .expect(403);
    });

    it('숨김 처리된 글은 수정할 수 없다', async () => {
      const { user, token } = await createUserAndLogin();
      const post = await createPost({ userId: user.id, status: 'hidden' });

      // 수정으로 상태를 되돌리는 우회를 막는다.
      await request(app)
        .put(`/api/community/posts/${post.id}`)
        .set(authHeader(token))
        .send({ title: '되살리기' })
        .expect(403);
    });

    it('수정할 항목이 없으면 400', async () => {
      const { user, token } = await createUserAndLogin();
      const post = await createPost({ userId: user.id });

      await request(app)
        .put(`/api/community/posts/${post.id}`)
        .set(authHeader(token))
        .send({})
        .expect(400);
    });

    it('후기 글의 축제 연결은 해제할 수 없다', async () => {
      const { user, token } = await createUserAndLogin();
      const festival = await createFestival();
      const post = await createPost({
        userId: user.id,
        categoryCode: 'review',
        festivalId: festival.id,
      });

      // 후기 게시판은 축제 연결이 필수이므로 수정으로도 빠져나갈 수 없어야 한다.
      await request(app)
        .put(`/api/community/posts/${post.id}`)
        .set(authHeader(token))
        .send({ festivalId: null })
        .expect(400);
    });
  });

  describe('DELETE /api/community/posts/:id (삭제)', () => {
    it('작성자는 자기 글을 삭제할 수 있고, 행은 남는다', async () => {
      const { user, token } = await createUserAndLogin();
      const post = await createPost({ userId: user.id });

      await request(app)
        .delete(`/api/community/posts/${post.id}`)
        .set(authHeader(token))
        .expect(200);

      // 물리 삭제하면 신고 이력과 통계가 함께 사라진다. 행은 남고 상태만 바뀐다.
      const stored = await Post.findByPk(post.id);
      expect(stored).not.toBeNull();
      expect(stored.status).toBe('deleted');
      expect(stored.deletedAt).not.toBeNull();
    });

    it('운영자는 남의 글을 삭제할 수 있다', async () => {
      const author = await createUserAndLogin();
      const admin = await createUserAndLogin({ role: 'admin' });
      const post = await createPost({ userId: author.user.id });

      await request(app)
        .delete(`/api/community/posts/${post.id}`)
        .set(authHeader(admin.token))
        .expect(200);
    });

    it('일반 회원은 남의 글을 삭제할 수 없다', async () => {
      const author = await createUserAndLogin();
      const other = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id });

      await request(app)
        .delete(`/api/community/posts/${post.id}`)
        .set(authHeader(other.token))
        .expect(403);
    });

    it('이미 삭제된 글을 또 삭제하면 404', async () => {
      const { user, token } = await createUserAndLogin();
      const post = await createPost({ userId: user.id, status: 'deleted' });

      await request(app)
        .delete(`/api/community/posts/${post.id}`)
        .set(authHeader(token))
        .expect(404);
    });
  });

  describe('운영자 기능 (고정 / 숨김)', () => {
    it('운영자는 글을 상단에 고정하고 해제할 수 있다', async () => {
      const author = await createUserAndLogin();
      const admin = await createUserAndLogin({ role: 'admin' });
      const post = await createPost({ userId: author.user.id });

      const pinned = await request(app)
        .patch(`/api/community/posts/${post.id}/pin`)
        .set(authHeader(admin.token))
        .send({ isPinned: true })
        .expect(200);
      expect(pinned.body.data.isPinned).toBe(true);

      const unpinned = await request(app)
        .patch(`/api/community/posts/${post.id}/pin`)
        .set(authHeader(admin.token))
        .send({ isPinned: false })
        .expect(200);
      expect(unpinned.body.data.isPinned).toBe(false);
    });

    it('일반 회원은 고정할 수 없다', async () => {
      const { user, token } = await createUserAndLogin();
      const post = await createPost({ userId: user.id });

      await request(app)
        .patch(`/api/community/posts/${post.id}/pin`)
        .set(authHeader(token))
        .send({ isPinned: true })
        .expect(403);
    });

    it('운영자는 글을 숨기고 다시 공개할 수 있다', async () => {
      const author = await createUserAndLogin();
      const admin = await createUserAndLogin({ role: 'admin' });
      const post = await createPost({ userId: author.user.id });

      await request(app)
        .patch(`/api/community/posts/${post.id}/hide`)
        .set(authHeader(admin.token))
        .send({ hidden: true })
        .expect(200);

      // 숨긴 글은 목록에서 빠진다.
      const hiddenList = await request(app).get('/api/community/posts').expect(200);
      expect(hiddenList.body.data.total).toBe(0);

      await request(app)
        .patch(`/api/community/posts/${post.id}/hide`)
        .set(authHeader(admin.token))
        .send({ hidden: false })
        .expect(200);

      const shownList = await request(app).get('/api/community/posts').expect(200);
      expect(shownList.body.data.total).toBe(1);
    });

    it('작성자가 지운 글은 운영자가 숨김 해제로 되살릴 수 없다', async () => {
      const author = await createUserAndLogin();
      const admin = await createUserAndLogin({ role: 'admin' });
      const post = await createPost({ userId: author.user.id, status: 'deleted' });

      await request(app)
        .patch(`/api/community/posts/${post.id}/hide`)
        .set(authHeader(admin.token))
        .send({ hidden: false })
        .expect(404);
    });
  });
});
