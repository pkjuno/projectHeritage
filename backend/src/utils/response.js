/**
 * API 성공 응답을 일관된 형식으로 반환한다.
 * @param {import('express').Response} res - Express 응답 객체
 * @param {number} statusCode - HTTP 상태 코드 (기본 200)
 * @param {string} message - 클라이언트에 전달할 메시지
 * @param {*} data - 응답 본문에 담을 데이터
 */
function success(res, statusCode = 200, message = 'OK', data = null) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * API 실패 응답을 일관된 형식으로 반환한다.
 * @param {import('express').Response} res - Express 응답 객체
 * @param {number} statusCode - HTTP 상태 코드 (기본 500)
 * @param {string} message - 에러 메시지
 */
function fail(res, statusCode = 500, message = 'Internal Server Error') {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = { success, fail };
