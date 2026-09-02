const FestivalWishlist = require('../models/festivalWishlist.model');
const Festival = require('../models/festival.model');
const Sido = require('../models/sido.model');
const AppError = require('../utils/AppError');
const { parsePagination, toPagedResult } = require('../utils/pagination');

// 위시리스트 목록에 함께 내려줄 축제 정보
const FESTIVAL_INCLUDE = {
  model: Festival,
  as: 'festival',
  include: [{ model: Sido, as: 'sido', attributes: ['id', 'code', 'name'] }],
};

/**
 * 축제가 존재하는지 확인하고 반환한다.
 * @param {number} festivalId
 * @returns {Promise<Festival>}
 */
async function getFestivalOrThrow(festivalId) {
  const festival = await Festival.findByPk(festivalId);
  if (!festival) {
    throw new AppError(404, '지역축제 정보를 찾을 수 없습니다.');
  }
  return festival;
}

/**
 * 내 위시리스트 목록을 조회한다. (최근에 찜한 순)
 * @param {number} userId
 * @param {{page?: string, limit?: string}} query
 */
async function list(userId, query = {}) {
  const pagination = parsePagination(query);

  const result = await FestivalWishlist.findAndCountAll({
    where: { userId },
    include: [FESTIVAL_INCLUDE],
    limit: pagination.limit,
    offset: pagination.offset,
    order: [['createdAt', 'DESC']],
  });

  return toPagedResult(result, pagination);
}

/**
 * 축제를 위시리스트에 추가한다. 이미 찜한 축제면 409.
 * @param {number} userId
 * @param {number} festivalId
 * @returns {Promise<FestivalWishlist>}
 */
async function add(userId, festivalId) {
  await getFestivalOrThrow(festivalId);

  const [wishlist, created] = await FestivalWishlist.findOrCreate({
    where: { userId, festivalId },
  });

  if (!created) {
    throw new AppError(409, '이미 위시리스트에 담긴 축제입니다.');
  }

  return wishlist;
}

/**
 * 위시리스트에서 축제를 제거한다.
 * @param {number} userId
 * @param {number} festivalId
 * @returns {Promise<void>}
 */
async function remove(userId, festivalId) {
  const deletedCount = await FestivalWishlist.destroy({ where: { userId, festivalId } });

  if (deletedCount === 0) {
    throw new AppError(404, '위시리스트에 담겨 있지 않은 축제입니다.');
  }
}

/**
 * 특정 축제를 내가 찜했는지 확인한다. (축제 상세 조회의 개인화 정보)
 * @param {number|undefined} userId - 비로그인 상태면 undefined
 * @param {number} festivalId
 * @returns {Promise<boolean>}
 */
async function isWishlisted(userId, festivalId) {
  if (!userId) return false;

  const count = await FestivalWishlist.count({ where: { userId, festivalId } });
  return count > 0;
}

module.exports = { list, add, remove, isWishlisted, getFestivalOrThrow };
