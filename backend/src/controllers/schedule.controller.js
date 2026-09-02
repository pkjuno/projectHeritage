const scheduleService = require('../services/schedule.service');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');

/**
 * [GET] /api/users/me/schedules
 * 내 축제 일정 목록 조회 컨트롤러. (query: from, to)
 */
async function list(req, res, next) {
  try {
    const schedules = await scheduleService.list(req.user.id, req.query);
    return success(res, 200, '내 일정 조회 성공', schedules);
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/users/me/schedules
 * 축제 방문 일정 등록 컨트롤러. (body: festivalId, visitDate, memo)
 */
async function create(req, res, next) {
  try {
    const { festivalId, visitDate, memo } = req.body;

    if (!festivalId || !visitDate) {
      throw new AppError(400, 'festivalId, visitDate는 필수 입력값입니다.');
    }

    const schedule = await scheduleService.create(req.user.id, {
      festivalId: Number(festivalId),
      visitDate,
      memo,
    });
    return success(res, 201, '일정이 등록되었습니다.', schedule);
  } catch (error) {
    return next(error);
  }
}

/**
 * [PATCH] /api/users/me/schedules/:id
 * 일정 수정 컨트롤러. (body: visitDate, memo)
 */
async function update(req, res, next) {
  try {
    const { visitDate, memo } = req.body;
    const schedule = await scheduleService.update(req.user.id, Number(req.params.id), {
      visitDate,
      memo,
    });
    return success(res, 200, '일정이 수정되었습니다.', schedule);
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/users/me/schedules/:id
 * 일정 삭제 컨트롤러.
 */
async function remove(req, res, next) {
  try {
    await scheduleService.remove(req.user.id, Number(req.params.id));
    return success(res, 200, '일정이 삭제되었습니다.');
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, update, remove };
