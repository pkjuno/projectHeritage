const tokenService = require('../services/token.service');
const AppError = require('../utils/AppError');

/**
 * Authorization 헤더의 Access Token을 검증하는 인증 미들웨어.
 * 로그인이 필요한 라우트(로그아웃, 회원탈퇴, 내 정보 조회 등)에 사용한다.
 * 검증에 성공하면 req.user에 { id, email } 을 담아 다음 핸들러로 넘긴다.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, '인증 토큰이 필요합니다.'));
  }

  const accessToken = authHeader.split(' ')[1];

  try {
    const payload = tokenService.verifyAccessToken(accessToken);
    req.user = { id: payload.id, email: payload.email };
    return next();
  } catch (error) {
    return next(new AppError(401, '유효하지 않거나 만료된 토큰입니다.'));
  }
}

module.exports = authenticate;
