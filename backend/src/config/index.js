// 환경 변수(.env)를 프로세스에 로드한다.
require('dotenv').config();

/**
 * 애플리케이션 전역에서 사용하는 설정 값 모음.
 * 환경 변수가 없을 경우를 대비해 기본값을 함께 지정한다.
 */
const config = {
  // 서버 포트 번호
  port: Number(process.env.PORT) || 3000,

  // 실행 환경 (development / production / test)
  env: process.env.NODE_ENV || 'development',

  // 데이터베이스 접속 정보
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'project_heritage',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },

  // CORS 허용 오리진 (프론트엔드 주소)
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
};

module.exports = config;
