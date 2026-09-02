const config = require('../config');
const { fail } = require('../utils/response');

/**
 * 애플리케이션 전역 에러를 처리하는 미들웨어.
 * 라우트/컨트롤러에서 next(error)로 전달된 에러가 최종적으로 이곳에서 처리된다.
 * Express 에러 핸들러는 반드시 (err, req, res, next) 4개의 인자를 가져야 한다.
 * @param {Error} err - 발생한 에러 객체
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, next) {
  // 개발 환경에서는 콘솔에 스택 트레이스를 남겨 디버깅을 돕는다.
  if (config.env === 'development') {
    console.error(err.stack);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return fail(res, statusCode, message);
}

module.exports = errorHandler;
