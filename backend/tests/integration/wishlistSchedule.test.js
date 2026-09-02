const {
  request,
  app,
  resetDatabase,
  createUserAndLogin,
  createFestival,
  authHeader,
} = require('../helpers');
const Festival = require('../../src/models/festival.model');

/**
 * 위시리스트(날짜 없는 찜)와 내 일정(방문일이 정해진 계획).
 */
describe('위시리스트 / 내 일정 API', () => {
  let me;
  let other;
  let festival;

  beforeEach(async () => {
    await resetDatabase();
    me = await createUserAndLogin({ email: 'me@example.com' });
    other = await createUserAndLogin({ email: 'other@example.com' });
    festival = await createFestival({ startDate: '2026-11-05', endDate: '2026-11-07' });
  });

  describe('축제 상세의 개인화 정보', () => {
    it('비로그인 상태에서도 상세를 볼 수 있고 isWishlisted는 false다', async () => {
      const response = await request(app).get(`/api/festivals/${festival.id}`).expect(200);

      expect(response.body.data.isWishlisted).toBe(false);
    });

    it('찜한 뒤에는 본인에게만 isWishlisted가 true로 보인다', async () => {
      await request(app)
        .post(`/api/users/me/wishlists/${festival.id}`)
        .set(authHeader(me.token))
        .expect(201);

      const mine = await request(app)
        .get(`/api/festivals/${festival.id}`)
        .set(authHeader(me.token));
      const others = await request(app)
        .get(`/api/festivals/${festival.id}`)
        .set(authHeader(other.token));

      expect(mine.body.data.isWishlisted).toBe(true);
      expect(others.body.data.isWishlisted).toBe(false);
    });

    it('토큰이 유효하지 않아도 상세 조회는 막지 않는다 (비회원으로 처리)', async () => {
      const response = await request(app)
        .get(`/api/festivals/${festival.id}`)
        .set(authHeader('garbage.token'))
        .expect(200);

      expect(response.body.data.isWishlisted).toBe(false);
    });
  });

  describe('위시리스트', () => {
    it('찜하고 목록에서 확인할 수 있다', async () => {
      await request(app)
        .post(`/api/users/me/wishlists/${festival.id}`)
        .set(authHeader(me.token))
        .expect(201);

      const response = await request(app)
        .get('/api/users/me/wishlists')
        .set(authHeader(me.token))
        .expect(200);

      expect(response.body.data.total).toBe(1);
      expect(response.body.data.items[0].festival.name).toBe(festival.name);
      expect(response.body.data.items[0].festival.sido.name).toBeTruthy();
    });

    it('같은 축제를 중복으로 찜할 수 없다', async () => {
      const add = () =>
        request(app).post(`/api/users/me/wishlists/${festival.id}`).set(authHeader(me.token));

      await add().expect(201);
      await add().expect(409);
    });

    it('없는 축제는 찜할 수 없다', async () => {
      await request(app)
        .post('/api/users/me/wishlists/999999')
        .set(authHeader(me.token))
        .expect(404);
    });

    it('다른 회원의 위시리스트에는 영향이 없다', async () => {
      await request(app).post(`/api/users/me/wishlists/${festival.id}`).set(authHeader(me.token));

      const response = await request(app)
        .get('/api/users/me/wishlists')
        .set(authHeader(other.token))
        .expect(200);

      expect(response.body.data.total).toBe(0);
    });

    it('삭제한 뒤 다시 삭제하면 404', async () => {
      await request(app).post(`/api/users/me/wishlists/${festival.id}`).set(authHeader(me.token));

      await request(app)
        .delete(`/api/users/me/wishlists/${festival.id}`)
        .set(authHeader(me.token))
        .expect(200);
      await request(app)
        .delete(`/api/users/me/wishlists/${festival.id}`)
        .set(authHeader(me.token))
        .expect(404);
    });

    it('비로그인은 조회할 수 없다', async () => {
      await request(app).get('/api/users/me/wishlists').expect(401);
    });
  });

  describe('내 일정 - 방문일은 축제 기간 안이어야 한다', () => {
    it('기간 안의 날짜로 등록할 수 있다', async () => {
      const response = await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate: '2026-11-06', memo: '친구와 함께' })
        .expect(201);

      expect(response.body.data.visitDate).toBe('2026-11-06');
    });

    it.each([
      ['시작일', '2026-11-05'],
      ['종료일', '2026-11-07'],
    ])('%s 경계는 허용된다', async (_label, visitDate) => {
      await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate })
        .expect(201);
    });

    it.each([
      ['시작 전날', '2026-11-04'],
      ['종료 다음날', '2026-11-08'],
      ['한참 뒤', '2026-12-25'],
    ])('%s 은 거부된다', async (_label, visitDate) => {
      const response = await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate })
        .expect(400);

      // 사용자가 어느 기간에서 골라야 하는지 알 수 있어야 한다.
      expect(response.body.message).toContain('2026-11-05');
    });

    it('달력에 없는 날짜는 거부된다', async () => {
      await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate: '2026-13-01' })
        .expect(400);
    });

    it('같은 축제를 같은 날짜로 중복 등록할 수 없다', async () => {
      const create = () =>
        request(app)
          .post('/api/users/me/schedules')
          .set(authHeader(me.token))
          .send({ festivalId: festival.id, visitDate: '2026-11-06' });

      await create().expect(201);
      await create().expect(409);
    });

    it('같은 축제라도 다른 날짜면 등록할 수 있다', async () => {
      await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate: '2026-11-05' })
        .expect(201);

      await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate: '2026-11-06' })
        .expect(201);
    });

    it('필수값이 빠지면 400', async () => {
      await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id })
        .expect(400);
    });
  });

  describe('내 일정 - 조회/수정/삭제', () => {
    let scheduleId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate: '2026-11-06' });
      scheduleId = response.body.data.id;
    });

    it('방문일 오름차순으로 축제 정보와 함께 조회된다', async () => {
      await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate: '2026-11-05' });

      const response = await request(app)
        .get('/api/users/me/schedules')
        .set(authHeader(me.token))
        .expect(200);

      expect(response.body.data.map((s) => s.visitDate)).toEqual(['2026-11-05', '2026-11-06']);
      expect(response.body.data[0].festival.name).toBe(festival.name);
    });

    it('기간으로 좁혀 조회할 수 있다', async () => {
      await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate: '2026-11-05' });

      const response = await request(app)
        .get('/api/users/me/schedules?from=2026-11-06&to=2026-11-30')
        .set(authHeader(me.token))
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].visitDate).toBe('2026-11-06');
    });

    it('방문일과 메모를 수정할 수 있다', async () => {
      const response = await request(app)
        .patch(`/api/users/me/schedules/${scheduleId}`)
        .set(authHeader(me.token))
        .send({ visitDate: '2026-11-07', memo: '혼자 방문' })
        .expect(200);

      expect(response.body.data.visitDate).toBe('2026-11-07');
      expect(response.body.data.memo).toBe('혼자 방문');
    });

    it('수정할 때도 축제 기간을 벗어나면 거부된다', async () => {
      await request(app)
        .patch(`/api/users/me/schedules/${scheduleId}`)
        .set(authHeader(me.token))
        .send({ visitDate: '2026-12-25' })
        .expect(400);
    });

    it('다른 일정과 날짜가 겹치도록 수정할 수 없다', async () => {
      await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate: '2026-11-05' });

      await request(app)
        .patch(`/api/users/me/schedules/${scheduleId}`)
        .set(authHeader(me.token))
        .send({ visitDate: '2026-11-05' })
        .expect(409);
    });

    it('남의 일정은 수정/삭제할 수 없다', async () => {
      await request(app)
        .patch(`/api/users/me/schedules/${scheduleId}`)
        .set(authHeader(other.token))
        .send({ memo: '침입' })
        .expect(404);

      await request(app)
        .delete(`/api/users/me/schedules/${scheduleId}`)
        .set(authHeader(other.token))
        .expect(404);
    });

    it('내 일정은 삭제할 수 있다', async () => {
      await request(app)
        .delete(`/api/users/me/schedules/${scheduleId}`)
        .set(authHeader(me.token))
        .expect(200);

      const response = await request(app).get('/api/users/me/schedules').set(authHeader(me.token));
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('축제가 삭제되면 관련 데이터도 정리된다', () => {
    it('위시리스트와 일정이 함께 삭제된다', async () => {
      await request(app).post(`/api/users/me/wishlists/${festival.id}`).set(authHeader(me.token));
      await request(app)
        .post('/api/users/me/schedules')
        .set(authHeader(me.token))
        .send({ festivalId: festival.id, visitDate: '2026-11-06' });

      await Festival.destroy({ where: { id: festival.id } });

      const wishlists = await request(app)
        .get('/api/users/me/wishlists')
        .set(authHeader(me.token));
      const schedules = await request(app)
        .get('/api/users/me/schedules')
        .set(authHeader(me.token));

      expect(wishlists.body.data.total).toBe(0);
      expect(schedules.body.data).toHaveLength(0);
    });
  });
});
