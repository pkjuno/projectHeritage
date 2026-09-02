const { Sequelize } = require('sequelize');
const config = require('./index');

/**
 * MySQL 접속을 위한 Sequelize 인스턴스.
 * 모델 파일들은 이 인스턴스를 통해 테이블과 매핑된다.
 */
const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  // 개발 환경에서만 실행되는 SQL 쿼리를 콘솔에 출력한다.
  logging: config.env === 'development' ? console.log : false,
  define: {
    // 테이블/컬럼명을 camelCase 대신 snake_case로 자동 변환한다.
    underscored: true,
  },
});

/**
 * 데이터베이스 연결을 검증하고, 모델 정의를 실제 테이블과 동기화한다.
 * 운영 환경에서는 sync 대신 마이그레이션 도구(sequelize-cli 등) 사용을 권장한다.
 * @returns {Promise<void>}
 */
async function connectDatabase() {
  await sequelize.authenticate();
  console.log(`[DB] MySQL(${config.db.host}:${config.db.port}/${config.db.name}) 연결 성공`);

  // 모델 스키마를 테이블에 반영한다. (컬럼 삭제 없이 없는 것만 추가)
  await sequelize.sync();
  console.log('[DB] 모델 동기화 완료');
}

module.exports = { sequelize, connectDatabase };
