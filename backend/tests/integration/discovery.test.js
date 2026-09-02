const { request, app, resetDatabase, createFestival } = require('../helpers');
const Heritage = require('../../src/models/heritage.model');
const Sido = require('../../src/models/sido.model');
const { getUpcomingWeekend } = require('../../src/services/discovery.service');

/**
 * 탐색 API - 큐레이션(시간 기준)과 내 주변(거리 기준).
 *
 * 좌표는 실제 위치를 사용해 거리 계산이 맞는지 함께 검증한다.
 * 서울시청 ~ 경복궁은 약 1.5km, 서울 ~ 부산은 약 325km이다.
 */
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };
const GYEONGBOKGUNG = { latitude: 37.5796, longitude: 126.977 }; // 서울시청에서 약 1.5km
const DAEJEON = { latitude: 36.3504, longitude: 127.3845 }; // 서울시청에서 약 140km
const BUSAN = { latitude: 35.1796, longitude: 129.0756 }; // 서울시청에서 약 325km (반경 상한 200km 밖)

describe('탐색 API (큐레이션 / 내 주변)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('getUpcomingWeekend - 이번 주말 계산', () => {
    it.each([
      ['월요일', '2026-11-02', '2026-11-07', '2026-11-08'],
      ['금요일', '2026-11-06', '2026-11-07', '2026-11-08'],
      ['토요일이면 그 주말 그대로', '2026-11-07', '2026-11-07', '2026-11-08'],
      ['일요일이면 전날 토요일부터', '2026-11-08', '2026-11-07', '2026-11-08'],
    ])('%s 기준', (_label, baseDate, expectedStart, expectedEnd) => {
      expect(getUpcomingWeekend(baseDate)).toEqual({ start: expectedStart, end: expectedEnd });
    });
  });

  describe('큐레이션 - GET /api/festivals/curated', () => {
    beforeEach(async () => {
      // 2026-11-04(수)를 오늘로 가정한다. 이번 주말은 11/07(토)~11/08(일).
      await createFestival({ name: '진행중축제', startDate: '2026-11-01', endDate: '2026-11-10' });
      await createFestival({ name: '주말축제', startDate: '2026-11-07', endDate: '2026-11-08' });
      await createFestival({ name: '다음달축제', startDate: '2026-12-01', endDate: '2026-12-03' });
      await createFestival({ name: '지난축제', startDate: '2026-10-01', endDate: '2026-10-05' });
    });

    it('진행 중 / 이번 주말 / 곧 시작을 나눠서 반환한다', async () => {
      const response = await request(app)
        .get('/api/festivals/curated?date=2026-11-04')
        .expect(200);

      const { ongoing, weekendFestivals, upcoming, weekend } = response.body.data;

      expect(weekend).toEqual({ start: '2026-11-07', end: '2026-11-08' });
      expect(ongoing.map((f) => f.name)).toEqual(['진행중축제']);
      // 진행중축제(11/01~11/10)도 주말에 걸쳐 있으므로 주말 목록에 포함된다.
      expect(weekendFestivals.map((f) => f.name).sort()).toEqual(['주말축제', '진행중축제']);
      expect(upcoming.map((f) => f.name)).toEqual(['주말축제', '다음달축제']);
    });

    it('이미 끝난 축제는 어디에도 포함되지 않는다', async () => {
      const response = await request(app).get('/api/festivals/curated?date=2026-11-04');
      const { ongoing, weekendFestivals, upcoming } = response.body.data;

      const allNames = [...ongoing, ...weekendFestivals, ...upcoming].map((f) => f.name);
      expect(allNames).not.toContain('지난축제');
    });

    it('지역으로 좁힐 수 있다', async () => {
      await createFestival({
        name: '부산진행중축제',
        sidoCode: '21',
        startDate: '2026-11-01',
        endDate: '2026-11-10',
      });

      const response = await request(app)
        .get('/api/festivals/curated?date=2026-11-04&sidoCode=21')
        .expect(200);

      expect(response.body.data.ongoing.map((f) => f.name)).toEqual(['부산진행중축제']);
    });

    it('잘못된 date 형식은 400', async () => {
      await request(app).get('/api/festivals/curated?date=2026-13-99').expect(400);
    });
  });

  describe('내 주변 축제 - GET /api/festivals/nearby', () => {
    beforeEach(async () => {
      await createFestival({
        name: '경복궁축제',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        ...GYEONGBOKGUNG,
      });
      await createFestival({
        name: '대전축제',
        sidoCode: '25',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        ...DAEJEON,
      });
      await createFestival({
        name: '부산축제',
        sidoCode: '21',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        ...BUSAN,
      });
      // 좌표가 없는 축제는 거리 계산이 불가능해 제외되어야 한다.
      await createFestival({ name: '좌표없는축제', startDate: '2026-11-01', endDate: '2026-11-30' });
    });

    it('반경 안의 축제만 가까운 순으로 반환한다', async () => {
      const response = await request(app)
        .get(`/api/festivals/nearby?lat=${SEOUL_CITY_HALL.lat}&lng=${SEOUL_CITY_HALL.lng}&radius=10&date=2026-11-04`)
        .expect(200);

      expect(response.body.data.items.map((f) => f.name)).toEqual(['경복궁축제']);
    });

    it('계산된 거리(distanceKm)를 함께 내려준다', async () => {
      const response = await request(app)
        .get(`/api/festivals/nearby?lat=${SEOUL_CITY_HALL.lat}&lng=${SEOUL_CITY_HALL.lng}&radius=10&date=2026-11-04`)
        .expect(200);

      // 서울시청 ~ 경복궁 실제 거리는 약 1.5km
      const distanceKm = Number(response.body.data.items[0].distanceKm);
      expect(distanceKm).toBeGreaterThan(1);
      expect(distanceKm).toBeLessThan(2);
    });

    it('반경을 넓히면 먼 축제도 포함되며 가까운 순으로 정렬된다', async () => {
      const response = await request(app)
        .get(`/api/festivals/nearby?lat=${SEOUL_CITY_HALL.lat}&lng=${SEOUL_CITY_HALL.lng}&radius=200&date=2026-11-04`)
        .expect(200);

      // 경복궁(약 1.5km)이 대전(약 140km)보다 앞에 와야 한다.
      expect(response.body.data.items.map((f) => f.name)).toEqual(['경복궁축제', '대전축제']);
    });

    it('반경은 최대 200km로 제한된다 (더 큰 값을 요청해도 상한 적용)', async () => {
      const response = await request(app)
        .get(`/api/festivals/nearby?lat=${SEOUL_CITY_HALL.lat}&lng=${SEOUL_CITY_HALL.lng}&radius=9999&date=2026-11-04`)
        .expect(200);

      expect(response.body.data.radiusKm).toBe(200);
      // 부산(약 325km)은 상한 밖이라 제외된다.
      expect(response.body.data.items.map((f) => f.name)).not.toContain('부산축제');
    });

    it('좌표가 없는 축제는 제외된다', async () => {
      const response = await request(app)
        .get(`/api/festivals/nearby?lat=${SEOUL_CITY_HALL.lat}&lng=${SEOUL_CITY_HALL.lng}&radius=200&date=2026-11-04`)
        .expect(200);

      expect(response.body.data.items.map((f) => f.name)).not.toContain('좌표없는축제');
    });

    it('기본적으로 이미 끝난 축제는 제외한다', async () => {
      await createFestival({
        name: '끝난근처축제',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        ...GYEONGBOKGUNG,
      });

      const response = await request(app)
        .get(`/api/festivals/nearby?lat=${SEOUL_CITY_HALL.lat}&lng=${SEOUL_CITY_HALL.lng}&radius=10&date=2026-11-04`)
        .expect(200);

      expect(response.body.data.items.map((f) => f.name)).not.toContain('끝난근처축제');
    });

    it.each([
      ['위도 누락', '?lng=126.978'],
      ['경도 누락', '?lat=37.5665'],
      ['위도 범위 초과', '?lat=95&lng=126.978'],
      ['경도 범위 초과', '?lat=37.5665&lng=200'],
      ['숫자가 아닌 좌표', '?lat=abc&lng=126.978'],
    ])('%s 이면 400', async (_label, query) => {
      await request(app).get(`/api/festivals/nearby${query}`).expect(400);
    });
  });

  describe('내 주변 문화재 - GET /api/heritages/nearby', () => {
    beforeEach(async () => {
      const seoul = await Sido.findOne({ where: { code: '11' } });
      const busan = await Sido.findOne({ where: { code: '21' } });

      await Heritage.create({ sidoId: seoul.id, name: '경복궁', ...GYEONGBOKGUNG });
      await Heritage.create({ sidoId: busan.id, name: '범어사', ...BUSAN });
      await Heritage.create({ sidoId: seoul.id, name: '좌표없는문화재' });
    });

    it('반경 안의 문화재를 가까운 순으로 반환한다', async () => {
      const response = await request(app)
        .get(`/api/heritages/nearby?lat=${SEOUL_CITY_HALL.lat}&lng=${SEOUL_CITY_HALL.lng}&radius=10`)
        .expect(200);

      expect(response.body.data.items.map((h) => h.name)).toEqual(['경복궁']);
    });

    it('"nearby"가 문화재 ID로 해석되지 않는다', async () => {
      // 라우트 등록 순서가 잘못되면 /heritages/:id 로 잡혀 404가 난다.
      await request(app)
        .get(`/api/heritages/nearby?lat=${SEOUL_CITY_HALL.lat}&lng=${SEOUL_CITY_HALL.lng}`)
        .expect(200);
    });
  });

  describe('축제 주변 문화재 - GET /api/festivals/:id/nearby-heritages', () => {
    let festival;

    beforeEach(async () => {
      const seoul = await Sido.findOne({ where: { code: '11' } });
      festival = await createFestival({
        name: '광화문축제',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        ...GYEONGBOKGUNG,
      });

      await Heritage.create({ sidoId: seoul.id, name: '경복궁', ...GYEONGBOKGUNG });
      await Heritage.create({ sidoId: seoul.id, name: '범어사', ...BUSAN });
    });

    it('축제 좌표를 기준으로 주변 문화재를 찾는다', async () => {
      const response = await request(app)
        .get(`/api/festivals/${festival.id}/nearby-heritages?radius=10`)
        .expect(200);

      expect(response.body.data.items.map((h) => h.name)).toEqual(['경복궁']);
    });

    it('없는 축제는 404', async () => {
      await request(app).get('/api/festivals/999999/nearby-heritages').expect(404);
    });

    it('좌표가 없는 축제는 400과 함께 이유를 알려준다', async () => {
      const noCoords = await createFestival({ name: '좌표없는축제' });

      const response = await request(app)
        .get(`/api/festivals/${noCoords.id}/nearby-heritages`)
        .expect(400);

      expect(response.body.message).toContain('좌표');
    });
  });
});
