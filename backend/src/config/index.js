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

  // 데이터베이스 접속 정보 (MySQL)
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    // 테스트는 테이블을 비우면서 실행되므로 개발/운영 DB와 반드시 분리한다.
    // NODE_ENV=test일 때는 절대 DB_NAME을 쓰지 않는다. (실수로 개발 데이터를 날리는 것을 방지)
    name:
      (process.env.NODE_ENV || 'development') === 'test'
        ? process.env.DB_NAME_TEST || 'project_heritage_test'
        : process.env.DB_NAME || 'project_heritage',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },

  // CORS 허용 오리진 (프론트엔드 주소)
  clientOrigin: process.env.CLIENT_ORIGIN || '*',

  // JWT(Access/Refresh Token) 관련 설정
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'change-this-access-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '14d',
  },

  // 배치(스케줄러) 설정
  jobs: {
    // 방문 하루 전 알림 배치 실행 주기 (기본: 매일 오전 9시)
    scheduleReminderCron: process.env.SCHEDULE_REMINDER_CRON || '0 9 * * *',
  },

  // 프로필 이미지 등 업로드 파일 관련 설정
  upload: {
    // 업로드 파일을 저장할 루트 디렉터리 (프로젝트 루트 기준 상대 경로)
    dir: process.env.UPLOAD_DIR || 'uploads',
    // 업로드 파일을 외부에 노출할 URL 접두사 (예: /uploads/profiles/xxx.jpg)
    urlPath: '/uploads',
    // 프로필 이미지 최대 용량 (기본 5MB)
    maxImageSizeBytes: Number(process.env.UPLOAD_MAX_IMAGE_SIZE) || 5 * 1024 * 1024,
  },
};

module.exports = config;
