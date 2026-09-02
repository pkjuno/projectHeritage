// 모든 테스트 파일 실행 전에 공통으로 적용되는 설정.
// jest.config.js의 setupFilesAfterEnv에서 로드된다.

// config/index.js가 이 값을 보고 테스트 전용 DB(project_heritage_test)를 선택한다.
// 반드시 다른 모듈보다 먼저 설정해야 한다.
process.env.NODE_ENV = 'test';

// 테스트에서는 요청 로그가 출력에 섞이지 않도록 조용한 포맷을 쓴다.
process.env.LOG_SILENT = 'true';

const { sequelize, connectDatabase } = require('../src/config/database');

// 테스트 스위트 시작 시 DB에 연결하고 스키마를 만든다.
beforeAll(async () => {
  await connectDatabase();
});

// 모든 테스트가 끝나면 커넥션 풀을 닫는다. (닫지 않으면 Jest가 종료되지 않는다)
afterAll(async () => {
  await sequelize.close();
});
