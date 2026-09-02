const bcrypt = require('bcryptjs');

// bcrypt 해시 강도 (salt rounds). 값이 클수록 안전하지만 연산 비용이 커진다.
const SALT_ROUNDS = 10;

/**
 * 평문 문자열을 bcrypt로 해시한다.
 * 비밀번호와 Refresh Token 저장에 공통으로 사용한다.
 * @param {string} plain - 해시할 원본 문자열
 * @returns {Promise<string>} 해시된 문자열
 */
async function hash(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * 평문과 해시 값을 비교한다.
 * @param {string} plain - 비교할 원본 문자열
 * @param {string|null} hashed - 저장되어 있던 해시 값
 * @returns {Promise<boolean>} 일치 여부
 */
async function compare(plain, hashed) {
  if (!hashed) return false;
  return bcrypt.compare(plain, hashed);
}

module.exports = { hash, compare };
