const profileService = require('../services/profile.service');
const { success } = require('../utils/response');
const { toSafeUser } = require('../utils/userSerializer');

/**
 * [GET] /api/users/me
 * 마이페이지 - 내 회원정보와 연결된 간편로그인 목록을 조회하는 컨트롤러.
 */
async function getMe(req, res, next) {
  try {
    const user = await profileService.getMyPage(req.user.id);
    return success(res, 200, '내 정보 조회 성공', toSafeUser(user));
  } catch (error) {
    return next(error);
  }
}

/**
 * [PATCH] /api/users/me
 * 마이페이지 - 회원정보(닉네임/이름) 수정 컨트롤러.
 */
async function updateMe(req, res, next) {
  try {
    const { nickname, name } = req.body;
    await profileService.updateMyInfo(req.user.id, { nickname, name });

    // 수정 후 연결된 간편로그인까지 포함한 최신 정보를 함께 내려준다.
    const user = await profileService.getMyPage(req.user.id);
    return success(res, 200, '회원정보가 수정되었습니다.', toSafeUser(user));
  } catch (error) {
    return next(error);
  }
}

/**
 * [PUT] /api/users/me/profile-image
 * 마이페이지 - 프로필 이미지 등록/수정 컨트롤러. (multipart/form-data, 필드명: image)
 */
async function updateProfileImage(req, res, next) {
  try {
    await profileService.changeProfileImage(req.user.id, req.file);

    const user = await profileService.getMyPage(req.user.id);
    return success(res, 200, '프로필 이미지가 등록되었습니다.', toSafeUser(user));
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/users/me/profile-image
 * 마이페이지 - 프로필 이미지 삭제 컨트롤러.
 */
async function deleteProfileImage(req, res, next) {
  try {
    await profileService.removeProfileImage(req.user.id);

    const user = await profileService.getMyPage(req.user.id);
    return success(res, 200, '프로필 이미지가 삭제되었습니다.', toSafeUser(user));
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMe, updateMe, updateProfileImage, deleteProfileImage };
