const {
  request,
  app,
  resetDatabase,
  createUserAndLogin,
  createPost,
  authHeader,
} = require('../helpers');
const Post = require('../../src/models/post.model');
const PostComment = require('../../src/models/postComment.model');
const PostReaction = require('../../src/models/postReaction.model');
const PostShare = require('../../src/models/postShare.model');

/**
 * 커뮤니티 부가기능(댓글/대댓글/반응/공유) 통합 테스트.
 *
 * 가장 중요한 것은 **비정규화 카운터의 정합성**이다.
 * 카운터를 저장해 두기로 한 이상, 원본과 어긋나는 순간 화면의 숫자가 거짓말을 한다.
 */
describe('커뮤니티 - 댓글 / 반응 / 공유', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  /** 테스트에서 반복되는 준비: 글쓴이와 글 하나 */
  async function givenPost() {
    const author = await createUserAndLogin();
    const post = await createPost({ userId: author.user.id });
    return { author, post };
  }

  describe('댓글 작성', () => {
    it('회원은 댓글을 달 수 있고 게시글의 댓글 수가 올라간다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const response = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '좋은 글이네요' })
        .expect(201);

      expect(response.body.data.content).toBe('좋은 글이네요');
      expect(response.body.data.parentId).toBeNull();

      await post.reload();
      expect(post.commentCount).toBe(1);
    });

    it('비회원은 댓글을 달 수 없다', async () => {
      const { post } = await givenPost();

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .send({ content: '비회원 댓글' })
        .expect(401);
    });

    it('공백만 있는 댓글은 400', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '   ' })
        .expect(400);
    });

    it('숨김 처리된 글에는 댓글을 달 수 없다', async () => {
      const author = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id, status: 'hidden' });
      const commenter = await createUserAndLogin();

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '숨긴 글에 댓글' })
        .expect(404);
    });
  });

  describe('대댓글 (깊이 1단계 고정)', () => {
    it('댓글에 답글을 달 수 있다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const parent = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '부모 댓글' })
        .expect(201);

      const reply = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '답글', parentId: parent.body.data.id })
        .expect(201);

      expect(reply.body.data.parentId).toBe(parent.body.data.id);
    });

    it('대댓글에 단 답글도 최상위 댓글에 붙는다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const parent = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '부모' })
        .expect(201);

      const reply = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '답글', parentId: parent.body.data.id })
        .expect(201);

      const replyToReply = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '답글의 답글', parentId: reply.body.data.id })
        .expect(201);

      // 무한 depth를 허용하면 모바일에서 들여쓰기를 감당할 수 없다.
      // 답글의 답글은 그 답글이 아니라 최상위 댓글에 붙어야 한다.
      expect(replyToReply.body.data.parentId).toBe(parent.body.data.id);
    });

    it('다른 게시글의 댓글에는 답글을 달 수 없다', async () => {
      const { post } = await givenPost();
      const otherPost = await createPost({ userId: (await createUserAndLogin()).user.id });
      const commenter = await createUserAndLogin();

      const parent = await request(app)
        .post(`/api/community/posts/${otherPost.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '다른 글의 댓글' })
        .expect(201);

      // 댓글을 다른 글로 옮겨 붙이는 것을 막는다.
      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '옮겨붙이기', parentId: parent.body.data.id })
        .expect(400);
    });
  });

  describe('댓글 목록', () => {
    it('대댓글이 부모 댓글 안에 묶여 나온다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const parent = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '부모' });

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '답글1', parentId: parent.body.data.id });
      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '답글2', parentId: parent.body.data.id });

      const response = await request(app)
        .get(`/api/community/posts/${post.id}/comments`)
        .expect(200);

      // 최상위 댓글 기준으로 세므로 total은 1이다.
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.items[0].replies.map((r) => r.content)).toEqual([
        '답글1',
        '답글2',
      ]);
    });

    it('작성자 정보에 비밀번호나 토큰이 섞여 나가지 않는다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '댓글' });

      const response = await request(app)
        .get(`/api/community/posts/${post.id}/comments`)
        .expect(200);

      expect(response.body.data.items[0].author).not.toHaveProperty('password');
      expect(response.body.data.items[0].author).not.toHaveProperty('refreshToken');
    });

    it('로그인하면 내 댓글에 isMine이 붙는다', async () => {
      const { post } = await givenPost();
      const mine = await createUserAndLogin();
      const other = await createUserAndLogin();

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(mine.token))
        .send({ content: '내 댓글' });
      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(other.token))
        .send({ content: '남의 댓글' });

      const response = await request(app)
        .get(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(mine.token))
        .expect(200);

      const flags = Object.fromEntries(
        response.body.data.items.map((c) => [c.content, c.isMine])
      );
      expect(flags['내 댓글']).toBe(true);
      expect(flags['남의 댓글']).toBe(false);
    });
  });

  describe('댓글 수정 / 삭제', () => {
    it('작성자는 자기 댓글을 수정할 수 있다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const created = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '원래 댓글' });

      const response = await request(app)
        .put(`/api/community/comments/${created.body.data.id}`)
        .set(authHeader(commenter.token))
        .send({ content: '고친 댓글' })
        .expect(200);

      expect(response.body.data.content).toBe('고친 댓글');
    });

    it('남의 댓글은 수정할 수 없다 (운영자도 마찬가지)', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();
      const other = await createUserAndLogin();
      const admin = await createUserAndLogin({ role: 'admin' });

      const created = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '내 댓글' });

      for (const token of [other.token, admin.token]) {
        await request(app)
          .put(`/api/community/comments/${created.body.data.id}`)
          .set(authHeader(token))
          .send({ content: '몰래 수정' })
          .expect(403);
      }
    });

    it('삭제해도 행은 남고 내용만 가려진다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const parent = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '부모 댓글' });
      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '답글', parentId: parent.body.data.id });

      await request(app)
        .delete(`/api/community/comments/${parent.body.data.id}`)
        .set(authHeader(commenter.token))
        .expect(200);

      // 대댓글이 붙어 있는 댓글을 통째로 지우면 대화 맥락이 끊긴다.
      const stored = await PostComment.findByPk(parent.body.data.id);
      expect(stored).not.toBeNull();
      expect(stored.status).toBe('deleted');
      expect(stored.content).toBe('부모 댓글'); // 원문은 DB에 남는다

      const response = await request(app)
        .get(`/api/community/posts/${post.id}/comments`)
        .expect(200);

      // 화면에는 자리만 남고 내용과 작성자는 가려진다.
      expect(response.body.data.items[0].content).toBe('삭제된 댓글입니다.');
      expect(response.body.data.items[0].author).toBeNull();
      expect(response.body.data.items[0].replies[0].content).toBe('답글');
    });

    it('답글이 없는 삭제 댓글은 목록에서 아예 빠진다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const created = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '혼자 있는 댓글' });

      await request(app)
        .delete(`/api/community/comments/${created.body.data.id}`)
        .set(authHeader(commenter.token))
        .expect(200);

      const response = await request(app)
        .get(`/api/community/posts/${post.id}/comments`)
        .expect(200);

      // "삭제된 댓글입니다"만 덩그러니 남을 이유가 없다.
      expect(response.body.data.items).toHaveLength(0);
    });

    it('운영자는 남의 댓글을 삭제할 수 있다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();
      const admin = await createUserAndLogin({ role: 'admin' });

      const created = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '문제 댓글' });

      await request(app)
        .delete(`/api/community/comments/${created.body.data.id}`)
        .set(authHeader(admin.token))
        .expect(200);
    });

    it('이미 삭제된 댓글을 또 삭제하면 404', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const created = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '댓글' });

      await request(app)
        .delete(`/api/community/comments/${created.body.data.id}`)
        .set(authHeader(commenter.token))
        .expect(200);
      await request(app)
        .delete(`/api/community/comments/${created.body.data.id}`)
        .set(authHeader(commenter.token))
        .expect(404);
    });
  });

  describe('댓글 수 카운터 정합성', () => {
    it('3개 달고 1개 지우면 댓글 수는 2다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const ids = [];
      for (const content of ['A', 'B', 'C']) {
        const created = await request(app)
          .post(`/api/community/posts/${post.id}/comments`)
          .set(authHeader(commenter.token))
          .send({ content });
        ids.push(created.body.data.id);
      }

      await post.reload();
      expect(post.commentCount).toBe(3);

      await request(app)
        .delete(`/api/community/comments/${ids[0]}`)
        .set(authHeader(commenter.token))
        .expect(200);

      await post.reload();
      expect(post.commentCount).toBe(2);
    });

    it('대댓글도 댓글 수에 포함된다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const parent = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '부모' });
      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '답글', parentId: parent.body.data.id });

      await post.reload();
      expect(post.commentCount).toBe(2);
    });

    it('댓글 수정만으로는 카운터가 변하지 않는다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();

      const created = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '원본' });

      await request(app)
        .put(`/api/community/comments/${created.body.data.id}`)
        .set(authHeader(commenter.token))
        .send({ content: '수정본' })
        .expect(200);

      await post.reload();
      expect(post.commentCount).toBe(1);
    });
  });

  describe('댓글 좋아요', () => {
    it('토글로 등록하고 취소한다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();
      const liker = await createUserAndLogin();

      const created = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '댓글' });

      const on = await request(app)
        .post(`/api/community/comments/${created.body.data.id}/like`)
        .set(authHeader(liker.token))
        .expect(200);
      expect(on.body.data).toEqual({ liked: true, likeCount: 1 });

      const off = await request(app)
        .post(`/api/community/comments/${created.body.data.id}/like`)
        .set(authHeader(liker.token))
        .expect(200);
      expect(off.body.data).toEqual({ liked: false, likeCount: 0 });
    });

    it('목록에 내가 좋아요한 댓글이 표시된다', async () => {
      const { post } = await givenPost();
      const commenter = await createUserAndLogin();
      const liker = await createUserAndLogin();

      const created = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .send({ content: '댓글' });
      await request(app)
        .post(`/api/community/comments/${created.body.data.id}/like`)
        .set(authHeader(liker.token));

      const mine = await request(app)
        .get(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(liker.token))
        .expect(200);
      expect(mine.body.data.items[0].isLiked).toBe(true);

      const other = await request(app)
        .get(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(commenter.token))
        .expect(200);
      expect(other.body.data.items[0].isLiked).toBe(false);
    });
  });

  describe('반응 (좋아요 + 공감)', () => {
    it('반응을 남기면 반응 수가 올라간다', async () => {
      const { post } = await givenPost();
      const reactor = await createUserAndLogin();

      const response = await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .send({ type: 'like' })
        .expect(200);

      expect(response.body.data.total).toBe(1);
      expect(response.body.data.byType.like).toBe(1);
      expect(response.body.data.myReaction).toBe('like');

      await post.reload();
      expect(post.reactionCount).toBe(1);
    });

    it('종류를 바꿔도 반응 수는 그대로다', async () => {
      const { post } = await givenPost();
      const reactor = await createUserAndLogin();

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .send({ type: 'like' })
        .expect(200);

      const changed = await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .send({ type: 'sad' })
        .expect(200);

      // 이모지를 바꿀 때마다 반응 수가 늘어나면 안 된다.
      expect(changed.body.data.total).toBe(1);
      expect(changed.body.data.byType.like).toBe(0);
      expect(changed.body.data.byType.sad).toBe(1);
      expect(changed.body.data.myReaction).toBe('sad');

      await post.reload();
      expect(post.reactionCount).toBe(1);
      // 행도 하나뿐이어야 한다. (유니크 제약이 실제로 걸려 있는지 확인)
      expect(await PostReaction.count({ where: { postId: post.id } })).toBe(1);
    });

    it('같은 종류를 다시 보내도 결과가 같다', async () => {
      const { post } = await givenPost();
      const reactor = await createUserAndLogin();

      for (let i = 0; i < 3; i += 1) {
        await request(app)
          .put(`/api/community/posts/${post.id}/reaction`)
          .set(authHeader(reactor.token))
          .send({ type: 'love' })
          .expect(200);
      }

      await post.reload();
      expect(post.reactionCount).toBe(1);
    });

    it('여러 회원의 반응은 각각 센다', async () => {
      const { post } = await givenPost();
      const a = await createUserAndLogin();
      const b = await createUserAndLogin();

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(a.token))
        .send({ type: 'like' });
      const response = await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(b.token))
        .send({ type: 'wow' })
        .expect(200);

      expect(response.body.data.total).toBe(2);
      expect(response.body.data.byType).toMatchObject({ like: 1, wow: 1 });
    });

    it('반응을 취소하면 반응 수가 내려간다', async () => {
      const { post } = await givenPost();
      const reactor = await createUserAndLogin();

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .send({ type: 'like' });

      const response = await request(app)
        .delete(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .expect(200);

      expect(response.body.data.total).toBe(0);
      expect(response.body.data.myReaction).toBeNull();

      await post.reload();
      expect(post.reactionCount).toBe(0);
    });

    it('남긴 적 없는 반응을 취소하면 404', async () => {
      const { post } = await givenPost();
      const reactor = await createUserAndLogin();

      await request(app)
        .delete(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .expect(404);
    });

    it('알 수 없는 반응 종류는 400', async () => {
      const { post } = await givenPost();
      const reactor = await createUserAndLogin();

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .send({ type: 'hate' })
        .expect(400);
    });

    it('비회원은 반응을 남길 수 없다', async () => {
      const { post } = await givenPost();

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .send({ type: 'like' })
        .expect(401);
    });

    it('상세 응답에 반응 분포와 내 반응이 함께 온다', async () => {
      const { post } = await givenPost();
      const reactor = await createUserAndLogin();

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .send({ type: 'love' });

      const mine = await request(app)
        .get(`/api/community/posts/${post.id}`)
        .set(authHeader(reactor.token))
        .expect(200);
      expect(mine.body.data.reactions.myReaction).toBe('love');
      expect(mine.body.data.reactions.byType.love).toBe(1);

      // 반응이 없는 타입도 0으로 채워 내려준다. 화면에서 매번 방어하지 않도록.
      expect(mine.body.data.reactions.byType.angry).toBe(0);

      const anonymous = await request(app)
        .get(`/api/community/posts/${post.id}`)
        .expect(200);
      expect(anonymous.body.data.reactions.myReaction).toBeNull();
    });

    it('목록 응답에 내 반응이 붙는다', async () => {
      const { post } = await givenPost();
      const reactor = await createUserAndLogin();

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(reactor.token))
        .send({ type: 'wow' });

      const response = await request(app)
        .get('/api/community/posts')
        .set(authHeader(reactor.token))
        .expect(200);

      expect(response.body.data.items[0].myReaction).toBe('wow');
    });
  });

  describe('공유', () => {
    it('공유를 기록하면 공유 수가 올라간다', async () => {
      const { post } = await givenPost();
      const sharer = await createUserAndLogin();

      const response = await request(app)
        .post(`/api/community/posts/${post.id}/share`)
        .set(authHeader(sharer.token))
        .send({ channel: 'kakao' })
        .expect(200);

      expect(response.body.data.shareCount).toBe(1);

      const share = await PostShare.findOne({ where: { postId: post.id } });
      expect(share.channel).toBe('kakao');
    });

    it('같은 사람이 여러 번 공유해도 모두 기록된다', async () => {
      const { post } = await givenPost();
      const sharer = await createUserAndLogin();

      for (let i = 0; i < 3; i += 1) {
        await request(app)
          .post(`/api/community/posts/${post.id}/share`)
          .set(authHeader(sharer.token))
          .send({ channel: 'link' })
          .expect(200);
      }

      // 반응/좋아요와 달리 공유는 중복을 막지 않는다.
      await post.reload();
      expect(post.shareCount).toBe(3);
      expect(await PostShare.count({ where: { postId: post.id } })).toBe(3);
    });

    it('채널을 안 보내면 link로 기록된다', async () => {
      const { post } = await givenPost();
      const sharer = await createUserAndLogin();

      await request(app)
        .post(`/api/community/posts/${post.id}/share`)
        .set(authHeader(sharer.token))
        .send({})
        .expect(200);

      const share = await PostShare.findOne({ where: { postId: post.id } });
      expect(share.channel).toBe('link');
    });

    it('알 수 없는 채널은 400', async () => {
      const { post } = await givenPost();
      const sharer = await createUserAndLogin();

      await request(app)
        .post(`/api/community/posts/${post.id}/share`)
        .set(authHeader(sharer.token))
        .send({ channel: 'telepathy' })
        .expect(400);
    });
  });

  describe('삭제된 글의 부가기능', () => {
    it('삭제된 글에는 댓글도 반응도 공유도 할 수 없다', async () => {
      const author = await createUserAndLogin();
      const post = await createPost({ userId: author.user.id, status: 'deleted' });
      const other = await createUserAndLogin();

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(other.token))
        .send({ content: '댓글' })
        .expect(404);

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(other.token))
        .send({ type: 'like' })
        .expect(404);

      await request(app)
        .post(`/api/community/posts/${post.id}/share`)
        .set(authHeader(other.token))
        .send({ channel: 'link' })
        .expect(404);
    });
  });

  describe('카운터 보정 스크립트가 세는 기준', () => {
    it('저장된 카운터가 실제 개수와 일치한다', async () => {
      const { post } = await givenPost();
      const other = await createUserAndLogin();

      // 댓글 2개(1개는 삭제), 반응 1개, 공유 2회를 만든다.
      const first = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(other.token))
        .send({ content: '남길 댓글' });
      const second = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(other.token))
        .send({ content: '지울 댓글' });
      await request(app)
        .delete(`/api/community/comments/${second.body.data.id}`)
        .set(authHeader(other.token));

      await request(app)
        .put(`/api/community/posts/${post.id}/reaction`)
        .set(authHeader(other.token))
        .send({ type: 'like' });
      await request(app)
        .post(`/api/community/posts/${post.id}/share`)
        .set(authHeader(other.token))
        .send({ channel: 'link' });
      await request(app)
        .post(`/api/community/posts/${post.id}/share`)
        .set(authHeader(other.token))
        .send({ channel: 'kakao' });

      await post.reload();

      // 보정 스크립트(recountCommunity.js)가 세는 것과 같은 기준으로 대조한다.
      // 이 둘이 어긋나면 스크립트가 멀쩡한 데이터를 "고쳐서" 망가뜨린다.
      const publishedComments = await PostComment.count({
        where: { postId: post.id, status: 'published' },
      });
      expect(post.commentCount).toBe(publishedComments);
      expect(post.reactionCount).toBe(await PostReaction.count({ where: { postId: post.id } }));
      expect(post.shareCount).toBe(await PostShare.count({ where: { postId: post.id } }));

      expect(first.body.data.id).toBeDefined();
      expect(await Post.count()).toBe(1);
    });
  });
});
