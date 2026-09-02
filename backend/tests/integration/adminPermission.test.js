const {
  request,
  app,
  resetDatabase,
  createUserAndLogin,
  createFestival,
  authHeader,
} = require('../helpers');
const User = require('../../src/models/user.model');

/**
 * 축제/문화재 데이터 변경은 운영자(admin)만 할 수 있어야 한다.
 * 로그인한 일반 회원이 전체 축제를 지울 수 있으면 안 된다.
 */
describe('운영자 권한 (축제/문화재 쓰기 API)', () => {
  let admin;
  let member;
  let festival;

  beforeEach(async () => {
    await resetDatabase();
    admin = await createUserAndLogin({ email: 'admin@example.com', role: 'admin' });
    member = await createUserAndLogin({ email: 'member@example.com' });
    festival = await createFestival();
  });

  describe('일반 회원은 거부된다', () => {
    it('축제를 등록할 수 없다', async () => {
      const response = await request(app)
        .post('/api/festivals')
        .set(authHeader(member.token))
        .send({ sidoId: festival.sidoId, name: '몰래등록', startDate: '2026-12-01', endDate: '2026-12-02' })
        .expect(403);

      expect(response.body.message).toContain('운영자 권한');
    });

    it('축제를 수정할 수 없다', async () => {
      await request(app)
        .put(`/api/festivals/${festival.id}`)
        .set(authHeader(member.token))
        .send({ name: '몰래수정' })
        .expect(403);
    });

    it('축제를 삭제할 수 없다', async () => {
      await request(app)
        .delete(`/api/festivals/${festival.id}`)
        .set(authHeader(member.token))
        .expect(403);

      // 실제로 삭제되지 않았는지 확인한다.
      await request(app).get(`/api/festivals/${festival.id}`).expect(200);
    });

    it('문화재를 등록/삭제할 수 없다', async () => {
      await request(app)
        .post('/api/heritages')
        .set(authHeader(member.token))
        .send({ sidoId: festival.sidoId, name: '몰래등록' })
        .expect(403);

      await request(app).delete('/api/heritages/1').set(authHeader(member.token)).expect(403);
    });
  });

  describe('비로그인 사용자는 401을 받는다', () => {
    it('토큰 없이 축제를 삭제할 수 없다', async () => {
      await request(app).delete(`/api/festivals/${festival.id}`).expect(401);
    });
  });

  describe('운영자는 허용된다', () => {
    it('축제를 등록/수정/삭제할 수 있다', async () => {
      const created = await request(app)
        .post('/api/festivals')
        .set(authHeader(admin.token))
        .send({
          sidoId: festival.sidoId,
          name: '운영자등록축제',
          startDate: '2026-12-01',
          endDate: '2026-12-02',
        })
        .expect(201);

      const newId = created.body.data.id;

      await request(app)
        .put(`/api/festivals/${newId}`)
        .set(authHeader(admin.token))
        .send({ name: '이름변경' })
        .expect(200);

      await request(app)
        .delete(`/api/festivals/${newId}`)
        .set(authHeader(admin.token))
        .expect(200);
    });
  });

  describe('권한은 매 요청마다 DB에서 확인된다', () => {
    it('권한을 회수하면 기존 토큰으로도 즉시 거부된다', async () => {
      // 권한 회수 전에는 통과한다.
      await request(app)
        .delete(`/api/festivals/${festival.id}`)
        .set(authHeader(admin.token))
        .expect(200);

      // 토큰은 그대로 두고 DB에서만 권한을 회수한다.
      await User.update({ role: 'user' }, { where: { id: admin.user.id } });

      const stillValidToken = admin.token;
      const another = await createFestival({ name: '남은축제' });

      await request(app)
        .delete(`/api/festivals/${another.id}`)
        .set(authHeader(stillValidToken))
        .expect(403);
    });

    it('탈퇴한 운영자는 거부된다', async () => {
      await User.update({ status: 'withdrawn' }, { where: { id: admin.user.id } });

      await request(app)
        .delete(`/api/festivals/${festival.id}`)
        .set(authHeader(admin.token))
        .expect(403);
    });
  });

  describe('회원가입 기본 권한', () => {
    it('새로 가입한 회원은 항상 일반 회원이다', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'newbie@example.com', password: 'pass1234', name: '신규' })
        .expect(201);

      expect(response.body.data.role).toBe('user');
    });

    it('가입 요청에 role을 넣어도 무시된다 (권한 상승 방지)', async () => {
      const response = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'hacker@example.com', password: 'pass1234', name: '해커', role: 'admin' })
        .expect(201);

      expect(response.body.data.role).toBe('user');
    });
  });
});
