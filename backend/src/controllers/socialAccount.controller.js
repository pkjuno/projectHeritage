const socialAccountService = require('../services/socialAccount.service');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');

/**
 * [GET] /api/users/me/social-accounts
 * 마이페이지 - 내 계정에 연결된 간편로그인 목록 조회 컨트롤러.
 */
async function list(req, res, next) {
  try {
    const socialAccounts = await socialAccountService.listByUserId(req.user.id);
    return success(res, 200, '연결된 간편로그인 목록 조회 성공', {
      supportedProviders: socialAccountService.SUPPORTED_PROVIDERS,
      socialAccounts,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/users/me/social-accounts/:provider
 * 마이페이지 - 간편로그인 연결 컨트롤러.
 * body.accessToken: Flutter 앱이 해당 SNS SDK로 로그인해 받은 Access Token
 */
async function link(req, res, next) {
  try {
    const { provider } = req.params;
    const { accessToken } = req.body;

    if (!accessToken) {
      throw new AppError(400, 'accessToken은 필수 입력값입니다.');
    }

    const socialAccount = await socialAccountService.link(req.user.id, provider, accessToken);
    return success(res, 201, '간편로그인이 연결되었습니다.', socialAccount);
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/users/me/social-accounts/:provider
 * 마이페이지 - 간편로그인 연결 해지 컨트롤러.
 */
async function unlink(req, res, next) {
  try {
    await socialAccountService.unlink(req.user.id, req.params.provider);
    return success(res, 200, '간편로그인 연결이 해지되었습니다.');
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, link, unlink };
