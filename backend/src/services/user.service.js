const User = require('../models/user.model');

/**
 * User 도메인의 DB 접근(Repository) 계층.
 * auth.service.js 등 상위 비즈니스 로직에서 이 함수들을 통해서만 User 테이블에 접근한다.
 */

/**
 * provider + email 조합으로 사용자를 조회한다. (주로 local 로그인에서 사용)
 * @param {string} email
 * @param {string} [provider='local']
 * @returns {Promise<User|null>}
 */
async function findByEmailAndProvider(email, provider = 'local') {
  return User.findOne({ where: { email, provider } });
}

/**
 * provider + providerId 조합으로 사용자를 조회한다. (SNS 로그인에서 사용)
 * @param {string} provider - 'naver' | 'kakao' | 'google'
 * @param {string} providerId - SNS 제공자가 발급한 고유 ID
 * @returns {Promise<User|null>}
 */
async function findByProviderId(provider, providerId) {
  return User.findOne({ where: { provider, providerId } });
}

/**
 * PK로 사용자를 조회한다.
 * @param {number} id
 * @returns {Promise<User|null>}
 */
async function findById(id) {
  return User.findByPk(id);
}

/**
 * 일반(local) 회원가입 사용자를 생성한다.
 * @param {{email: string, hashedPassword: string, name: string}} params
 * @returns {Promise<User>}
 */
async function createLocalUser({ email, hashedPassword, name }) {
  return User.create({ email, password: hashedPassword, name, provider: 'local' });
}

/**
 * SNS 간편로그인으로 최초 로그인한 사용자를 생성한다.
 * @param {{provider: string, providerId: string, email: string, name: string}} params
 * @returns {Promise<User>}
 */
async function createSocialUser({ provider, providerId, email, name }) {
  return User.create({ provider, providerId, email, name, password: null });
}

/**
 * 사용자의 Refresh Token(해시 값)을 갱신한다. null을 전달하면 로그아웃 처리된다.
 * @param {User} user
 * @param {string|null} hashedRefreshToken
 * @returns {Promise<User>}
 */
async function updateRefreshToken(user, hashedRefreshToken) {
  user.refreshToken = hashedRefreshToken;
  return user.save();
}

/**
 * 회원 탈퇴 처리. 상태를 withdrawn으로 바꾸고 민감 정보를 제거한다.
 * @param {User} user
 * @returns {Promise<User>}
 */
async function markAsWithdrawn(user) {
  user.status = 'withdrawn';
  user.withdrawnAt = new Date();
  user.refreshToken = null;
  user.password = null;
  return user.save();
}

module.exports = {
  findByEmailAndProvider,
  findByProviderId,
  findById,
  createLocalUser,
  createSocialUser,
  updateRefreshToken,
  markAsWithdrawn,
};
