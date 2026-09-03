const boardCategoryService = require('../services/boardCategory.service');
const { success } = require('../utils/response');

/**
 * [GET] /api/community/categories
 * 게시판 목록 조회 컨트롤러.
 */
async function list(req, res, next) {
  try {
    const categories = await boardCategoryService.list();
    return success(res, 200, '게시판 목록 조회 성공', categories);
  } catch (error) {
    return next(error);
  }
}

module.exports = { list };
