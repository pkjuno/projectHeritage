const axios = require('axios');
const AppError = require('../utils/AppError');

/**
 * 카카오 사용자 정보 API를 호출해 프로필을 조회한다.
 * accessToken은 Flutter 앱이 kakao_flutter_sdk로 로그인한 뒤 발급받은 값을 그대로 전달받는다.
 * @param {string} accessToken - 카카오 OAuth Access Token
 * @returns {Promise<{providerId: string, email: string|null, name: string}>}
 */
async function getKakaoProfile(accessToken) {
  try {
    const { data } = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      providerId: String(data.id),
      email: data.kakao_account?.email ?? null,
      name: data.kakao_account?.profile?.nickname ?? '카카오사용자',
    };
  } catch (error) {
    throw new AppError(401, '카카오 인증에 실패했습니다.');
  }
}

/**
 * 네이버 사용자 정보 API를 호출해 프로필을 조회한다.
 * accessToken은 Flutter 앱이 flutter_naver_login으로 로그인한 뒤 발급받은 값을 그대로 전달받는다.
 * @param {string} accessToken - 네이버 OAuth Access Token
 * @returns {Promise<{providerId: string, email: string|null, name: string}>}
 */
async function getNaverProfile(accessToken) {
  try {
    const { data } = await axios.get('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const profile = data.response;
    return {
      providerId: String(profile.id),
      email: profile.email ?? null,
      name: profile.name ?? '네이버사용자',
    };
  } catch (error) {
    throw new AppError(401, '네이버 인증에 실패했습니다.');
  }
}

/**
 * 구글 사용자 정보 API를 호출해 프로필을 조회한다.
 * accessToken은 Flutter 앱이 google_sign_in으로 로그인한 뒤 발급받은 값을 그대로 전달받는다.
 * @param {string} accessToken - 구글 OAuth Access Token
 * @returns {Promise<{providerId: string, email: string|null, name: string}>}
 */
async function getGoogleProfile(accessToken) {
  try {
    const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      providerId: data.sub,
      email: data.email ?? null,
      name: data.name ?? '구글사용자',
    };
  } catch (error) {
    throw new AppError(401, '구글 인증에 실패했습니다.');
  }
}

// 지원하는 SNS 제공자 이름과 프로필 조회 함수를 매핑한다.
const PROVIDER_FETCHERS = {
  kakao: getKakaoProfile,
  naver: getNaverProfile,
  google: getGoogleProfile,
};

/**
 * provider 이름에 맞는 SNS 프로필 조회 함수를 찾아 실행한다.
 * @param {string} provider - 'naver' | 'kakao' | 'google'
 * @param {string} accessToken - 각 SNS의 OAuth Access Token
 * @returns {Promise<{providerId: string, email: string|null, name: string}>}
 */
async function getSocialProfile(provider, accessToken) {
  const fetchProfile = PROVIDER_FETCHERS[provider];
  if (!fetchProfile) {
    throw new AppError(400, '지원하지 않는 간편로그인 제공자입니다.');
  }
  return fetchProfile(accessToken);
}

module.exports = { getSocialProfile };
