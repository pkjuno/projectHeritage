const discoveryService = require('../services/discovery.service');
const { success } = require('../utils/response');

/**
 * [GET] /api/festivals/curated
 * 홈 화면용 큐레이션 조회 컨트롤러.
 * (query: sidoCode, limit, date)
 *
 * 응답: ongoing(진행 중) / weekendFestivals(이번 주말) / upcoming(곧 시작)
 */
async function curated(req, res, next) {
  try {
    const result = await discoveryService.getCurated(req.query);
    return success(res, 200, '축제 큐레이션 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/festivals/nearby
 * 내 주변 축제 조회 컨트롤러. 가까운 순으로 정렬되며 distanceKm가 함께 내려간다.
 * (query: lat, lng, radius, limit, onlyOngoing)
 */
async function nearbyFestivals(req, res, next) {
  try {
    const result = await discoveryService.getNearbyFestivals(req.query);
    return success(res, 200, '주변 축제 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/heritages/nearby
 * 내 주변 문화재 조회 컨트롤러.
 * (query: lat, lng, radius, limit)
 */
async function nearbyHeritages(req, res, next) {
  try {
    const result = await discoveryService.getNearbyHeritages(req.query);
    return success(res, 200, '주변 문화재 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/festivals/:id/nearby-heritages
 * 특정 축제 주변의 문화재 조회 컨트롤러.
 * "축제 갔다가 근처 문화재 들르기" 동선을 만들기 위한 API.
 * (query: radius, limit)
 */
async function heritagesNearFestival(req, res, next) {
  try {
    const result = await discoveryService.getHeritagesNearFestival(
      Number(req.params.id),
      req.query
    );
    return success(res, 200, '축제 주변 문화재 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { curated, nearbyFestivals, nearbyHeritages, heritagesNearFestival };
