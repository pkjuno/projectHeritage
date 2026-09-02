const userService = require('../services/user.service');
const { success, fail } = require('../utils/response');

/**
 * [GET] /api/users
 * 전체 사용자 목록을 조회하는 컨트롤러.
 */
async function getUsers(req, res, next) {
  try {
    const users = await userService.getUsers();
    return success(res, 200, '사용자 목록 조회 성공', users);
  } catch (error) {
    // 에러는 다음 미들웨어(errorHandler)로 위임한다.
    return next(error);
  }
}

/**
 * [GET] /api/users/:id
 * 특정 사용자를 조회하는 컨트롤러.
 */
async function getUserById(req, res, next) {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);

    if (!user) {
      return fail(res, 404, '해당 사용자를 찾을 수 없습니다.');
    }

    return success(res, 200, '사용자 조회 성공', user);
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/users
 * 새로운 사용자를 생성하는 컨트롤러.
 */
async function createUser(req, res, next) {
  try {
    const { name, email } = req.body;

    // 필수 값 검증
    if (!name || !email) {
      return fail(res, 400, 'name, email은 필수 입력값입니다.');
    }

    const newUser = await userService.createUser({ name, email });
    return success(res, 201, '사용자 생성 성공', newUser);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getUsers, getUserById, createUser };
