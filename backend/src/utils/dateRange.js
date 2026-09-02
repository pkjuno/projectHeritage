/**
 * 캘린더 계산에 사용하는 날짜 유틸.
 * 축제 기간은 DATEONLY('YYYY-MM-DD')로 다루므로, 타임존 영향을 받지 않도록
 * 모든 계산을 UTC 기준으로 수행한다.
 */

/**
 * 'YYYY-MM-DD' 문자열을 UTC 기준 Date로 변환한다.
 * @param {string} dateString
 * @returns {Date}
 */
function toUtcDate(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

/**
 * Date를 'YYYY-MM-DD' 문자열로 변환한다.
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * 'YYYY-MM-DD' 형식인지 검사한다. (달력상 실제 존재하는 날짜인지까지 확인)
 * @param {string} value
 * @returns {boolean}
 */
function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = toUtcDate(value);
  // 2026-02-31처럼 존재하지 않는 날짜는 다른 날짜로 보정되므로 원본과 비교해 걸러낸다.
  return !Number.isNaN(date.getTime()) && formatDate(date) === value;
}

/**
 * 해당 연/월의 시작일과 종료일을 구한다.
 * @param {number} year - 예: 2026
 * @param {number} month - 1~12
 * @returns {{startDate: string, endDate: string}}
 */
function getMonthRange(year, month) {
  const startDate = formatDate(new Date(Date.UTC(year, month - 1, 1)));
  // Date.UTC(year, month, 0)은 해당 월의 마지막 날을 가리킨다. (month는 1-based)
  const endDate = formatDate(new Date(Date.UTC(year, month, 0)));
  return { startDate, endDate };
}

/**
 * 시작일~종료일 사이의 모든 날짜를 'YYYY-MM-DD' 배열로 만든다.
 * 종료일이 시작일보다 빠르면 빈 배열을 반환한다.
 * @param {string} startDate
 * @param {string} endDate
 * @returns {string[]}
 */
function eachDateInRange(startDate, endDate) {
  const dates = [];
  const last = toUtcDate(endDate);

  for (let cursor = toUtcDate(startDate); cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(formatDate(cursor));
  }

  return dates;
}

/**
 * 두 기간이 겹치는 구간을 구한다. 겹치지 않으면 null.
 * 축제 기간과 조회 대상 월(月)의 교집합을 구할 때 사용한다.
 * @param {{start: string, end: string}} a
 * @param {{start: string, end: string}} b
 * @returns {{start: string, end: string}|null}
 */
function intersectRange(a, b) {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  // 'YYYY-MM-DD' 형식은 사전순 비교가 곧 날짜 비교와 같다.
  return start <= end ? { start, end } : null;
}

module.exports = {
  toUtcDate,
  formatDate,
  isValidDateString,
  getMonthRange,
  eachDateInRange,
  intersectRange,
};
