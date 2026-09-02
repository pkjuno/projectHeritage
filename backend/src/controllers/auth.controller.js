const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');
const { toSafeUser } = require('../utils/userSerializer');

/**
 * [POST] /api/auth/signup
 * 일반 회원가입 컨트롤러.
 */
async function signup(req, res, next) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      throw new AppError(400, 'email, password, name은 필수 입력값입니다.');
    }

    const user = await authService.signup({ email, password, name });
    return success(res, 201, '회원가입이 완료되었습니다.', toSafeUser(user));
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/auth/login
 * 일반(이메일/비밀번호) 로그인 컨트롤러.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(400, 'email, password는 필수 입력값입니다.');
    }

    const { accessToken, refreshToken, user } = await authService.login({ email, password });
    return success(res, 200, '로그인에 성공했습니다.', {
      accessToken,
      refreshToken,
      user: toSafeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/auth/social/:provider
 * SNS 간편로그인(네이버/카카오/구글) 컨트롤러.
 * body.accessToken: Flutter 앱이 각 SNS SDK로 로그인해 받은 Access Token
 */
async function socialLogin(req, res, next) {
  try {
    const { provider } = req.params;
    const { accessToken: providerAccessToken } = req.body;

    if (!providerAccessToken) {
      throw new AppError(400, 'accessToken은 필수 입력값입니다.');
    }

    const { accessToken, refreshToken, user } = await authService.socialLogin(
      provider,
      providerAccessToken
    );
    return success(res, 200, '간편로그인에 성공했습니다.', {
      accessToken,
      refreshToken,
      user: toSafeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/auth/refresh
 * Refresh Token으로 Access Token을 재발급하는 컨트롤러.
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError(400, 'refreshToken은 필수 입력값입니다.');
    }

    const result = await authService.refreshAccessToken(refreshToken);
    return success(res, 200, '토큰이 재발급되었습니다.', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/auth/logout
 * 로그아웃 컨트롤러. (인증 필요)
 */
async function logout(req, res, next) {
  try {
    await authService.logout(req.user.id);
    return success(res, 200, '로그아웃되었습니다.');
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/auth/withdraw
 * 회원 탈퇴 컨트롤러. (인증 필요)
 */
async function withdraw(req, res, next) {
  try {
    await authService.withdraw(req.user.id);
    return success(res, 200, '회원 탈퇴가 완료되었습니다.');
  } catch (error) {
    return next(error);
  }
}

module.exports = { signup, login, socialLogin, refresh, logout, withdraw };
