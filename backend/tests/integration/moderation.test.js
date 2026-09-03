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
const PostReport = require('../../src/models/postReport.model');

/**
 * 신고 / 차단 / 운영자 처리 통합 테스트.
 *
 * 이 도메인에서 가장 위험한 것은 **신고가 남의 글을 지우는 도구가 되는 것**이다.
 * 그래서 "신고해도 글은 그대로다"를 명시적으로 검증한다.
 */
describe('커뮤니티 - 신고 / 차단', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  /** 글쓴이 · 글 · 제3자를 준비한다. */
  async function given() {
    const author = await createUserAndLogin();
    const other = await createUserAndLogin();
    const post = await createPost({ userId: author.user.id, title: '신고 대상 글' });
    return { author, other, post };
  }

  describe('게시글 신고', () => {
    it('다른 사람의 글을 신고할 수 있다', async () => {
      const { other, post } = await given();

      const response = await request(app)
        .post(`/api/community/posts/${post.id}/report`)
        .set(authHeader(other.token))
        .send({ reason: 'spam' })
        .expect(201);

      expect(response.body.data.status).toBe('pending');
    });

    it('신고해도 글은 그대로 보인다', async () => {
      const { other, post } = await given();

      await request(app)
        .post(`/api/community/posts/${post.id}/report`)
        .set(authHeader(other.token))
        .send({ reason: 'abuse' })
        .expect(201);

      // 신고만으로 글이 사라지면, 계정을 여러 개 만들어 남의 글을 지울 수 있다.
      await post.reload();
      expect(post.status).toBe('published');

      const list = await request(app).get('/api/community/posts').expect(200);
      expect(list.body.data.total).toBe(1);
    });

    it('같은 글을 두 번 신고하면 409', async () => {
      const { other, post } = await given();
      const report = () =>
        request(app)
          .post(`/api/community/posts/${post.id}/report`)
          .set(authHeader(other.token))
          .send({ reason: 'spam' });

      await report().expect(201);
      await report().expect(409);
    });

    it('본인 글은 신고할 수 없다', async () => {
      const { author, post } = await given();

      // 자기 글이 문제면 지우면 된다. 신고할 이유가 없다.
      await request(app)
        .post(`/api/community/posts/${post.id}/report`)
        .set(authHeader(author.token))
        .send({ reason: 'spam' })
        .expect(400);
    });

    it('알 수 없는 사유는 400', async () => {
      const { other, post } = await given();

      await request(app)
        .post(`/api/community/posts/${post.id}/report`)
        .set(authHeader(other.token))
        .send({ reason: '마음에안듦' })
        .expect(400);
    });

    it("사유가 '기타'인데 설명이 없으면 400", async () => {
      const { other, post } = await given();

      // 설명 없는 '기타' 신고는 운영자가 무엇을 봐야 할지 알 수 없다.
      await request(app)
        .post(`/api/community/posts/${post.id}/report`)
        .set(authHeader(other.token))
        .send({ reason: 'etc' })
        .expect(400);

      await request(app)
        .post(`/api/community/posts/${post.id}/report`)
        .set(authHeader(other.token))
        .send({ reason: 'etc', detail: '광고 링크가 반복적으로 올라옵니다.' })
        .expect(201);
    });

    it('비회원은 신고할 수 없다', async () => {
      const { post } = await given();

      await request(app)
        .post(`/api/community/posts/${post.id}/report`)
        .send({ reason: 'spam' })
        .expect(401);
    });
  });

  describe('댓글 신고', () => {
    it('다른 사람의 댓글을 신고할 수 있다', async () => {
      const { author, other, post } = await given();

      const comment = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(author.token))
        .send({ content: '신고 대상 댓글' })
        .expect(201);

      await request(app)
        .post(`/api/community/comments/${comment.body.data.id}/report`)
        .set(authHeader(other.token))
        .send({ reason: 'abuse' })
        .expect(201);
    });

    it('본인 댓글은 신고할 수 없다', async () => {
      const { author, post } = await given();

      const comment = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(author.token))
        .send({ content: '내 댓글' });

      await request(app)
        .post(`/api/community/comments/${comment.body.data.id}/report`)
        .set(authHeader(author.token))
        .send({ reason: 'spam' })
        .expect(400);
    });
  });

  describe('차단', () => {
    it('차단하면 그 사람의 글이 목록에서 사라진다', async () => {
      const me = await createUserAndLogin();
      const noisy = await createUserAndLogin();
      await createPost({ userId: noisy.user.id, title: '차단할 사람의 글' });
      await createPost({ userId: me.user.id, title: '내 글' });

      const before = await request(app)
        .get('/api/community/posts')
        .set(authHeader(me.token))
        .expect(200);
      expect(before.body.data.total).toBe(2);

      await request(app)
        .post(`/api/community/me/blocks/${noisy.user.id}`)
        .set(authHeader(me.token))
        .expect(201);

      const after = await request(app)
        .get('/api/community/posts')
        .set(authHeader(me.token))
        .expect(200);
      expect(after.body.data.items.map((p) => p.title)).toEqual(['내 글']);
    });

    it('차단해도 다른 사람에게는 그대로 보인다', async () => {
      const me = await createUserAndLogin();
      const noisy = await createUserAndLogin();
      const bystander = await createUserAndLogin();
      await createPost({ userId: noisy.user.id, title: '차단할 사람의 글' });

      await request(app)
        .post(`/api/community/me/blocks/${noisy.user.id}`)
        .set(authHeader(me.token));

      // 차단은 개인 설정이지 삭제가 아니다.
      const others = await request(app)
        .get('/api/community/posts')
        .set(authHeader(bystander.token))
        .expect(200);
      expect(others.body.data.total).toBe(1);

      const anonymous = await request(app).get('/api/community/posts').expect(200);
      expect(anonymous.body.data.total).toBe(1);
    });

    it('차단한 사람의 댓글도 보이지 않는다', async () => {
      const me = await createUserAndLogin();
      const noisy = await createUserAndLogin();
      const post = await createPost({ userId: me.user.id });

      await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(noisy.token))
        .send({ content: '차단할 사람의 댓글' })
        .expect(201);

      await request(app)
        .post(`/api/community/me/blocks/${noisy.user.id}`)
        .set(authHeader(me.token));

      // 글만 가리고 댓글이 그대로 보이면 차단이 아니다.
      const response = await request(app)
        .get(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(me.token))
        .expect(200);
      expect(response.body.data.items).toHaveLength(0);
    });

    it('차단을 해제하면 다시 보인다', async () => {
      const me = await createUserAndLogin();
      const noisy = await createUserAndLogin();
      await createPost({ userId: noisy.user.id });

      await request(app)
        .post(`/api/community/me/blocks/${noisy.user.id}`)
        .set(authHeader(me.token));
      await request(app)
        .delete(`/api/community/me/blocks/${noisy.user.id}`)
        .set(authHeader(me.token))
        .expect(200);

      const response = await request(app)
        .get('/api/community/posts')
        .set(authHeader(me.token))
        .expect(200);
      expect(response.body.data.total).toBe(1);
    });

    it('자기 자신은 차단할 수 없다', async () => {
      const me = await createUserAndLogin();

      await request(app)
        .post(`/api/community/me/blocks/${me.user.id}`)
        .set(authHeader(me.token))
        .expect(400);
    });

    it('운영자는 차단할 수 없다', async () => {
      const me = await createUserAndLogin();
      const admin = await createUserAndLogin({ role: 'admin' });

      // 운영자를 차단하면 공지사항이 보이지 않게 된다.
      await request(app)
        .post(`/api/community/me/blocks/${admin.user.id}`)
        .set(authHeader(me.token))
        .expect(400);
    });

    it('차단 목록을 조회한다', async () => {
      const me = await createUserAndLogin();
      const noisy = await createUserAndLogin();

      await request(app)
        .post(`/api/community/me/blocks/${noisy.user.id}`)
        .set(authHeader(me.token));

      const response = await request(app)
        .get('/api/community/me/blocks')
        .set(authHeader(me.token))
        .expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].blockedUser.id).toBe(noisy.user.id);
      // 차단 목록에도 민감정보가 실리면 안 된다.
      expect(response.body.data.items[0].blockedUser).not.toHaveProperty('email');
    });
  });

  describe('운영자 신고 처리', () => {
    /** 신고 1건이 접수된 상태를 만든다. */
    async function givenReport() {
      const { author, other, post } = await given();
      const admin = await createUserAndLogin({ role: 'admin' });

      const report = await request(app)
        .post(`/api/community/posts/${post.id}/report`)
        .set(authHeader(other.token))
        .send({ reason: 'spam' })
        .expect(201);

      return { author, other, post, admin, reportId: report.body.data.id };
    }

    it('운영자는 처리 대기 신고를 볼 수 있다', async () => {
      const { admin } = await givenReport();

      const response = await request(app)
        .get('/api/community/admin/reports')
        .set(authHeader(admin.token))
        .expect(200);

      expect(response.body.data.total).toBe(1);
      expect(response.body.data.items[0].targetType).toBe('post');
      expect(response.body.data.items[0].post.title).toBe('신고 대상 글');
    });

    it('일반 회원은 신고 목록을 볼 수 없다', async () => {
      const { other } = await givenReport();

      await request(app)
        .get('/api/community/admin/reports')
        .set(authHeader(other.token))
        .expect(403);
    });

    it('처리하면 목록에서 빠지고 처리자가 기록된다', async () => {
      const { admin, reportId } = await givenReport();

      await request(app)
        .patch(`/api/community/admin/reports/post/${reportId}`)
        .set(authHeader(admin.token))
        .send({ status: 'rejected' })
        .expect(200);

      const stored = await PostReport.findByPk(reportId);
      expect(stored.status).toBe('rejected');
      // 누가 판단했는지 남지 않으면 이력의 의미가 없다.
      expect(stored.handledBy).toBe(admin.user.id);
      expect(stored.handledAt).not.toBeNull();

      const pending = await request(app)
        .get('/api/community/admin/reports')
        .set(authHeader(admin.token))
        .expect(200);
      expect(pending.body.data.total).toBe(0);
    });

    it('처리만으로는 글이 숨겨지지 않는다', async () => {
      const { admin, post, reportId } = await givenReport();

      await request(app)
        .patch(`/api/community/admin/reports/post/${reportId}`)
        .set(authHeader(admin.token))
        .send({ status: 'resolved' })
        .expect(200);

      // 신고 처리와 숨김은 별개의 판단이다.
      await post.reload();
      expect(post.status).toBe('published');
    });

    it('hide를 주면 글도 함께 숨긴다', async () => {
      const { admin, post, reportId } = await givenReport();

      await request(app)
        .patch(`/api/community/admin/reports/post/${reportId}`)
        .set(authHeader(admin.token))
        .send({ status: 'resolved', hide: true })
        .expect(200);

      await post.reload();
      expect(post.status).toBe('hidden');
    });

    it('같은 글에 대한 신고는 한 번에 함께 처리된다', async () => {
      const { admin, post, reportId } = await givenReport();
      const third = await createUserAndLogin();

      await request(app)
        .post(`/api/community/posts/${post.id}/report`)
        .set(authHeader(third.token))
        .send({ reason: 'abuse' })
        .expect(201);

      await request(app)
        .patch(`/api/community/admin/reports/post/${reportId}`)
        .set(authHeader(admin.token))
        .send({ status: 'resolved' })
        .expect(200);

      // 하나씩 처리하게 두면 같은 글에 대한 신고 10건이 목록에 10번 남는다.
      expect(await PostReport.count({ where: { status: 'pending' } })).toBe(0);
    });

    it('이미 처리된 신고를 또 처리하면 409', async () => {
      const { admin, reportId } = await givenReport();

      const handle = () =>
        request(app)
          .patch(`/api/community/admin/reports/post/${reportId}`)
          .set(authHeader(admin.token))
          .send({ status: 'resolved' });

      await handle().expect(200);
      await handle().expect(409);
    });

    it('댓글 신고도 처리하고 함께 가릴 수 있다', async () => {
      const author = await createUserAndLogin();
      const other = await createUserAndLogin();
      const admin = await createUserAndLogin({ role: 'admin' });
      const post = await createPost({ userId: author.user.id });

      const comment = await request(app)
        .post(`/api/community/posts/${post.id}/comments`)
        .set(authHeader(author.token))
        .send({ content: '문제 댓글' });

      const report = await request(app)
        .post(`/api/community/comments/${comment.body.data.id}/report`)
        .set(authHeader(other.token))
        .send({ reason: 'abuse' })
        .expect(201);

      await request(app)
        .patch(`/api/community/admin/reports/comment/${report.body.data.id}`)
        .set(authHeader(admin.token))
        .send({ status: 'resolved', hide: true })
        .expect(200);

      const stored = await PostComment.findByPk(comment.body.data.id);
      expect(stored.status).toBe('deleted');
      expect(await Post.count()).toBe(1);
    });
  });
});
