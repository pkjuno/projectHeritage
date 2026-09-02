const app = require('./app');
const config = require('./config');
const { connectDatabase, sequelize } = require('./config/database');
const { seedSidos } = require('./seeders/sido.seed');
const { registerJobs } = require('./jobs');

/**
 * 마이그레이션이 적용된 DB인지 확인한다.
 *
 * 서버는 더 이상 스키마를 자동으로 만들지 않으므로(sync 제거),
 * 마이그레이션을 돌리지 않은 상태로 기동하면 첫 요청에서야 알 수 없는 오류가 난다.
 * 기동 시점에 미리 확인해 무엇을 해야 하는지 알려준다.
 * @returns {Promise<void>}
 */
async function assertSchemaReady() {
  const [tables] = await sequelize.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sidos'`,
    { replacements: [config.db.name] }
  );

  if (tables.length === 0) {
    throw new Error(
      `데이터베이스에 테이블이 없습니다. 먼저 마이그레이션을 실행하세요: npm run db:migrate`
    );
  }
}

/**
 * 서버를 부트스트랩(초기화 및 실행)한다.
 * DB 연결 -> 스키마 확인 -> 기준 데이터 적재 -> 배치 등록 순으로 처리한 뒤 리스닝한다.
 */
async function bootstrap() {
  try {
    // 1. 데이터베이스 연결
    await connectDatabase();

    // 2. 마이그레이션이 적용되어 있는지 확인
    await assertSchemaReady();

    // 3. 광역시도 마스터 데이터 적재 (문화재/축제 조회의 기준 데이터)
    await seedSidos();

    // 4. 주기 실행 배치 등록 (방문 하루 전 알림 등)
    registerJobs();

    // 5. HTTP 서버 실행
    app.listen(config.port, () => {
      console.log(`[Server] ${config.env} 환경에서 http://localhost:${config.port} 실행 중`);
    });
  } catch (error) {
    console.error('[Server] 서버 부트스트랩 실패:', error.message);
    process.exit(1);
  }
}

bootstrap();
