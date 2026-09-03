const BoardCategory = require('../models/boardCategory.model');
const AppError = require('../utils/AppError');

/**
 * 게시판(카테고리) 조회 서비스.
 */

/**
 * 사용 중인 게시판 목록을 노출 순서대로 조회한다.
 * 비활성화(isActive=false)된 게시판은 제외한다. 기존 글은 남아 있지만 새 글은 받지 않는다.
 * @returns {Promise<BoardCategory[]>}
 */
async function list() {
  return BoardCategory.findAll({
    where: { isActive: true },
    order: [
      ['sortOrder', 'ASC'],
      ['id', 'ASC'],
    ],
  });
}

/**
 * 코드로 게시판을 찾는다. 없거나 닫힌 게시판이면 예외를 던진다.
 * @param {string} code - 게시판 코드 (free, review 등)
 * @returns {Promise<BoardCategory>}
 */
async function findByCodeOrThrow(code) {
  if (!code) {
    throw new AppError(400, '게시판 코드(category)가 필요합니다.');
  }

  const category = await BoardCategory.findOne({ where: { code } });

  if (!category) {
    throw new AppError(404, '존재하지 않는 게시판입니다.');
  }

  // 닫힌 게시판은 조회는 되지만 새 글을 받지 않는다.
  // 이 함수는 글쓰기 경로에서 쓰이므로 여기서 막는다.
  if (!category.isActive) {
    throw new AppError(403, '현재 사용할 수 없는 게시판입니다.');
  }

  return category;
}

module.exports = { list, findByCodeOrThrow };
