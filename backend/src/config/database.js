const config = require('./index');

/**
 * 데이터베이스 연결을 초기화한다.
 * 실제 프로젝트에서는 사용하는 ORM/드라이버(mysql2, pg, mongoose 등)로 교체해서 구현한다.
 * 지금은 기본 구조만 잡아두는 자리표시자(placeholder) 함수이다.
 * @returns {Promise<void>} 연결 성공 시 resolve되는 Promise
 */
async function connectDatabase() {
  // TODO: 실제 DB 드라이버로 연결 로직 구현
  console.log(
    `[DB] ${config.db.host}:${config.db.port}/${config.db.name} 연결 준비 완료 (placeholder)`
  );
}

module.exports = { connectDatabase };
