const Sido = require('../models/sido.model');

// 국가유산청 Open API 시도코드(ccbaCtcd) 기준 17개 광역시도 마스터 데이터.
const SIDO_SEED_DATA = [
  { code: '11', name: '서울특별시' },
  { code: '21', name: '부산광역시' },
  { code: '22', name: '대구광역시' },
  { code: '23', name: '인천광역시' },
  { code: '24', name: '광주광역시' },
  { code: '25', name: '대전광역시' },
  { code: '26', name: '울산광역시' },
  { code: '45', name: '세종특별자치시' },
  { code: '31', name: '경기도' },
  { code: '51', name: '강원특별자치도' },
  { code: '33', name: '충청북도' },
  { code: '34', name: '충청남도' },
  { code: '35', name: '전북특별자치도' },
  { code: '36', name: '전라남도' },
  { code: '37', name: '경상북도' },
  { code: '38', name: '경상남도' },
  { code: '50', name: '제주특별자치도' },
];

/**
 * 17개 광역시도 마스터 데이터를 초기 적재한다.
 * 이미 존재하는 코드는 건너뛰므로 서버를 재시작해도 안전하게 반복 실행할 수 있다.
 * @returns {Promise<void>}
 */
async function seedSidos() {
  for (const sido of SIDO_SEED_DATA) {
    await Sido.findOrCreate({ where: { code: sido.code }, defaults: sido });
  }
  console.log('[Seed] 시도 마스터 데이터 확인 완료 (17개)');
}

module.exports = { seedSidos, SIDO_SEED_DATA };
