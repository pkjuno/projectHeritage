const tokenService = require('../services/token.service');

/**
 * 토큰이 있으면 회원 정보를 붙이고, 없거나 유효하지 않으면 그냥 통과시키는 미들웨어.
 *
 * 축제 목록/상세처럼 비회원도 볼 수 있지만, 로그인한 경우에는
 * "내가 찜했는지(isWishlisted)" 같은 개인화 정보를 함께 내려줘야 하는 API에 사용한다.
 * (인증을 강제하는 authenticate와 달리 401을 반환하지 않는다)
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const payload = tokenService.verifyAccessToken(authHeader.split(' ')[1]);
    req.user = { id: payload.id, email: payload.email };
  } catch (error) {
    // 만료/위조 토큰이어도 비회원으로 간주하고 계속 진행한다.
    req.user = undefined;
  }

  return next();
}

module.exports = optionalAuthenticate;
