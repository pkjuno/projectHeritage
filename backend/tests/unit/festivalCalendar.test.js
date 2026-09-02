const { buildCalendarIndex, parseYearMonth } = require('../../src/services/festivalCalendar.service');

/**
 * 캘린더의 핵심 로직: 기간을 가진 축제를 날짜별 인덱스로 펼치는 부분.
 * DB 없이 순수 함수만 검증한다.
 */
describe('festivalCalendar 서비스 (순수 로직)', () => {
  const november = { startDate: '2026-11-01', endDate: '2026-11-30' };

  describe('buildCalendarIndex - 축제 기간을 날짜별로 펼친다', () => {
    it('여러 날 진행되는 축제는 모든 날짜에 표시된다', () => {
      const days = buildCalendarIndex([{ id: 1, startDate: '2026-11-05', endDate: '2026-11-07' }], november);

      expect(days).toEqual({
        '2026-11-05': [1],
        '2026-11-06': [1],
        '2026-11-07': [1],
      });
    });

    it('하루짜리 축제는 그 날짜에만 표시된다', () => {
      const days = buildCalendarIndex([{ id: 2, startDate: '2026-11-15', endDate: '2026-11-15' }], november);

      expect(Object.keys(days)).toEqual(['2026-11-15']);
    });

    it('축제가 없는 날은 키 자체가 생기지 않는다', () => {
      const days = buildCalendarIndex([{ id: 1, startDate: '2026-11-05', endDate: '2026-11-05' }], november);

      expect(days['2026-11-06']).toBeUndefined();
    });

    it('같은 날 열리는 여러 축제가 모두 담긴다', () => {
      const days = buildCalendarIndex(
        [
          { id: 10, startDate: '2026-11-10', endDate: '2026-11-10' },
          { id: 11, startDate: '2026-11-09', endDate: '2026-11-11' },
          { id: 12, startDate: '2026-11-10', endDate: '2026-11-12' },
        ],
        november
      );

      expect(days['2026-11-10']).toEqual([10, 11, 12]);
    });

    it('빈 목록이면 빈 인덱스', () => {
      expect(buildCalendarIndex([], november)).toEqual({});
    });
  });

  describe('월 경계 처리 - 조회한 달을 벗어나는 날짜는 잘라낸다', () => {
    it('이전 달부터 시작된 축제는 월 첫날부터 표시된다', () => {
      const days = buildCalendarIndex([{ id: 3, startDate: '2026-10-29', endDate: '2026-11-02' }], november);

      expect(Object.keys(days)).toEqual(['2026-11-01', '2026-11-02']);
    });

    it('다음 달까지 이어지는 축제는 월 마지막 날까지만 표시된다', () => {
      const days = buildCalendarIndex([{ id: 4, startDate: '2026-11-29', endDate: '2026-12-03' }], november);

      expect(Object.keys(days)).toEqual(['2026-11-29', '2026-11-30']);
    });

    it('연중 진행되는 축제는 그 달의 모든 날에 표시된다', () => {
      const days = buildCalendarIndex([{ id: 5, startDate: '2026-01-01', endDate: '2026-12-31' }], november);
      const dates = Object.keys(days);

      expect(dates).toHaveLength(30);
      expect(dates[0]).toBe('2026-11-01');
      expect(dates[29]).toBe('2026-11-30');
    });

    it('조회한 달과 겹치지 않는 축제는 제외된다', () => {
      const days = buildCalendarIndex(
        [
          { id: 6, startDate: '2026-10-01', endDate: '2026-10-31' },
          { id: 7, startDate: '2026-12-01', endDate: '2026-12-31' },
        ],
        november
      );

      expect(days).toEqual({});
    });

    it('윤년 2월은 29일까지 펼쳐진다', () => {
      const days = buildCalendarIndex(
        [{ id: 20, startDate: '2028-02-01', endDate: '2028-02-29' }],
        { startDate: '2028-02-01', endDate: '2028-02-29' }
      );

      expect(Object.keys(days)).toHaveLength(29);
    });
  });

  describe('parseYearMonth - 파라미터 검증', () => {
    it('정상 값은 숫자로 변환된다', () => {
      expect(parseYearMonth('2026', '11')).toEqual({ year: 2026, month: 11 });
    });

    it('월 범위를 벗어나면 예외', () => {
      expect(() => parseYearMonth(2026, 0)).toThrow('month');
      expect(() => parseYearMonth(2026, 13)).toThrow('month');
    });

    it('숫자가 아니면 예외', () => {
      expect(() => parseYearMonth(2026, 'abc')).toThrow('month');
      expect(() => parseYearMonth('abc', 11)).toThrow('year');
    });

    it('연도 범위를 벗어나면 예외', () => {
      expect(() => parseYearMonth(1800, 11)).toThrow('year');
      expect(() => parseYearMonth(2300, 11)).toThrow('year');
    });
  });
});
