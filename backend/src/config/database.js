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
 * 데이터베이스에 연결한다.
 *
 * 스키마 생성/변경은 마이그레이션(npm run db:migrate)이 담당하며, 여기서는 하지 않는다.
 * 예전에는 기동할 때마다 sequelize.sync()를 호출했는데, sync()는 기존 테이블에
 * 새 컬럼을 추가하지 않아서 모델에 필드를 더할 때마다 "Unknown column" 오류가 났다.
 * 스키마의 기준을 마이그레이션 한 곳으로 모아 그 문제를 없앴다.
 *
 * sync는 테스트에서만 사용한다. (테스트 DB는 매번 통째로 다시 만든다)
 *
 * @param {{sync?: boolean, force?: boolean}} [options]
 *   sync  - 모델 정의로 스키마를 만든다. 테스트 전용.
 *   force - 기존 테이블을 지우고 다시 만든다. sync와 함께 테스트에서만 사용.
 * @returns {Promise<void>}
 */
async function connectDatabase({ sync = false, force = false } = {}) {
  await sequelize.authenticate();

  if (sync) {
    if (config.env !== 'test') {
      // 실수로 운영/개발 DB의 테이블을 날리는 것을 막는다.
      throw new Error('sync는 테스트 환경에서만 사용할 수 있습니다. 스키마 변경은 npm run db:migrate를 사용하세요.');
    }
    await sequelize.sync({ force });
  }

  // 테스트 실행 중에는 로그가 결과 출력에 섞이므로 생략한다.
  if (config.env !== 'test') {
    console.log(`[DB] MySQL(${config.db.host}:${config.db.port}/${config.db.name}) 연결 성공`);
  }
}

module.exports = { sequelize, connectDatabase };
