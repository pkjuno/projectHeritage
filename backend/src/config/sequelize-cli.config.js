// sequelize-cli(마이그레이션 도구)가 읽는 DB 접속 설정.
//
// 애플리케이션과 CLI가 서로 다른 DB를 보는 사고를 막기 위해,
// 별도로 값을 적지 않고 앱이 쓰는 config를 그대로 재사용한다.
const config = require('./index');

const connection = {
  username: config.db.user,
  password: config.db.password,
  database: config.db.name,
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  // 마이그레이션 이력을 저장할 테이블 이름
  migrationStorageTableName: 'sequelize_meta',
  // 한글 데이터가 깨지지 않도록 접속 문자셋을 맞춘다.
  define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
};

// config/index.js가 NODE_ENV에 따라 이미 DB 이름을 정해주므로
// 세 환경 모두 같은 객체를 내보내면 된다.
module.exports = {
  development: connection,
  test: connection,
  production: connection,
};
