const SocialAccount = require('../models/socialAccount.model');
const userService = require('./user.service');
const oauthService = require('./oauth.service');
const AppError = require('../utils/AppError');

// 지원하는 간편로그인 제공자
const SUPPORTED_PROVIDERS = ['naver', 'kakao', 'google'];

/**
 * provider 값이 지원 대상인지 검증한다.
 * @param {string} provider
 */
function assertSupportedProvider(provider) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new AppError(400, '지원하지 않는 간편로그인 제공자입니다.');
  }
}

/**
 * SNS 고유 ID로 연결 정보를 조회한다. (간편로그인 시 회원 식별에 사용)
 * @param {string} provider
 * @param {string} providerId
 * @returns {Promise<SocialAccount|null>}
 */
async function findByProviderId(provider, providerId) {
  return SocialAccount.findOne({ where: { provider, providerId } });
}

/**
 * 특정 회원에게 연결된 간편로그인 목록을 조회한다.
 * @param {number} userId
 * @returns {Promise<SocialAccount[]>}
 */
async function listByUserId(userId) {
  return SocialAccount.findAll({
    where: { userId },
    attributes: ['id', 'provider', 'providerEmail', 'createdAt'],
    order: [['createdAt', 'ASC']],
  });
}

/**
 * 간편로그인 연결 정보를 생성한다.
 * @param {{userId: number, provider: string, providerId: string, providerEmail?: string|null, transaction?: object}} params
 * @returns {Promise<SocialAccount>}
 */
async function create({ userId, provider, providerId, providerEmail, transaction }) {
  return SocialAccount.create(
    { userId, provider, providerId, providerEmail: providerEmail ?? null },
    { transaction }
  );
}

/**
 * 마이페이지: 로그인한 회원의 계정에 간편로그인을 연결한다.
 * Flutter 앱이 각 SNS SDK로 로그인해 받은 accessToken을 전달받아,
 * 해당 SNS API로 본인 확인 후 연결 정보를 저장한다.
 * @param {number} userId - 로그인 중인 회원 ID
 * @param {string} provider - 'naver' | 'kakao' | 'google'
 * @param {string} providerAccessToken - SNS에서 발급받은 Access Token
 * @returns {Promise<SocialAccount>} 생성된 연결 정보
 */
async function link(userId, provider, providerAccessToken) {
  assertSupportedProvider(provider);

  const profile = await oauthService.getSocialProfile(provider, providerAccessToken);

  // 이미 다른 곳에 연결된 SNS 계정인지 확인한다.
  const existingLink = await findByProviderId(provider, profile.providerId);
  if (existingLink) {
    if (existingLink.userId === userId) {
      throw new AppError(409, '이미 연결되어 있는 계정입니다.');
    }
    throw new AppError(409, '다른 회원이 이미 연결한 SNS 계정입니다.');
  }

  // 한 회원이 같은 제공자를 중복으로 연결하지 못하도록 확인한다.
  const alreadyLinkedProvider = await SocialAccount.findOne({ where: { userId, provider } });
  if (alreadyLinkedProvider) {
    throw new AppError(409, '이미 해당 SNS가 연결되어 있습니다. 먼저 연결을 해지해 주세요.');
  }

  return create({
    userId,
    provider,
    providerId: profile.providerId,
    providerEmail: profile.email,
  });
}

/**
 * 마이페이지: 연결된 간편로그인을 해지한다.
 * 해지 후 로그인할 수단이 하나도 남지 않는 경우(비밀번호도 없고 다른 SNS 연결도 없음)에는
 * 계정 잠김을 막기 위해 해지를 거부한다.
 * @param {number} userId - 로그인 중인 회원 ID
 * @param {string} provider - 해지할 제공자
 * @returns {Promise<void>}
 */
async function unlink(userId, provider) {
  assertSupportedProvider(provider);

  const socialAccount = await SocialAccount.findOne({ where: { userId, provider } });
  if (!socialAccount) {
    throw new AppError(404, '연결되어 있지 않은 간편로그인입니다.');
  }

  const user = await userService.findById(userId);
  if (!user) {
    throw new AppError(404, '사용자를 찾을 수 없습니다.');
  }

  const linkedCount = await SocialAccount.count({ where: { userId } });

  // 비밀번호가 없고 이번이 마지막 SNS 연결이면 로그인 수단이 사라지므로 해지할 수 없다.
  if (!user.hasPassword() && linkedCount <= 1) {
    throw new AppError(
      400,
      '마지막 로그인 수단은 해지할 수 없습니다. 비밀번호를 설정하거나 다른 간편로그인을 먼저 연결해 주세요.'
    );
  }

  await socialAccount.destroy();
}

module.exports = {
  SUPPORTED_PROVIDERS,
  findByProviderId,
  listByUserId,
  create,
  link,
  unlink,
};
