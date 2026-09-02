/**
 * 의도된(예측 가능한) 비즈니스 에러를 표현하는 클래스.
 * statusCode를 함께 담아 errorHandler 미들웨어에서 그대로 HTTP 응답에 사용한다.
 */
class AppError extends Error {
  /**
   * @param {number} statusCode - HTTP 상태 코드
   * @param {string} message - 클라이언트에 전달할 에러 메시지
   */
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

module.exports = AppError;
