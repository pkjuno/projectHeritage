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

  // 커뮤니티(게시판) 관련 설정
  community: {
    // 비로그인 방문자의 IP를 해시할 때 쓰는 키.
    //
    // IPv4 주소 공간은 43억 개뿐이라 소금(salt) 없이 해시하면 전수 대입으로 원본을 복원할 수 있다.
    // 조회수를 세자고 방문자의 IP를 복원 가능한 형태로 남길 이유가 없으므로 반드시 비밀 값을 쓴다.
    // JWT 서명 키를 재사용하지 않는 이유: 용도가 다른 키를 섞으면 한쪽이 유출됐을 때 피해가 번진다.
    viewHashSecret: process.env.POST_VIEW_HASH_SECRET || 'change-this-view-hash-secret',
    // 게시글 목록 인기순 정렬에서 쓰는 가중치 (반응 > 댓글 > 조회)
    popularWeight: { reaction: 3, comment: 2, view: 0.1 },
  },

  // 프로필 이미지 등 업로드 파일 관련 설정
  upload: {
    // 업로드 파일을 저장할 루트 디렉터리 (프로젝트 루트 기준 상대 경로)
    dir: process.env.UPLOAD_DIR || 'uploads',
    // 업로드 파일을 외부에 노출할 URL 접두사 (예: /uploads/profiles/xxx.jpg)
    urlPath: '/uploads',
    // 프로필 이미지 최대 용량 (기본 5MB)
    maxImageSizeBytes: Number(process.env.UPLOAD_MAX_IMAGE_SIZE) || 5 * 1024 * 1024,
    // 게시글 한 건에 첨부할 수 있는 이미지 수.
    // 제한이 없으면 한 번의 요청으로 디스크를 채울 수 있다.
    maxPostImages: Number(process.env.UPLOAD_MAX_POST_IMAGES) || 5,
  },
};

module.exports = config;
