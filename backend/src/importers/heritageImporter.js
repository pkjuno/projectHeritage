const Sido = require('../models/sido.model');
const Heritage = require('../models/heritage.model');
const { fetchWithRetry, sleep } = require('./httpClient');
const { parseXml } = require('./xmlParser');

// 국가유산청 "국가유산검색 목록조회" Open API. 별도 인증키 없이 사용 가능하다.
// (참고자료 3절 - http://www.khs.go.kr/cha/SearchKindOpenapiList.do)
const LIST_URL = process.env.HERITAGE_API_LIST_URL || 'http://www.khs.go.kr/cha/SearchKindOpenapiList.do';

// 한 번에 조회할 페이지당 건수
const PAGE_UNIT = 100;
// 공공 API에 대한 예의상 각 요청 사이에 두는 최소 대기 시간(ms)
const REQUEST_INTERVAL_MS = 200;

/**
 * 종목명(ccceName) 문자열을 우리 DB의 designationType ENUM 값으로 변환한다.
 * ⚠️ 실제 API 응답의 종목명 표기와 다를 수 있으므로, 최초 실행 시 `--sample` 옵션으로
 *    원본 값을 확인한 뒤 이 매핑 규칙을 맞춰서 조정하는 것을 권장한다.
 * @param {string} ccceName
 * @returns {string}
 */
function mapDesignationType(ccceName = '') {
  if (/국보|보물|사적|명승|천연기념물|국가무형|국가민속/.test(ccceName)) return '국가지정문화재';
  if (/시도유형|시도무형|시도기념물|시도민속/.test(ccceName)) return '시도지정문화재';
  if (/문화재자료/.test(ccceName)) return '문화재자료';
  if (/등록문화재/.test(ccceName)) return '등록문화재';
  return '향토문화유적';
}

/**
 * "yyyymmdd" 형태의 지정일 문자열을 DATEONLY(YYYY-MM-DD)로 변환한다. 형식이 다르면 null.
 * @param {string} raw
 * @returns {string|null}
 */
function parseDesignatedDate(raw) {
  if (!raw || !/^\d{8}$/.test(String(raw))) return null;
  const str = String(raw);
  return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
}

/**
 * 파싱된 XML 응답 객체에서 item 배열과 총 건수를 꺼낸다.
 * 결과가 0/1/N건일 때 fast-xml-parser가 각각 undefined/object/array로 주기 때문에 배열로 정규화한다.
 * @param {object} parsedXml
 * @returns {{items: object[], totalCount: number}}
 */
function extractItems(parsedXml) {
  const body = parsedXml?.result ?? parsedXml?.response?.body ?? {};
  const rawItems = body.item ?? body.items?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const totalCount = Number(body.totalCnt ?? body.totalCount ?? items.length);
  return { items, totalCount };
}

/**
 * 국가유산 Open API 응답 item 1건을 Heritage 모델 필드로 변환한다.
 * @param {object} item
 * @param {number} sidoId
 * @returns {object}
 */
function mapItem(item, sidoId) {
  return {
    sidoId,
    name: item.ccbaMnm1,
    designationType: mapDesignationType(item.ccceName),
    categoryCode: item.ccbaKdcd ? String(item.ccbaKdcd) : null,
    managementNo: item.ccbaAsno ? String(item.ccbaAsno) : null,
    designatedDate: parseDesignatedDate(item.ccbaAsdt),
    address: [item.ccbaCtcdNm, item.ccsiName].filter(Boolean).join(' ') || null,
    latitude: item.latitude ? Number(item.latitude) : null,
    longitude: item.longitude ? Number(item.longitude) : null,
    imageUrl: item.imageUrl || null,
  };
}

/**
 * 문화재 1건을 (종목코드+관리번호+시도) 자연키 기준으로 upsert한다.
 * 자연키 정보가 없는 항목은 이름+시도로 대체 매칭한다.
 * @param {object} data - mapItem() 결과
 * @returns {Promise<'created'|'updated'|'skipped'>}
 */
async function upsertHeritage(data) {
  if (!data.name || !data.sidoId) return 'skipped';

  const where =
    data.categoryCode && data.managementNo
      ? { categoryCode: data.categoryCode, managementNo: data.managementNo, sidoId: data.sidoId }
      : { name: data.name, sidoId: data.sidoId };

  const existing = await Heritage.findOne({ where });

  if (existing) {
    await existing.update(data);
    return 'updated';
  }

  await Heritage.create(data);
  return 'created';
}

/**
 * 특정 시도의 문화재를 전량 수집해 DB에 적재한다. (페이지네이션 자동 처리)
 * @param {{code: string, id: number, name: string}} sido
 * @param {{dryRun?: boolean, sample?: boolean}} [options]
 * @returns {Promise<{created: number, updated: number, skipped: number}>}
 */
async function importHeritageBySido(sido, { dryRun = false, sample = false } = {}) {
  let pageIndex = 1;
  let totalFetched = 0;
  const stats = { created: 0, updated: 0, skipped: 0 };

  for (;;) {
    const url = `${LIST_URL}?ccbaCtcd=${sido.code}&pageUnit=${PAGE_UNIT}&pageIndex=${pageIndex}`;
    const xml = await fetchWithRetry(url);
    const { items, totalCount } = extractItems(parseXml(xml));

    if (items.length === 0) break;

    if (sample && pageIndex === 1) {
      console.log(`[Importer][sample] ${sido.name} 원본 응답 첫 항목:`, JSON.stringify(items[0], null, 2));
    }

    for (const item of items) {
      const mapped = mapItem(item, sido.id);

      if (sample && pageIndex === 1 && item === items[0]) {
        console.log('[Importer][sample] 매핑 결과:', JSON.stringify(mapped, null, 2));
      }

      if (dryRun) {
        stats.skipped += 1;
        continue;
      }

      const result = await upsertHeritage(mapped);
      stats[result] += 1;
    }

    totalFetched += items.length;
    console.log(`[Importer] ${sido.name}(${sido.code}) ${totalFetched}/${totalCount || totalFetched}건 처리`);

    if (totalFetched >= totalCount || items.length < PAGE_UNIT) break;

    pageIndex += 1;
    await sleep(REQUEST_INTERVAL_MS);
  }

  return stats;
}

/**
 * 전체(또는 지정한 시도의) 문화재 데이터를 수집해 적재하는 메인 함수.
 * @param {{sidoCode?: string, dryRun?: boolean, sample?: boolean}} [options]
 * @returns {Promise<{created: number, updated: number, skipped: number}>}
 */
async function runHeritageImport({ sidoCode, dryRun = false, sample = false } = {}) {
  const sidos = await Sido.findAll({ where: sidoCode ? { code: sidoCode } : undefined });

  if (sidos.length === 0) {
    throw new Error('대상 시도를 찾을 수 없습니다. 먼저 시도 마스터 데이터를 시드하세요. (npm run dev로 서버를 한 번 기동)');
  }

  const totalStats = { created: 0, updated: 0, skipped: 0 };

  for (const sido of sidos) {
    console.log(`\n[Importer] ${sido.name}(${sido.code}) 문화재 수집 시작`);
    const stats = await importHeritageBySido(sido, { dryRun, sample });

    totalStats.created += stats.created;
    totalStats.updated += stats.updated;
    totalStats.skipped += stats.skipped;

    await sleep(REQUEST_INTERVAL_MS);
  }

  console.log('\n[Importer] 문화재 수집 완료:', totalStats);
  return totalStats;
}

module.exports = {
  runHeritageImport,
  importHeritageBySido,
  mapItem,
  mapDesignationType,
  parseDesignatedDate,
  extractItems,
};
