/**
 * Jest 설정.
 *
 * 통합 테스트가 같은 테스트 DB를 공유하며 테이블을 비우기 때문에,
 * 테스트 파일을 병렬로 돌리면 서로의 데이터를 지운다.
 * 그래서 package.json의 test 스크립트에서 --runInBand(직렬 실행)를 사용한다.
 */
module.exports = {
  testEnvironment: 'node',
  // 테스트 파일 위치
  testMatch: ['**/tests/**/*.test.js'],
  // 전체 실행 전 딱 한 번: 테스트 DB 스키마를 모델에 맞춰 새로 만든다.
  globalSetup: '<rootDir>/tests/globalSetup.js',
  // 각 테스트 파일마다: DB 연결 및 정리
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // 통합 테스트는 DB 연결을 포함하므로 기본 5초로는 부족할 수 있다.
  testTimeout: 30000,
  // 커버리지 측정 대상 (스크립트/진입점 제외)
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/scripts/**',
    '!src/importers/run.js',
  ],
};
