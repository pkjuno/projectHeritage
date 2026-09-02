const sidoService = require('../services/sido.service');
const { success } = require('../utils/response');

/**
 * [GET] /api/sidos
 * 광역시도 마스터 목록 조회 컨트롤러.
 */
async function getSidos(req, res, next) {
  try {
    const sidos = await sidoService.list();
    return success(res, 200, '시도 목록 조회 성공', sidos);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSidos };
