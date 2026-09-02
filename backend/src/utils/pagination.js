// 한 번에 조회할 수 있는 최대 개수 (과도한 조회로 인한 서버 부하 방지)
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * 쿼리스트링(page, limit)을 Sequelize의 limit/offset으로 변환한다.
 * @param {{page?: string, limit?: string}} query - req.query
 * @returns {{page: number, limit: number, offset: number}}
 */
function parsePagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * 목록 조회 결과를 페이지네이션 메타 정보와 함께 감싼다.
 * @param {{rows: any[], count: number}} result - Sequelize findAndCountAll 결과
 * @param {{page: number, limit: number}} pagination
 */
function toPagedResult({ rows, count }, { page, limit }) {
  return {
    items: rows,
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit) || 0,
  };
}

module.exports = { parsePagination, toPagedResult };
