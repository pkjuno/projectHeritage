const BoardCategory = require('../models/boardCategory.model');
const config = require('../config');

/**
 * 초기 게시판 목록.
 *
 * 시도(Sido)와 달리 이 데이터는 운영 중에 바뀔 수 있다. (게시판 추가/이름 변경/비활성화)
 * 그래서 이미 있는 code는 건드리지 않고 없는 것만 추가한다.
 * 여기서 update까지 하면 운영자가 화면에서 바꾼 이름이 서버 재시작마다 되돌아간다.
 */
const BOARD_CATEGORY_SEED_DATA = [
  {
    code: 'notice',
    name: '공지사항',
    description: '운영자가 알리는 소식',
    writeRole: 'admin', // 공지는 운영자만 작성할 수 있다.
    requireFestival: false,
    sortOrder: 1,
  },
  {
    code: 'free',
    name: '자유게시판',
    description: '무엇이든 자유롭게',
    writeRole: 'user',
    requireFestival: false,
    sortOrder: 2,
  },
  {
    code: 'review',
    name: '축제 후기',
    description: '다녀온 축제 이야기',
    writeRole: 'user',
    requireFestival: true, // 후기는 대상 축제가 반드시 있어야 한다.
    sortOrder: 3,
  },
  {
    code: 'companion',
    name: '동행 구해요',
    description: '같이 갈 사람을 찾아보세요',
    writeRole: 'user',
    requireFestival: false,
    sortOrder: 4,
  },
  {
    code: 'question',
    name: '질문/답변',
    description: '궁금한 것을 물어보세요',
    writeRole: 'user',
    requireFestival: false,
    sortOrder: 5,
  },
];

/**
 * 게시판 마스터 데이터를 초기 적재한다.
 * 이미 존재하는 code는 건너뛰므로 서버를 재시작해도 안전하게 반복 실행할 수 있다.
 * @returns {Promise<void>}
 */
async function seedBoardCategories() {
  for (const category of BOARD_CATEGORY_SEED_DATA) {
    await BoardCategory.findOrCreate({ where: { code: category.code }, defaults: category });
  }

  // 테스트는 매 케이스마다 시드를 다시 채우므로 로그를 남기지 않는다.
  if (config.env !== 'test') {
    console.log(`[Seed] 게시판 마스터 데이터 확인 완료 (${BOARD_CATEGORY_SEED_DATA.length}개)`);
  }
}

module.exports = { seedBoardCategories, BOARD_CATEGORY_SEED_DATA };
