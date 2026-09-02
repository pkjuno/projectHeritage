const { Op } = require('sequelize');
const Festival = require('../models/festival.model');
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
 * 지역축제 목록을 조회한다. 시도코드/명칭 키워드/개최기간으로 필터링하고 페이지네이션한다.
 * @param {{sidoCode?: string, keyword?: string, from?: string, to?: string, page?: string, limit?: string}} query
 */
async function list(query) {
  const pagination = parsePagination(query);
  const where = {};

  // 축제명 키워드 검색 (부분 일치)
  if (query.keyword) {
    where.name = { [Op.like]: `%${query.keyword}%` };
  }

  // 개최기간 필터: 조회기간(from~to)과 축제기간이 겹치는 축제만 조회
  if (query.from) {
    where.endDate = { [Op.gte]: query.from };
  }
  if (query.to) {
    where.startDate = { [Op.lte]: query.to };
  }

  // 시도코드로 필터링 (Sido 조인 조건)
  const sidoInclude = { model: Sido, as: 'sido', attributes: ['id', 'code', 'name'] };
  if (query.sidoCode) {
    sidoInclude.where = { code: query.sidoCode };
  }

  const result = await Festival.findAndCountAll({
    where,
    include: [sidoInclude],
    limit: pagination.limit,
    offset: pagination.offset,
    order: [['startDate', 'ASC']],
  });

  return toPagedResult(result, pagination);
}

/**
 * 지역축제 단건을 조회한다.
 * @param {number} id
 */
async function getById(id) {
  const festival = await Festival.findByPk(id, {
    include: [{ model: Sido, as: 'sido', attributes: ['id', 'code', 'name'] }],
  });

  if (!festival) {
    throw new AppError(404, '지역축제 정보를 찾을 수 없습니다.');
  }

  return festival;
}

/**
 * 지역축제를 등록한다.
 * @param {object} payload
 */
async function create(payload) {
  await assertSidoExists(payload.sidoId);
  return Festival.create(payload);
}

/**
 * 지역축제 정보를 수정한다.
 * @param {number} id
 * @param {object} payload
 */
async function update(id, payload) {
  const festival = await Festival.findByPk(id);
  if (!festival) {
    throw new AppError(404, '지역축제 정보를 찾을 수 없습니다.');
  }

  if (payload.sidoId) {
    await assertSidoExists(payload.sidoId);
  }

  await festival.update(payload);
  return festival;
}

/**
 * 지역축제를 삭제한다.
 * @param {number} id
 */
async function remove(id) {
  const festival = await Festival.findByPk(id);
  if (!festival) {
    throw new AppError(404, '지역축제 정보를 찾을 수 없습니다.');
  }
  await festival.destroy();
}

module.exports = { list, getById, create, update, remove };
