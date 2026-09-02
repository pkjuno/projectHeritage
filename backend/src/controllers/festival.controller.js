const festivalService = require('../services/festival.service');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');

/**
 * [GET] /api/festivals
 * 지역축제 목록 조회 컨트롤러. (query: sidoCode, keyword, from, to, page, limit)
 */
async function list(req, res, next) {
  try {
    const result = await festivalService.list(req.query);
    return success(res, 200, '지역축제 목록 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/festivals/:id
 * 지역축제 상세 조회 컨트롤러.
 */
async function getById(req, res, next) {
  try {
    const festival = await festivalService.getById(req.params.id);
    return success(res, 200, '지역축제 상세 조회 성공', festival);
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/festivals
 * 지역축제 등록 컨트롤러. (인증 필요)
 */
async function create(req, res, next) {
  try {
    const { sidoId, name, startDate, endDate } = req.body;
    if (!sidoId || !name || !startDate || !endDate) {
      throw new AppError(400, 'sidoId, name, startDate, endDate는 필수 입력값입니다.');
    }

    const festival = await festivalService.create(req.body);
    return success(res, 201, '지역축제 등록 성공', festival);
  } catch (error) {
    return next(error);
  }
}

/**
 * [PUT] /api/festivals/:id
 * 지역축제 정보 수정 컨트롤러. (인증 필요)
 */
async function update(req, res, next) {
  try {
    const festival = await festivalService.update(req.params.id, req.body);
    return success(res, 200, '지역축제 수정 성공', festival);
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/festivals/:id
 * 지역축제 삭제 컨트롤러. (인증 필요)
 */
async function remove(req, res, next) {
  try {
    await festivalService.remove(req.params.id);
    return success(res, 200, '지역축제 삭제 성공');
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, getById, create, update, remove };
