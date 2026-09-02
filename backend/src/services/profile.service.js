const userService = require('./user.service');
const AppError = require('../utils/AppError');
const { toProfileImageUrl, removeProfileImageFile } = require('../middlewares/upload');

/**
 * 마이페이지에서 사용하는 회원정보/프로필 관련 비즈니스 로직.
 */

/**
 * 로그인한 회원을 조회한다. 없거나 탈퇴한 계정이면 예외를 던진다.
 * @param {number} userId
 * @returns {Promise<import('../models/user.model')>}
 */
async function getActiveUser(userId) {
  const user = await userService.findById(userId);

  if (!user || user.status === 'withdrawn') {
    throw new AppError(404, '사용자를 찾을 수 없습니다.');
  }

  return user;
}

/**
 * 마이페이지 메인: 회원정보 + 연결된 간편로그인 목록을 함께 조회한다.
 * @param {number} userId
 * @returns {Promise<import('../models/user.model')>}
 */
async function getMyPage(userId) {
  const user = await userService.findByIdWithSocialAccounts(userId);

  if (!user || user.status === 'withdrawn') {
    throw new AppError(404, '사용자를 찾을 수 없습니다.');
  }

  return user;
}

/**
 * 회원정보(닉네임/이름)를 수정한다.
 * @param {number} userId
 * @param {{nickname?: string, name?: string}} payload
 * @returns {Promise<import('../models/user.model')>} 수정된 회원
 */
async function updateMyInfo(userId, payload) {
  const user = await getActiveUser(userId);

  const updates = {};

  if (payload.nickname !== undefined) {
    const nickname = String(payload.nickname).trim();
    if (nickname.length < 2 || nickname.length > 30) {
      throw new AppError(400, '닉네임은 2자 이상 30자 이하로 입력해 주세요.');
    }
    updates.nickname = nickname;
  }

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (name.length < 1 || name.length > 50) {
      throw new AppError(400, '이름은 1자 이상 50자 이하로 입력해 주세요.');
    }
    updates.name = name;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, '수정할 항목이 없습니다. (nickname, name)');
  }

  return userService.updateProfile(user, updates);
}

/**
 * 프로필 이미지를 등록하거나 교체한다. 기존 이미지 파일은 삭제한다.
 * @param {number} userId
 * @param {Express.Multer.File} file - multer가 저장한 업로드 파일
 * @returns {Promise<import('../models/user.model')>} 수정된 회원
 */
async function changeProfileImage(userId, file) {
  if (!file) {
    throw new AppError(400, '업로드할 이미지 파일(image)이 필요합니다.');
  }

  const user = await getActiveUser(userId);
  const previousImageUrl = user.profileImageUrl;

  const updated = await userService.updateProfile(user, {
    profileImageUrl: toProfileImageUrl(file.filename),
  });

  // 새 이미지 저장에 성공한 뒤에 기존 파일을 정리한다. (실패 시 원본 유실 방지)
  await removeProfileImageFile(previousImageUrl);

  return updated;
}

/**
 * 프로필 이미지를 삭제한다. (기본 이미지 상태로 되돌림)
 * @param {number} userId
 * @returns {Promise<import('../models/user.model')>} 수정된 회원
 */
async function removeProfileImage(userId) {
  const user = await getActiveUser(userId);

  if (!user.profileImageUrl) {
    throw new AppError(400, '등록된 프로필 이미지가 없습니다.');
  }

  const previousImageUrl = user.profileImageUrl;
  const updated = await userService.updateProfile(user, { profileImageUrl: null });

  await removeProfileImageFile(previousImageUrl);

  return updated;
}

/**
 * 푸시 알림 수신 설정과 기기 토큰을 저장한다.
 * @param {number} userId
 * @param {{pushEnabled?: boolean, pushToken?: string|null}} payload
 * @returns {Promise<import('../models/user.model')>}
 */
async function updatePushSettings(userId, { pushEnabled, pushToken }) {
  const user = await getActiveUser(userId);

  if (pushEnabled !== undefined) {
    if (typeof pushEnabled !== 'boolean') {
      throw new AppError(400, 'pushEnabled는 true/false 값이어야 합니다.');
    }
    user.pushEnabled = pushEnabled;
  }

  if (pushToken !== undefined) {
    // 로그아웃 시 기기 토큰을 지울 수 있도록 null/빈 문자열을 허용한다.
    user.pushToken = pushToken ? String(pushToken) : null;
  }

  return user.save();
}

module.exports = {
  getMyPage,
  updateMyInfo,
  changeProfileImage,
  removeProfileImage,
  updatePushSettings,
};
