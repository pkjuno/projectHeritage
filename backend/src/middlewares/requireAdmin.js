const userService = require('../services/user.service');
const AppError = require('../utils/AppError');

/**
 * 운영자(admin) 권한을 요구하는 미들웨어.
 * 반드시 authenticate 뒤에 등록해야 한다. (req.user가 채워져 있어야 함)
 *
 * 권한을 JWT payload에 넣지 않고 매 요청마다 DB에서 확인하는 이유:
 * 토큰에 role을 담으면 권한을 회수해도 기존 토큰이 만료될 때까지(기본 1시간)
 * 운영자 권한이 유지된다. 축제/문화재 삭제처럼 되돌리기 어려운 작업을 지키는
 * 검사이므로, 쿼리 한 번을 아끼는 것보다 즉시 반영되는 정확성이 중요하다.
 * (운영자 API는 호출량이 적어 부하도 문제되지 않는다)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.id) {
      throw new AppError(401, '인증 토큰이 필요합니다.');
    }

    const user = await userService.findById(req.user.id);

    // 탈퇴한 계정은 권한이 남아 있어도 거부한다.
    if (!user || user.status === 'withdrawn' || !user.isAdmin()) {
      throw new AppError(403, '운영자 권한이 필요합니다.');
    }

    // 이후 핸들러에서 재조회하지 않도록 조회한 회원을 실어 보낸다.
    req.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requireAdmin;
