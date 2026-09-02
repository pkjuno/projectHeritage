const wishlistService = require('../services/wishlist.service');
const { success } = require('../utils/response');

/**
 * [GET] /api/users/me/wishlists
 * 내 위시리스트 목록 조회 컨트롤러.
 */
async function list(req, res, next) {
  try {
    const result = await wishlistService.list(req.user.id, req.query);
    return success(res, 200, '위시리스트 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/users/me/wishlists/:festivalId
 * 축제를 위시리스트에 추가하는 컨트롤러.
 */
async function add(req, res, next) {
  try {
    const wishlist = await wishlistService.add(req.user.id, Number(req.params.festivalId));
    return success(res, 201, '위시리스트에 추가되었습니다.', wishlist);
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/users/me/wishlists/:festivalId
 * 위시리스트에서 축제를 제거하는 컨트롤러.
 */
async function remove(req, res, next) {
  try {
    await wishlistService.remove(req.user.id, Number(req.params.festivalId));
    return success(res, 200, '위시리스트에서 삭제되었습니다.');
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, add, remove };
