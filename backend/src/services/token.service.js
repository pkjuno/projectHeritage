const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 로그인 상태를 짧게 증명하는 Access Token을 발급한다.
 * 클라이언트는 이 토큰을 매 요청의 Authorization 헤더에 담아 보낸다.
 * @param {{id: number, email: string}} user - 토큰에 담을 사용자 정보
 * @returns {string} 서명된 JWT Access Token
 */
function generateAccessToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

/**
 * Access Token 재발급에 사용하는 장기 Refresh Token을 발급한다.
 * @param {{id: number}} user - 토큰에 담을 사용자 정보
 * @returns {string} 서명된 JWT Refresh Token
 */
function generateRefreshToken(user) {
  return jwt.sign({ id: user.id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

/**
 * Access Token의 유효성을 검증하고 payload를 반환한다.
 * 만료/변조된 토큰이면 예외를 던진다.
 * @param {string} token
 * @returns {{id: number, email: string}}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/**
 * Refresh Token의 유효성을 검증하고 payload를 반환한다.
 * @param {string} token
 * @returns {{id: number}}
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
