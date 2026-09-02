const {
  getMonthRange,
  eachDateInRange,
  intersectRange,
  isValidDateString,
} = require('../../src/utils/dateRange');

/**
 * 캘린더 정확성의 토대가 되는 날짜 계산 유틸.
 * DB 없이 순수 함수만 검증한다.
 */
describe('dateRange 유틸', () => {
  describe('getMonthRange - 월의 시작/종료일', () => {
    it('30일인 달', () => {
      expect(getMonthRange(2026, 11)).toEqual({ startDate: '2026-11-01', endDate: '2026-11-30' });
    });

    it('31일인 달', () => {
      expect(getMonthRange(2026, 12)).toEqual({ startDate: '2026-12-01', endDate: '2026-12-31' });
    });

    it('평년 2월은 28일까지', () => {
      expect(getMonthRange(2026, 2)).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
    });

    it('윤년 2월은 29일까지', () => {
      expect(getMonthRange(2028, 2)).toEqual({ startDate: '2028-02-01', endDate: '2028-02-29' });
    });
  });

  describe('eachDateInRange - 기간 펼치기', () => {
    it('하루짜리', () => {
      expect(eachDateInRange('2026-10-15', '2026-10-15')).toEqual(['2026-10-15']);
    });

    it('여러 날', () => {
      expect(eachDateInRange('2026-11-01', '2026-11-03')).toEqual([
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
      ]);
    });

    it('월 경계를 넘는 기간', () => {
      expect(eachDateInRange('2026-10-30', '2026-11-02')).toEqual([
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
        '2026-11-02',
      ]);
    });

    it('윤년 2월 29일을 건너뛰지 않는다', () => {
      expect(eachDateInRange('2028-02-28', '2028-03-01')).toEqual([
        '2028-02-28',
        '2028-02-29',
        '2028-03-01',
      ]);
    });

    it('연도 경계를 넘는 기간', () => {
      expect(eachDateInRange('2026-12-31', '2027-01-01')).toEqual(['2026-12-31', '2027-01-01']);
    });

    it('종료일이 시작일보다 빠르면 빈 배열', () => {
      expect(eachDateInRange('2026-11-05', '2026-11-01')).toEqual([]);
    });
  });

  describe('intersectRange - 축제 기간과 조회 월의 교집합', () => {
    const november = { start: '2026-11-01', end: '2026-11-30' };

    it('축제가 조회 월 전체를 포함하면 월 전체', () => {
      expect(intersectRange({ start: '2026-10-20', end: '2026-12-10' }, november)).toEqual(november);
    });

    it('축제가 월 안에 완전히 들어가면 축제 기간 그대로', () => {
      expect(intersectRange({ start: '2026-11-05', end: '2026-11-07' }, november)).toEqual({
        start: '2026-11-05',
        end: '2026-11-07',
      });
    });

    it('월 시작에 걸치면 앞부분이 잘린다', () => {
      expect(intersectRange({ start: '2026-10-28', end: '2026-11-03' }, november)).toEqual({
        start: '2026-11-01',
        end: '2026-11-03',
      });
    });

    it('월 끝에 걸치면 뒷부분이 잘린다', () => {
      expect(intersectRange({ start: '2026-11-28', end: '2026-12-05' }, november)).toEqual({
        start: '2026-11-28',
        end: '2026-11-30',
      });
    });

    it('하루만 겹쳐도 교집합이 생긴다', () => {
      expect(intersectRange({ start: '2026-11-30', end: '2026-12-31' }, november)).toEqual({
        start: '2026-11-30',
        end: '2026-11-30',
      });
    });

    it('겹치지 않으면 null', () => {
      expect(intersectRange({ start: '2026-10-01', end: '2026-10-31' }, november)).toBeNull();
      expect(intersectRange({ start: '2026-12-01', end: '2026-12-31' }, november)).toBeNull();
    });
  });

  describe('isValidDateString - 날짜 형식 검증', () => {
    it('정상 날짜를 통과시킨다', () => {
      expect(isValidDateString('2026-11-01')).toBe(true);
      expect(isValidDateString('2028-02-29')).toBe(true); // 윤년
    });

    it('달력에 없는 날짜를 거부한다', () => {
      expect(isValidDateString('2026-02-29')).toBe(false); // 평년 2월 29일
      expect(isValidDateString('2026-11-31')).toBe(false); // 11월은 30일까지
      expect(isValidDateString('2026-13-01')).toBe(false); // 13월
    });

    it('형식이 어긋나면 거부한다', () => {
      expect(isValidDateString('2026-1-1')).toBe(false);
      expect(isValidDateString('')).toBe(false);
      expect(isValidDateString(null)).toBe(false);
      expect(isValidDateString(20261101)).toBe(false);
    });
  });
});
