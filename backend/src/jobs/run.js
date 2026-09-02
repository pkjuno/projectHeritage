const { connectDatabase } = require('../config/database');
const { runScheduleReminder } = require('./scheduleReminder.job');

/**
 * 배치를 수동으로 실행하는 CLI.
 * 스케줄러를 기다리지 않고 바로 확인하거나, 배치가 실패한 날 다시 돌릴 때 사용한다.
 *
 * 사용법:
 *   npm run job:reminder                    오늘 기준 내일 방문 일정에 알림 생성
 *   npm run job:reminder -- --days=3        3일 뒤 방문 일정에 알림 생성
 *   npm run job:reminder -- --date=2026-11-05  특정 날짜를 "오늘"로 간주해 실행
 */
async function main() {
  const args = process.argv.slice(2);

  const daysArg = args.find((arg) => arg.startsWith('--days='));
  const dateArg = args.find((arg) => arg.startsWith('--date='));

  const daysAhead = daysArg ? Number(daysArg.split('=')[1]) : 1;
  const baseDate = dateArg ? new Date(`${dateArg.split('=')[1]}T00:00:00.000Z`) : new Date();

  if (Number.isNaN(daysAhead) || Number.isNaN(baseDate.getTime())) {
    console.error('사용법: npm run job:reminder -- [--days=1] [--date=YYYY-MM-DD]');
    process.exitCode = 1;
    return;
  }

  await connectDatabase();

  const summary = await runScheduleReminder({ baseDate, daysAhead });
  console.log('[Job] 실행 결과:', summary);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error('[Job] 실행 중 오류가 발생했습니다:', error.message);
    process.exit(1);
  });
