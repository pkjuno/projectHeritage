const { Op } = require('sequelize');
const Heritage = require('../models/heritage.model');
const Sido = require('../models/sido.model');
const AppError = require('../utils/AppError');
const { parsePagination, toPagedResult } = require('../utils/pagination');

/**
 * 시도 존재 여부를 검증한다. 없으면 예외를 던진다.
 * @param {number} sidoId
 */
async function assertSidoExists(sidoId) {
  const sido = await Sido.findByPk(sidoId);
  if (!sido) {
    throw new AppError(400, '존재하지 않는 시도입니다.');
  }
}

/**
 * 문화재 목록을 조회한다. 시도코드/명칭 키워드/지정구분으로 필터링하고 페이지네이션한다.
 * @param {{sidoCode?: string, keyword?: string, designationType?: string, page?: string, limit?: string}} query
 */
async function list(query) {
  const pagination = parsePagination(query);
  const where = {};

  // 명칭 키워드 검색 (부분 일치)
  if (query.keyword) {
    where.name = { [Op.like]: `%${query.keyword}%` };
  }

  // 지정 구분 필터
  if (query.designationType) {
    where.designationType = query.designationType;
  }

  // 시도코드로 필터링 (Sido 조인 조건)
  const sidoInclude = { model: Sido, as: 'sido', attributes: ['id', 'code', 'name'] };
  if (query.sidoCode) {
    sidoInclude.where = { code: query.sidoCode };
  }

  const result = await Heritage.findAndCountAll({
    where,
    include: [sidoInclude],
    limit: pagination.limit,
    offset: pagination.offset,
    order: [['id', 'DESC']],
  });

  return toPagedResult(result, pagination);
}

/**
 * 문화재 단건을 조회한다.
 * @param {number} id
 */
async function getById(id) {
  const heritage = await Heritage.findByPk(id, {
    include: [{ model: Sido, as: 'sido', attributes: ['id', 'code', 'name'] }],
  });

  if (!heritage) {
    throw new AppError(404, '문화재 정보를 찾을 수 없습니다.');
  }

  return heritage;
}

/**
 * 문화재를 등록한다.
 * @param {object} payload
 */
async function create(payload) {
  await assertSidoExists(payload.sidoId);
  return Heritage.create(payload);
}

/**
 * 문화재 정보를 수정한다.
 * @param {number} id
 * @param {object} payload
 */
async function update(id, payload) {
  const heritage = await Heritage.findByPk(id);
  if (!heritage) {
    throw new AppError(404, '문화재 정보를 찾을 수 없습니다.');
  }

  if (payload.sidoId) {
    await assertSidoExists(payload.sidoId);
  }

  await heritage.update(payload);
  return heritage;
}

/**
 * 문화재를 삭제한다.
 * @param {number} id
 */
async function remove(id) {
  const heritage = await Heritage.findByPk(id);
  if (!heritage) {
    throw new AppError(404, '문화재 정보를 찾을 수 없습니다.');
  }
  await heritage.destroy();
}

module.exports = { list, getById, create, update, remove };
