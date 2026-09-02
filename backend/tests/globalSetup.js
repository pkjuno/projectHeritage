// 전체 테스트 실행 전에 딱 한 번 실행되는 준비 작업. (jest.config.js의 globalSetup)

// config/index.js가 테스트 전용 DB를 선택하도록 가장 먼저 설정한다.
process.env.NODE_ENV = 'test';

const { sequelize, connectDatabase } = require('../src/config/database');
// 모든 모델을 등록해야 sync가 전체 테이블을 대상으로 동작한다.
require('../src/models');

/**
 * 테스트 DB 스키마를 모델 정의와 정확히 일치하도록 새로 만든다.
 *
 * 일반 sync()는 기존 테이블에 새 컬럼을 추가하지 않기 때문에,
 * 모델에 필드를 추가한 뒤 테스트를 돌리면 "Unknown column" 오류가 난다.
 * 테스트 DB는 언제든 버려도 되는 데이터이므로 매번 통째로 다시 만들어
 * 스키마 불일치를 원천적으로 없앤다.
 */
module.exports = async () => {
  await connectDatabase({ sync: true, force: true });
  await sequelize.close();
};
