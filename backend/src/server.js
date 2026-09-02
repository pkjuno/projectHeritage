const app = require('./app');
const config = require('./config');
const { connectDatabase } = require('./config/database');
const { seedSidos } = require('./seeders/sido.seed');

/**
 * 서버를 부트스트랩(초기화 및 실행)한다.
 * 데이터베이스 연결 -> 기준 데이터 적재 순으로 처리한 뒤 HTTP 서버를 리스닝한다.
 */
async function bootstrap() {
  try {
    // 1. 데이터베이스 연결
    await connectDatabase();

    // 2. 광역시도 마스터 데이터 적재 (문화재/축제 조회의 기준 데이터)
    await seedSidos();

    // 3. HTTP 서버 실행
    app.listen(config.port, () => {
      console.log(`[Server] ${config.env} 환경에서 http://localhost:${config.port} 실행 중`);
    });
  } catch (error) {
    console.error('[Server] 서버 부트스트랩 실패:', error);
    process.exit(1);
  }
}

bootstrap();
