const userService = require('../services/user.service');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const { toSafeUser } = require('../utils/userSerializer');

/**
 * [GET] /api/users/me
 * 현재 로그인된(인증 토큰의 주인인) 사용자의 정보를 조회하는 컨트롤러.
 */
async function getMe(req, res, next) {
  try {
    const user = await userService.findById(req.user.id);

    if (!user) {
      throw new AppError(404, '사용자를 찾을 수 없습니다.');
    }

    return success(res, 200, '내 정보 조회 성공', toSafeUser(user));
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMe };
