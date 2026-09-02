const { Op } = require('sequelize');
const Festival = require('../models/festival.model');
const Sido = require('../models/sido.model');
const AppError = require('../utils/AppError');
const { getMonthRange, eachDateInRange, intersectRange } = require('../utils/dateRange');

// 한 달치 응답에 담을 수 있는 최대 축제 수. (응답 폭주 방지)
const MAX_FESTIVALS_PER_MONTH = 500;

/**
 * 조회한 축제 목록을 "날짜 -> 축제 ID 배열" 형태의 캘린더 인덱스로 변환한다.
 *
 * 축제는 기간(startDate~endDate)을 가지므로 시작일 하루가 아니라
 * 진행 중인 모든 날짜에 표시되어야 한다. 다만 조회 대상 월을 벗어나는 날짜는 제외한다.
 *
 * 축제 객체 자체를 날짜마다 복사하면 한 달 내내 열리는 축제가 30번 중복되므로,
 * 목록은 한 번만 내려주고 날짜별로는 ID만 담는다.
 *
 * @param {Array<{id: number, startDate: string, endDate: string}>} festivals
 * @param {{startDate: string, endDate: string}} monthRange
 * @returns {Record<string, number[]>} 예: { '2026-11-01': [1, 5], '2026-11-02': [1] }
 */
function buildCalendarIndex(festivals, monthRange) {
  const days = {};

  for (const festival of festivals) {
    // 축제 기간과 조회 월의 교집합만 캘린더에 표시한다.
    const overlap = intersectRange(
      { start: festival.startDate, end: festival.endDate },
      { start: monthRange.startDate, end: monthRange.endDate }
    );

    if (!overlap) continue;

    for (const date of eachDateInRange(overlap.start, overlap.end)) {
      if (!days[date]) days[date] = [];
      days[date].push(festival.id);
    }
  }

  return days;
}

/**
 * year/month 파라미터를 검증하고 숫자로 변환한다.
 * @param {string|number} year
 * @param {string|number} month
 * @returns {{year: number, month: number}}
 */
function parseYearMonth(year, month) {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);

  if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2200) {
    throw new AppError(400, 'year는 1900~2200 사이의 값이어야 합니다.');
  }

  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    throw new AppError(400, 'month는 1~12 사이의 값이어야 합니다.');
  }

  return { year: parsedYear, month: parsedMonth };
}

/**
 * 특정 연/월에 진행되는 축제를 캘린더 형태로 조회한다.
 * 시도코드로 지역을 필터링할 수 있다.
 *
 * @param {{year: string|number, month: string|number, sidoCode?: string, keyword?: string}} query
 * @returns {Promise<{
 *   year: number, month: number, startDate: string, endDate: string,
 *   festivals: object[], days: Record<string, number[]>, truncated: boolean
 * }>}
 */
async function getMonthlyCalendar(query) {
  const { year, month } = parseYearMonth(query.year, query.month);
  const monthRange = getMonthRange(year, month);

  const where = {
    // 축제 기간이 조회 월과 하루라도 겹치는 건을 모두 가져온다.
    startDate: { [Op.lte]: monthRange.endDate },
    endDate: { [Op.gte]: monthRange.startDate },
  };

  if (query.keyword) {
    where.name = { [Op.like]: `%${query.keyword}%` };
  }

  const sidoInclude = { model: Sido, as: 'sido', attributes: ['id', 'code', 'name'] };
  if (query.sidoCode) {
    sidoInclude.where = { code: query.sidoCode };
  }

  const festivals = await Festival.findAll({
    where,
    include: [sidoInclude],
    // 캘린더 인덱스를 만들 때 필요한 필드 + 목록 표시에 필요한 최소 필드만 조회한다.
    attributes: ['id', 'name', 'sigungu', 'location', 'startDate', 'endDate', 'grade'],
    order: [
      ['startDate', 'ASC'],
      ['id', 'ASC'],
    ],
    // 상한을 넘겼는지 판단하기 위해 1건 더 조회한다.
    limit: MAX_FESTIVALS_PER_MONTH + 1,
  });

  const truncated = festivals.length > MAX_FESTIVALS_PER_MONTH;
  const items = truncated ? festivals.slice(0, MAX_FESTIVALS_PER_MONTH) : festivals;

  return {
    year,
    month,
    startDate: monthRange.startDate,
    endDate: monthRange.endDate,
    festivals: items,
    days: buildCalendarIndex(items, monthRange),
    // true면 해당 월에 축제가 너무 많아 일부만 내려간 것이므로, 지역/키워드 필터가 필요하다.
    truncated,
  };
}

module.exports = {
  getMonthlyCalendar,
  buildCalendarIndex,
  parseYearMonth,
  MAX_FESTIVALS_PER_MONTH,
};
