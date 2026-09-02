const { Op, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const Festival = require('../models/festival.model');
const Heritage = require('../models/heritage.model');
const Sido = require('../models/sido.model');
const AppError = require('../utils/AppError');
const { formatDate, isValidDateString } = require('../utils/dateRange');

/**
 * 탐색(큐레이션 / 내 주변) 서비스.
 *
 * 캘린더는 "날짜를 알고 찾는" 화면이라 "이번 주말에 갈 만한 거 없나?" 같은
 * 실제 탐색 방식과는 맞지 않는다. 여기서는 시간(지금/이번 주말)과
 * 거리(내 주변)를 기준으로 축제를 찾는다.
 */

// 한 번에 돌려줄 최대 건수
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

// 좌표 없이 검색할 수 없으므로 반경 기본/최대값을 둔다. (단위: km)
const DEFAULT_RADIUS_KM = 20;
const MAX_RADIUS_KM = 200;

/**
 * limit 파라미터를 안전한 범위로 정리한다.
 * @param {string|number|undefined} value
 * @returns {number}
 */
function parseLimit(value) {
  return Math.min(Math.max(Number(value) || DEFAULT_LIMIT, 1), MAX_LIMIT);
}

/**
 * 위도/경도/반경 파라미터를 검증한다.
 * @param {{lat?: string, lng?: string, radius?: string}} query
 * @returns {{latitude: number, longitude: number, radiusKm: number}}
 */
function parseLocation(query) {
  const latitude = Number(query.lat);
  const longitude = Number(query.lng);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new AppError(400, 'lat은 -90 ~ 90 사이의 값이어야 합니다.');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new AppError(400, 'lng는 -180 ~ 180 사이의 값이어야 합니다.');
  }

  const radiusKm = Math.min(Math.max(Number(query.radius) || DEFAULT_RADIUS_KM, 1), MAX_RADIUS_KM);

  return { latitude, longitude, radiusKm };
}

/**
 * 기준일(오늘)을 구한다. 테스트에서 특정 날짜를 넣을 수 있도록 파라미터로 받는다.
 * @param {string|undefined} baseDate - 'YYYY-MM-DD'
 * @returns {string}
 */
function resolveBaseDate(baseDate) {
  if (baseDate === undefined) return formatDate(new Date());

  if (!isValidDateString(baseDate)) {
    throw new AppError(400, 'date는 YYYY-MM-DD 형식이어야 합니다.');
  }

  return baseDate;
}

/**
 * 기준일이 속한 주의 이번 주말(토~일) 범위를 구한다.
 * 이미 토/일이면 그 주말을, 평일이면 다가오는 주말을 반환한다.
 * @param {string} baseDate - 'YYYY-MM-DD'
 * @returns {{start: string, end: string}}
 */
function getUpcomingWeekend(baseDate) {
  const base = new Date(`${baseDate}T00:00:00.000Z`);
  const dayOfWeek = base.getUTCDay(); // 0=일, 6=토

  // 토요일까지 남은 일수. 일요일(0)이면 이미 주말이므로 하루 전(토)로 되돌린다.
  const daysUntilSaturday = dayOfWeek === 0 ? -1 : 6 - dayOfWeek;

  const saturday = new Date(base);
  saturday.setUTCDate(saturday.getUTCDate() + daysUntilSaturday);

  const sunday = new Date(saturday);
  sunday.setUTCDate(sunday.getUTCDate() + 1);

  return { start: formatDate(saturday), end: formatDate(sunday) };
}

// 목록에 함께 내려줄 시도 정보
const SIDO_INCLUDE = { model: Sido, as: 'sido', attributes: ['id', 'code', 'name'] };

/**
 * 홈 화면용 큐레이션 목록을 조회한다.
 *
 * - ongoing: 오늘 진행 중인 축제
 * - weekend: 이번 주말(토~일)에 열리는 축제
 * - upcoming: 아직 시작하지 않은, 곧 시작할 축제
 *
 * @param {{sidoCode?: string, limit?: string, date?: string}} query
 * @returns {Promise<{baseDate: string, weekend: {start: string, end: string}, ongoing: Festival[], weekendFestivals: Festival[], upcoming: Festival[]}>}
 */
async function getCurated(query = {}) {
  const baseDate = resolveBaseDate(query.date);
  const limit = parseLimit(query.limit);
  const weekend = getUpcomingWeekend(baseDate);

  const sidoInclude = query.sidoCode
    ? { ...SIDO_INCLUDE, where: { code: query.sidoCode } }
    : SIDO_INCLUDE;

  const baseOptions = { include: [sidoInclude], limit };

  const [ongoing, weekendFestivals, upcoming] = await Promise.all([
    // 오늘 기준으로 이미 시작했고 아직 끝나지 않은 축제
    Festival.findAll({
      ...baseOptions,
      where: { startDate: { [Op.lte]: baseDate }, endDate: { [Op.gte]: baseDate } },
      order: [['endDate', 'ASC']],
    }),

    // 주말 기간과 개최 기간이 하루라도 겹치는 축제
    Festival.findAll({
      ...baseOptions,
      where: { startDate: { [Op.lte]: weekend.end }, endDate: { [Op.gte]: weekend.start } },
      order: [['startDate', 'ASC']],
    }),

    // 아직 시작하지 않은 축제 중 가장 빨리 시작하는 순
    Festival.findAll({
      ...baseOptions,
      where: { startDate: { [Op.gt]: baseDate } },
      order: [['startDate', 'ASC']],
    }),
  ]);

  return { baseDate, weekend, ongoing, weekendFestivals, upcoming };
}

/**
 * 좌표 기준 거리(km)를 계산하는 SQL 조각을 만든다.
 *
 * MySQL의 ST_Distance_Sphere는 미터 단위 구면 거리를 돌려주므로 1000으로 나눠 km로 쓴다.
 * POINT는 (경도, 위도) 순서라는 점에 주의한다.
 *
 * @param {string} tableAlias - 대상 테이블 별칭
 * @param {number} latitude
 * @param {number} longitude
 * @returns {import('sequelize').Literal}
 */
function distanceExpression(tableAlias, latitude, longitude) {
  return literal(
    `ST_Distance_Sphere(POINT(\`${tableAlias}\`.\`longitude\`, \`${tableAlias}\`.\`latitude\`), POINT(${longitude}, ${latitude})) / 1000`
  );
}

/**
 * 좌표 기준 반경 안의 축제를 가까운 순으로 조회한다.
 *
 * @param {{lat: string, lng: string, radius?: string, limit?: string, date?: string, onlyOngoing?: string}} query
 * @returns {Promise<{center: object, radiusKm: number, items: object[]}>}
 */
async function getNearbyFestivals(query) {
  const { latitude, longitude, radiusKm } = parseLocation(query);
  const limit = parseLimit(query.limit);
  const distance = distanceExpression('Festival', latitude, longitude);

  const where = {
    // 좌표가 없는 데이터는 거리 계산이 불가능하므로 제외한다.
    latitude: { [Op.ne]: null },
    longitude: { [Op.ne]: null },
    [Op.and]: [literal(`${distance.val} <= ${radiusKm}`)],
  };

  // 기본은 "지금 갈 수 있는" 축제만 보여준다. (이미 끝난 축제를 근처라고 안내하면 쓸모없다)
  if (query.onlyOngoing !== 'false') {
    where.endDate = { [Op.gte]: resolveBaseDate(query.date) };
  }

  const items = await Festival.findAll({
    where,
    include: [SIDO_INCLUDE],
    // 계산한 거리를 응답에도 포함시켜 "몇 km 거리" 표시에 쓸 수 있게 한다.
    attributes: { include: [[distance, 'distanceKm']] },
    order: [[distance, 'ASC']],
    limit,
  });

  return { center: { latitude, longitude }, radiusKm, items };
}

/**
 * 좌표 기준 반경 안의 문화재를 가까운 순으로 조회한다.
 * "축제 갔다가 근처 문화재 들르기" 동선을 만들기 위한 API다.
 *
 * @param {{lat: string, lng: string, radius?: string, limit?: string}} query
 * @returns {Promise<{center: object, radiusKm: number, items: object[]}>}
 */
async function getNearbyHeritages(query) {
  const { latitude, longitude, radiusKm } = parseLocation(query);
  const limit = parseLimit(query.limit);
  const distance = distanceExpression('Heritage', latitude, longitude);

  const items = await Heritage.findAll({
    where: {
      latitude: { [Op.ne]: null },
      longitude: { [Op.ne]: null },
      [Op.and]: [literal(`${distance.val} <= ${radiusKm}`)],
    },
    include: [SIDO_INCLUDE],
    attributes: { include: [[distance, 'distanceKm']] },
    order: [[distance, 'ASC']],
    limit,
  });

  return { center: { latitude, longitude }, radiusKm, items };
}

/**
 * 특정 축제 주변의 문화재를 조회한다.
 * 축제 상세 화면에서 "이 축제 근처 가볼 만한 문화재"를 보여주는 데 사용한다.
 *
 * @param {number} festivalId
 * @param {{radius?: string, limit?: string}} query
 * @returns {Promise<{center: object, radiusKm: number, items: object[]}>}
 */
async function getHeritagesNearFestival(festivalId, query = {}) {
  const festival = await Festival.findByPk(festivalId);

  if (!festival) {
    throw new AppError(404, '지역축제 정보를 찾을 수 없습니다.');
  }

  if (festival.latitude === null || festival.longitude === null) {
    throw new AppError(400, '이 축제는 좌표 정보가 없어 주변 문화재를 찾을 수 없습니다.');
  }

  return getNearbyHeritages({
    lat: festival.latitude,
    lng: festival.longitude,
    radius: query.radius,
    limit: query.limit,
  });
}

module.exports = {
  getCurated,
  getNearbyFestivals,
  getNearbyHeritages,
  getHeritagesNearFestival,
  getUpcomingWeekend,
  parseLocation,
  DEFAULT_RADIUS_KM,
  MAX_RADIUS_KM,
};
