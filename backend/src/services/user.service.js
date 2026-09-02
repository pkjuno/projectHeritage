const User = require('../models/user.model');
const SocialAccount = require('../models/socialAccount.model');

/**
 * User 도메인의 DB 접근(Repository) 계층.
 * auth.service.js, profile.service.js 등 상위 비즈니스 로직에서
 * 이 함수들을 통해서만 users 테이블에 접근한다.
 */

// 조회 시 함께 가져올 연결된 SNS 계정 정보
const SOCIAL_ACCOUNT_INCLUDE = {
  model: SocialAccount,
  as: 'socialAccounts',
  attributes: ['id', 'provider', 'providerEmail', 'createdAt'],
};

/**
 * 이메일로 회원을 조회한다.
 * @param {string} email
 * @returns {Promise<User|null>}
 */
async function findByEmail(email) {
  return User.findOne({ where: { email } });
}

/**
 * PK로 회원을 조회한다.
 * @param {number} id
 * @returns {Promise<User|null>}
 */
async function findById(id) {
  return User.findByPk(id);
}

/**
 * PK로 회원을 조회하되, 연결된 간편로그인 목록을 함께 가져온다. (마이페이지용)
 * @param {number} id
 * @returns {Promise<User|null>}
 */
async function findByIdWithSocialAccounts(id) {
  return User.findByPk(id, { include: [SOCIAL_ACCOUNT_INCLUDE] });
}

/**
 * 일반(이메일/비밀번호) 회원가입 사용자를 생성한다.
 * @param {{email: string, hashedPassword: string, name: string, nickname?: string}} params
 * @returns {Promise<User>}
 */
async function createLocalUser({ email, hashedPassword, name, nickname }) {
  return User.create({ email, password: hashedPassword, name, nickname: nickname ?? name });
}

/**
 * 간편로그인으로 최초 로그인한 회원을 생성한다. (비밀번호 없음)
 * @param {{email: string, name: string, nickname?: string, transaction?: object}} params
 * @returns {Promise<User>}
 */
async function createSocialUser({ email, name, nickname, transaction }) {
  return User.create(
    { email, password: null, name, nickname: nickname ?? name },
    { transaction }
  );
}

/**
 * 회원의 Refresh Token(해시 값)을 갱신한다. null을 전달하면 로그아웃 처리된다.
 * @param {User} user
 * @param {string|null} hashedRefreshToken
 * @returns {Promise<User>}
 */
async function updateRefreshToken(user, hashedRefreshToken) {
  user.refreshToken = hashedRefreshToken;
  return user.save();
}

/**
 * 회원 정보(닉네임/이름/프로필 이미지)를 수정한다.
 * undefined인 항목은 변경하지 않는다.
 * @param {User} user
 * @param {{nickname?: string, name?: string, profileImageUrl?: string|null}} payload
 * @returns {Promise<User>}
 */
async function updateProfile(user, payload) {
  if (payload.nickname !== undefined) user.nickname = payload.nickname;
  if (payload.name !== undefined) user.name = payload.name;
  if (payload.profileImageUrl !== undefined) user.profileImageUrl = payload.profileImageUrl;
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
  findByEmail,
  findById,
  findByIdWithSocialAccounts,
  createLocalUser,
  createSocialUser,
  updateRefreshToken,
  updateProfile,
  markAsWithdrawn,
  SOCIAL_ACCOUNT_INCLUDE,
};
