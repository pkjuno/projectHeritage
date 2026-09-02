const { sequelize } = require('../config/database');
const userService = require('./user.service');
const socialAccountService = require('./socialAccount.service');
const tokenService = require('./token.service');
const oauthService = require('./oauth.service');
const { hash, compare } = require('../utils/hash');
const AppError = require('../utils/AppError');

/**
 * Access/Refresh Token 쌍을 발급하고, Refresh Token은 해시로 DB에 저장한다.
 * (탈취 대비를 위해 평문 그대로 저장하지 않는다)
 * @param {import('../models/user.model')} user
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
async function issueTokenPair(user) {
  const accessToken = tokenService.generateAccessToken(user);
  const refreshToken = tokenService.generateRefreshToken(user);

  const hashedRefreshToken = await hash(refreshToken);
  await userService.updateRefreshToken(user, hashedRefreshToken);

  return { accessToken, refreshToken };
}

/**
 * 일반 회원가입 처리.
 * @param {{email: string, password: string, name: string}} payload
 * @returns {Promise<import('../models/user.model')>} 생성된 회원
 */
async function signup({ email, password, name }) {
  const existingUser = await userService.findByEmail(email);
  if (existingUser) {
    throw new AppError(409, '이미 가입된 이메일입니다.');
  }

  const hashedPassword = await hash(password);
  return userService.createLocalUser({ email, hashedPassword, name });
}

/**
 * 일반 로그인 처리. 이메일/비밀번호 검증 후 토큰을 발급한다.
 * @param {{email: string, password: string}} payload
 * @returns {Promise<{accessToken: string, refreshToken: string, user: import('../models/user.model')}>}
 */
async function login({ email, password }) {
  const user = await userService.findByEmail(email);

  // 사용자가 없거나 이미 탈퇴한 계정이면 동일한 에러 메시지로 응답한다. (계정 존재 여부 노출 방지)
  if (!user || user.status === 'withdrawn') {
    throw new AppError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const isPasswordMatched = await compare(password, user.password);
  if (!isPasswordMatched) {
    throw new AppError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  const tokens = await issueTokenPair(user);
  return { ...tokens, user };
}

/**
 * 간편로그인 최초 이용 시 회원과 SNS 연결 정보를 함께 생성한다.
 * 두 테이블에 나눠 저장하므로 트랜잭션으로 묶는다.
 * @param {string} provider
 * @param {{providerId: string, email: string|null, name: string}} profile
 * @returns {Promise<import('../models/user.model')>}
 */
async function createUserFromSocialProfile(provider, profile) {
  // SNS가 이메일을 주지 않은 경우를 대비해 충돌하지 않는 대체 이메일을 만든다.
  const email = profile.email ?? `${provider}_${profile.providerId}@social.project-heritage`;

  // 이미 같은 이메일로 가입된 회원이 있으면 임의로 합치지 않는다.
  // (본인 확인 없이 자동 연결하면 계정 탈취에 악용될 수 있다)
  const duplicated = await userService.findByEmail(email);
  if (duplicated) {
    throw new AppError(
      409,
      '이미 같은 이메일로 가입된 계정이 있습니다. 기존 방식으로 로그인한 뒤 마이페이지에서 간편로그인을 연결해 주세요.'
    );
  }

  return sequelize.transaction(async (transaction) => {
    const user = await userService.createSocialUser({ email, name: profile.name, transaction });

    await socialAccountService.create({
      userId: user.id,
      provider,
      providerId: profile.providerId,
      providerEmail: profile.email,
      transaction,
    });

    return user;
  });
}

/**
 * 간편로그인 처리.
 * Flutter 앱이 각 SNS SDK(kakao_flutter_sdk, flutter_naver_login, google_sign_in)로
 * 먼저 로그인해 발급받은 accessToken을 그대로 전달받아, 해당 SNS API로 프로필을 조회한다.
 * 연결된 계정이 있으면 그 회원으로 로그인하고, 없으면 신규 회원을 생성한다.
 * @param {string} provider - 'naver' | 'kakao' | 'google'
 * @param {string} providerAccessToken - SNS 제공자로부터 발급받은 Access Token
 * @returns {Promise<{accessToken: string, refreshToken: string, user: import('../models/user.model')}>}
 */
async function socialLogin(provider, providerAccessToken) {
  const profile = await oauthService.getSocialProfile(provider, providerAccessToken);

  const socialAccount = await socialAccountService.findByProviderId(provider, profile.providerId);

  const user = socialAccount
    ? await userService.findById(socialAccount.userId)
    : await createUserFromSocialProfile(provider, profile);

  if (!user) {
    throw new AppError(404, '연결된 회원 정보를 찾을 수 없습니다.');
  }

  if (user.status === 'withdrawn') {
    throw new AppError(403, '탈퇴한 계정입니다.');
  }

  const tokens = await issueTokenPair(user);
  return { ...tokens, user };
}

/**
 * Refresh Token으로 새로운 Access Token을 재발급한다.
 * @param {string} refreshToken - 클라이언트가 보관 중인 Refresh Token
 * @returns {Promise<{accessToken: string}>}
 */
async function refreshAccessToken(refreshToken) {
  let payload;
  try {
    payload = tokenService.verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new AppError(401, '리프레시 토큰이 유효하지 않거나 만료되었습니다.');
  }

  const user = await userService.findById(payload.id);
  if (!user || !user.refreshToken) {
    throw new AppError(401, '다시 로그인해 주세요.');
  }

  // DB에 저장된 해시와 비교해, 로그아웃되었거나 탈취된 토큰이 아닌지 확인한다.
  const isTokenMatched = await compare(refreshToken, user.refreshToken);
  if (!isTokenMatched) {
    throw new AppError(401, '리프레시 토큰이 일치하지 않습니다.');
  }

  const accessToken = tokenService.generateAccessToken(user);
  return { accessToken };
}

/**
 * 로그아웃 처리. DB에 저장된 Refresh Token을 제거해 재사용을 막는다.
 * @param {number} userId - 로그인 중인 회원 ID (인증 미들웨어에서 추출)
 * @returns {Promise<void>}
 */
async function logout(userId) {
  const user = await userService.findById(userId);
  if (!user) return;
  await userService.updateRefreshToken(user, null);
}

/**
 * 회원 탈퇴 처리. 계정을 소프트 삭제(status=withdrawn) 하고 민감 정보를 제거한다.
 * @param {number} userId - 로그인 중인 회원 ID (인증 미들웨어에서 추출)
 * @returns {Promise<void>}
 */
async function withdraw(userId) {
  const user = await userService.findById(userId);
  if (!user) {
    throw new AppError(404, '사용자를 찾을 수 없습니다.');
  }
  await userService.markAsWithdrawn(user);
}

module.exports = { signup, login, socialLogin, refreshAccessToken, logout, withdraw };
