const { fail } = require('../utils/response');

/**
 * 정의되지 않은 라우트(404)에 접근했을 때 처리하는 미들웨어.
 * 모든 라우트 등록 이후, 에러 핸들러 이전에 등록해야 한다.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function notFoundHandler(req, res) {
  return fail(res, 404, `요청하신 경로를 찾을 수 없습니다: ${req.originalUrl}`);
}

module.exports = notFoundHandler;
