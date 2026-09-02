const { Op } = require('sequelize');
const FestivalSchedule = require('../models/festivalSchedule.model');
const Festival = require('../models/festival.model');
const Sido = require('../models/sido.model');
const AppError = require('../utils/AppError');
const { isValidDateString } = require('../utils/dateRange');

// 일정 목록에 함께 내려줄 축제 정보
const FESTIVAL_INCLUDE = {
  model: Festival,
  as: 'festival',
  include: [{ model: Sido, as: 'sido', attributes: ['id', 'code', 'name'] }],
};

/**
 * 방문일이 축제 개최 기간 안에 있는지 검증한다.
 * 축제가 열리지 않는 날짜로 일정을 잡는 것을 막는다.
 * @param {Festival} festival
 * @param {string} visitDate - 'YYYY-MM-DD'
 */
function assertVisitDateInPeriod(festival, visitDate) {
  if (!isValidDateString(visitDate)) {
    throw new AppError(400, 'visitDate는 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.');
  }

  // DATEONLY 값은 'YYYY-MM-DD' 문자열이므로 사전순 비교가 곧 날짜 비교와 같다.
  if (visitDate < festival.startDate || visitDate > festival.endDate) {
    throw new AppError(
      400,
      `방문일은 축제 기간(${festival.startDate} ~ ${festival.endDate}) 안에서 선택해 주세요.`
    );
  }
}

/**
 * 내 일정 1건을 조회한다. 없거나 남의 일정이면 404.
 * (타인의 일정 ID를 넣어도 존재 여부가 드러나지 않도록 동일하게 404를 반환한다)
 * @param {number} userId
 * @param {number} scheduleId
 * @returns {Promise<FestivalSchedule>}
 */
async function getMyScheduleOrThrow(userId, scheduleId) {
  const schedule = await FestivalSchedule.findOne({ where: { id: scheduleId, userId } });

  if (!schedule) {
    throw new AppError(404, '일정을 찾을 수 없습니다.');
  }

  return schedule;
}

/**
 * 내 일정 목록을 조회한다. from/to로 기간을 좁힐 수 있다. (캘린더 표시에 사용)
 * @param {number} userId
 * @param {{from?: string, to?: string}} query
 * @returns {Promise<FestivalSchedule[]>}
 */
async function list(userId, query = {}) {
  const where = { userId };

  if (query.from || query.to) {
    where.visitDate = {};
    if (query.from) {
      if (!isValidDateString(query.from)) throw new AppError(400, 'from은 YYYY-MM-DD 형식이어야 합니다.');
      where.visitDate[Op.gte] = query.from;
    }
    if (query.to) {
      if (!isValidDateString(query.to)) throw new AppError(400, 'to는 YYYY-MM-DD 형식이어야 합니다.');
      where.visitDate[Op.lte] = query.to;
    }
  }

  return FestivalSchedule.findAll({
    where,
    include: [FESTIVAL_INCLUDE],
    order: [
      ['visitDate', 'ASC'],
      ['id', 'ASC'],
    ],
  });
}

/**
 * 축제 방문 일정을 등록한다.
 * @param {number} userId
 * @param {{festivalId: number, visitDate: string, memo?: string}} payload
 * @returns {Promise<FestivalSchedule>}
 */
async function create(userId, { festivalId, visitDate, memo }) {
  const festival = await Festival.findByPk(festivalId);
  if (!festival) {
    throw new AppError(404, '지역축제 정보를 찾을 수 없습니다.');
  }

  assertVisitDateInPeriod(festival, visitDate);

  const duplicated = await FestivalSchedule.findOne({ where: { userId, festivalId, visitDate } });
  if (duplicated) {
    throw new AppError(409, '같은 날짜에 이미 등록된 일정입니다.');
  }

  return FestivalSchedule.create({ userId, festivalId, visitDate, memo: memo ?? null });
}

/**
 * 일정의 방문일/메모를 수정한다.
 * @param {number} userId
 * @param {number} scheduleId
 * @param {{visitDate?: string, memo?: string}} payload
 * @returns {Promise<FestivalSchedule>}
 */
async function update(userId, scheduleId, payload) {
  const schedule = await getMyScheduleOrThrow(userId, scheduleId);
  const updates = {};

  if (payload.visitDate !== undefined) {
    const festival = await Festival.findByPk(schedule.festivalId);
    if (!festival) {
      throw new AppError(404, '지역축제 정보를 찾을 수 없습니다.');
    }

    assertVisitDateInPeriod(festival, payload.visitDate);

    // 날짜를 옮겼을 때 기존 일정과 겹치지 않는지 확인한다.
    const duplicated = await FestivalSchedule.findOne({
      where: {
        userId,
        festivalId: schedule.festivalId,
        visitDate: payload.visitDate,
        id: { [Op.ne]: scheduleId },
      },
    });

    if (duplicated) {
      throw new AppError(409, '같은 날짜에 이미 등록된 일정입니다.');
    }

    updates.visitDate = payload.visitDate;
  }

  if (payload.memo !== undefined) {
    updates.memo = payload.memo;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, '수정할 항목이 없습니다. (visitDate, memo)');
  }

  return schedule.update(updates);
}

/**
 * 일정을 삭제한다.
 * @param {number} userId
 * @param {number} scheduleId
 * @returns {Promise<void>}
 */
async function remove(userId, scheduleId) {
  const schedule = await getMyScheduleOrThrow(userId, scheduleId);
  await schedule.destroy();
}

module.exports = { list, create, update, remove, assertVisitDateInPeriod };
