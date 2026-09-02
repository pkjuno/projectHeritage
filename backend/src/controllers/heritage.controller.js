const heritageService = require('../services/heritage.service');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');

/**
 * [GET] /api/heritages
 * 문화재 목록 조회 컨트롤러. (query: sidoCode, keyword, designationType, page, limit)
 */
async function list(req, res, next) {
  try {
    const result = await heritageService.list(req.query);
    return success(res, 200, '문화재 목록 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/heritages/:id
 * 문화재 상세 조회 컨트롤러.
 */
async function getById(req, res, next) {
  try {
    const heritage = await heritageService.getById(req.params.id);
    return success(res, 200, '문화재 상세 조회 성공', heritage);
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/heritages
 * 문화재 등록 컨트롤러. (인증 필요)
 */
async function create(req, res, next) {
  try {
    const { sidoId, name } = req.body;
    if (!sidoId || !name) {
      throw new AppError(400, 'sidoId, name은 필수 입력값입니다.');
    }

    const heritage = await heritageService.create(req.body);
    return success(res, 201, '문화재 등록 성공', heritage);
  } catch (error) {
    return next(error);
  }
}

/**
 * [PUT] /api/heritages/:id
 * 문화재 정보 수정 컨트롤러. (인증 필요)
 */
async function update(req, res, next) {
  try {
    const heritage = await heritageService.update(req.params.id, req.body);
    return success(res, 200, '문화재 수정 성공', heritage);
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/heritages/:id
 * 문화재 삭제 컨트롤러. (인증 필요)
 */
async function remove(req, res, next) {
  try {
    await heritageService.remove(req.params.id);
    return success(res, 200, '문화재 삭제 성공');
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, getById, create, update, remove };
