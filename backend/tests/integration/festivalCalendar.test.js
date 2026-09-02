const { request, app, resetDatabase, createFestival } = require('../helpers');

/**
 * 축제 캘린더 API.
 * 축제는 "기간"을 가지므로 진행 중인 모든 날짜에 표시되어야 하고,
 * 조회한 달을 벗어나는 구간은 잘려야 한다.
 */
describe('축제 캘린더 API', () => {
  let inMonth;
  let spanningPrev;
  let spanningNext;
  let outOfMonth;

  beforeEach(async () => {
    await resetDatabase();

    // 11월 안에서만 열리는 축제
    inMonth = await createFestival({ name: '서울빛초롱축제', startDate: '2026-11-05', endDate: '2026-11-07' });
    // 10월에 시작해 11월 초까지 이어지는 축제
    spanningPrev = await createFestival({ name: '가을단풍축제', startDate: '2026-10-28', endDate: '2026-11-02' });
    // 11월 말에 시작해 12월까지 이어지는 부산 축제
    spanningNext = await createFestival({
      name: '부산겨울빛축제',
      sidoCode: '21',
      startDate: '2026-11-29',
      endDate: '2026-12-05',
    });
    // 11월과 전혀 겹치지 않는 축제
    outOfMonth = await createFestival({
      name: '부산여름축제',
      sidoCode: '21',
      startDate: '2026-07-01',
      endDate: '2026-07-10',
    });
  });

  describe('월 단위 조회', () => {
    it('해당 월과 겹치는 축제만 반환한다', async () => {
      const response = await request(app)
        .get('/api/festivals/calendar?year=2026&month=11')
        .expect(200);

      const { startDate, endDate, festivals } = response.body.data;

      expect(startDate).toBe('2026-11-01');
      expect(endDate).toBe('2026-11-30');
      expect(festivals).toHaveLength(3);
      expect(festivals.map((f) => f.id)).not.toContain(outOfMonth.id);
    });

    it('여러 날 진행되는 축제는 모든 날짜에 표시된다', async () => {
      const response = await request(app).get('/api/festivals/calendar?year=2026&month=11');
      const { days } = response.body.data;

      expect(days['2026-11-05']).toContain(inMonth.id);
      expect(days['2026-11-06']).toContain(inMonth.id);
      expect(days['2026-11-07']).toContain(inMonth.id);
    });

    it('축제가 없는 날은 키 자체가 없다', async () => {
      const response = await request(app).get('/api/festivals/calendar?year=2026&month=11');

      expect(response.body.data.days['2026-11-20']).toBeUndefined();
    });
  });

  describe('월 경계 처리', () => {
    it('이전 달부터 이어진 축제는 그 달의 시작일부터만 표시된다', async () => {
      const response = await request(app).get('/api/festivals/calendar?year=2026&month=11');
      const { days } = response.body.data;

      expect(days['2026-11-01']).toContain(spanningPrev.id);
      expect(days['2026-11-02']).toContain(spanningPrev.id);
      expect(days['2026-11-03'] ?? []).not.toContain(spanningPrev.id);
    });

    it('다음 달까지 이어지는 축제는 그 달의 마지막 날까지만 표시된다', async () => {
      const response = await request(app).get('/api/festivals/calendar?year=2026&month=11');
      const { days } = response.body.data;

      expect(days['2026-11-29']).toContain(spanningNext.id);
      expect(days['2026-11-30']).toContain(spanningNext.id);
    });

    it('다음 달을 조회하면 이어지는 구간만 나온다', async () => {
      const response = await request(app).get('/api/festivals/calendar?year=2026&month=12');
      const { festivals, days } = response.body.data;

      expect(festivals).toHaveLength(1);
      expect(days['2026-12-05']).toContain(spanningNext.id);
      expect(days['2026-12-06']).toBeUndefined();
    });
  });

  describe('지역 필터', () => {
    it('시도코드로 해당 지역 축제만 조회한다', async () => {
      const response = await request(app)
        .get('/api/festivals/calendar?year=2026&month=11&sidoCode=11')
        .expect(200);

      const { festivals, days } = response.body.data;

      expect(festivals).toHaveLength(2); // 서울 축제 2건
      expect(days['2026-11-29']).toBeUndefined(); // 부산 축제는 캘린더에서도 빠진다
    });
  });

  describe('파라미터 검증', () => {
    it.each([
      ['month이 13', '?year=2026&month=13'],
      ['month이 0', '?year=2026&month=0'],
      ['month이 문자열', '?year=2026&month=abc'],
      ['year 누락', '?month=11'],
      ['month 누락', '?year=2026'],
    ])('%s 이면 400', async (_label, query) => {
      await request(app).get(`/api/festivals/calendar${query}`).expect(400);
    });
  });
});
