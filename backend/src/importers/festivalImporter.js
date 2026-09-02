const Sido = require('../models/sido.model');
const Festival = require('../models/festival.model');
const { fetchWithRetry, sleep } = require('./httpClient');

// data.go.kr에서 활용신청 후 발급받은 요청 URL/서비스키. (.env 참고)
const API_URL = process.env.FESTIVAL_API_URL;
const SERVICE_KEY = process.env.FESTIVAL_API_SERVICE_KEY;

// 한 번에 조회할 페이지당 건수
const PAGE_SIZE = 100;
// 공공 API에 대한 예의상 각 요청 사이에 두는 최소 대기 시간(ms)
const REQUEST_INTERVAL_MS = 200;

/**
 * "YYYYMMDD" 또는 "YYYY-MM-DD" 형태의 날짜 문자열을 DATEONLY(YYYY-MM-DD)로 정규화한다.
 * @param {string} raw
 * @returns {string|null}
 */
function normalizeDate(raw) {
  if (!raw) return null;
  const digitsOnly = String(raw).replace(/[^0-9]/g, '');
  if (digitsOnly.length !== 8) return null;
  return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6, 8)}`;
}

/**
 * 응답 본문(JSON)에서 데이터 배열을 꺼낸다.
 * data.go.kr 표준데이터(odcloud.kr) 계열은 최상위 `data` 배열로 내려온다.
 * 다른 형식의 API를 연결하는 경우 이 함수만 수정하면 된다.
 * @param {object} parsed
 * @returns {object[]}
 */
function extractItems(parsed) {
  const candidates = [parsed?.data, parsed?.response?.body?.items?.item, parsed?.items];
  const found = candidates.find((c) => c !== undefined);
  if (!found) return [];
  return Array.isArray(found) ? found : [found];
}

/**
 * 전체 응답에서 총 건수를 꺼낸다. (odcloud.kr 표준데이터 계열: matchCount/totalCount)
 * @param {object} parsed
 * @param {number} fallback
 * @returns {number}
 */
function extractTotalCount(parsed, fallback) {
  return Number(parsed?.matchCount ?? parsed?.totalCount ?? parsed?.response?.body?.totalCount ?? fallback);
}

/**
 * 시도명 문자열로 Sido 레코드를 찾는다. "서울", "서울특별시" 등 표기가 달라도 매칭되도록
 * 접두어 일치로 비교한다.
 * @param {object[]} sidos - 전체 Sido 목록
 * @param {string} rawName - 원본 데이터의 시도명/소재지 주소 문자열
 * @returns {object|null}
 */
function findSidoByName(sidos, rawName) {
  if (!rawName) return null;
  return (
    sidos.find((sido) => rawName.startsWith(sido.name) || rawName.startsWith(sido.name.slice(0, 2))) ?? null
  );
}

/**
 * 원본 API 응답 item 1건을 Festival 모델 필드로 변환한다.
 * ⚠️ 아래 필드명은 "전국문화축제표준데이터"의 표준 컬럼명(한글) 기준 최선 추정치다.
 *    실제 값이 다르면 `--sample` 옵션으로 원본을 확인한 뒤 이 함수만 고치면 된다.
 * @param {object} item
 * @param {object[]} sidos
 * @returns {object}
 */
function mapItem(item, sidos) {
  const sidoNameHint = item['시도명'] || item['소재지도로명주소'] || item['소재지지번주소'];
  const sido = findSidoByName(sidos, sidoNameHint);

  return {
    sidoId: sido?.id ?? null,
    name: item['축제명'],
    location: item['개최장소'] ?? null,
    startDate: normalizeDate(item['축제시작일자']),
    endDate: normalizeDate(item['축제종료일자']),
    hostOrganization: item['주최기관명'] ?? null,
    manageOrganization: item['주관기관명'] ?? null,
    homepageUrl: item['홈페이지주소'] ?? null,
    latitude: item['위도'] ? Number(item['위도']) : null,
    longitude: item['경도'] ? Number(item['경도']) : null,
    description: item['축제내용'] ?? null,
  };
}

/**
 * 지역축제 1건을 (축제명+시도+시작일) 자연키 기준으로 upsert한다.
 * 축제 데이터는 문화재와 달리 원본에 안정적인 고유 ID가 없는 경우가 많아
 * 이 조합을 자연키로 사용한다.
 * @param {object} data - mapItem() 결과
 * @returns {Promise<'created'|'updated'|'skipped'>}
 */
async function upsertFestival(data) {
  if (!data.name || !data.sidoId || !data.startDate || !data.endDate) return 'skipped';

  const where = { name: data.name, sidoId: data.sidoId, startDate: data.startDate };
  const existing = await Festival.findOne({ where });

  if (existing) {
    await existing.update(data);
    return 'updated';
  }

  await Festival.create(data);
  return 'created';
}

/**
 * 지역축제 데이터를 페이지네이션하며 전량 수집해 DB에 적재하는 메인 함수.
 * @param {{dryRun?: boolean, sample?: boolean}} [options]
 * @returns {Promise<{created: number, updated: number, skipped: number}>}
 */
async function runFestivalImport({ dryRun = false, sample = false } = {}) {
  if (!API_URL || API_URL === 'CHANGE_ME') {
    throw new Error(
      'FESTIVAL_API_URL이 설정되지 않았습니다. data.go.kr에서 활용신청 후 .env의 FESTIVAL_API_URL/FESTIVAL_API_SERVICE_KEY를 설정하세요.'
    );
  }

  const sidos = await Sido.findAll();
  const stats = { created: 0, updated: 0, skipped: 0 };

  let page = 1;
  let totalFetched = 0;

  for (;;) {
    const url = `${API_URL}?page=${page}&perPage=${PAGE_SIZE}&serviceKey=${encodeURIComponent(SERVICE_KEY || '')}`;
    const raw = await fetchWithRetry(url);
    const parsed = JSON.parse(raw);
    const items = extractItems(parsed);
    const totalCount = extractTotalCount(parsed, items.length);

    if (sample && page === 1) {
      console.log('[Importer][sample] 원본 응답 첫 항목:', JSON.stringify(items[0], null, 2));
    }

    if (items.length === 0) break;

    for (const item of items) {
      const mapped = mapItem(item, sidos);

      if (sample && page === 1 && item === items[0]) {
        console.log('[Importer][sample] 매핑 결과:', JSON.stringify(mapped, null, 2));
      }

      if (dryRun) {
        stats.skipped += 1;
        continue;
      }

      const result = await upsertFestival(mapped);
      stats[result] += 1;
    }

    totalFetched += items.length;
    console.log(`[Importer] 지역축제 ${totalFetched}/${totalCount || totalFetched}건 처리`);

    if (totalFetched >= totalCount || items.length < PAGE_SIZE) break;

    page += 1;
    await sleep(REQUEST_INTERVAL_MS);
  }

  console.log('\n[Importer] 지역축제 수집 완료:', stats);
  return stats;
}

module.exports = { runFestivalImport, mapItem, normalizeDate, findSidoByName, extractItems };
