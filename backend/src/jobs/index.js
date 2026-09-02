const cron = require('node-cron');
const config = require('../config');
const { runScheduleReminder } = require('./scheduleReminder.job');

/**
 * 서버 기동 시 주기 실행할 배치를 등록한다.
 *
 * 주의: 서버를 여러 대로 늘리면 인스턴스마다 배치가 돌아 알림이 중복 시도된다.
 * 알림 자체는 dedupeKey로 중복 생성이 막히지만, 규모가 커지면
 * 배치를 별도 워커로 분리하거나 분산 락을 쓰는 것이 좋다.
 *
 * @returns {void}
 */
function registerJobs() {
  // 테스트 중에는 타이머가 남아 프로세스가 종료되지 않으므로 등록하지 않는다.
  if (config.env === 'test') return;

  // 매일 오전 9시(서버 시간)에 "내일 방문 예정" 알림을 만든다.
  cron.schedule(config.jobs.scheduleReminderCron, async () => {
    try {
      await runScheduleReminder();
    } catch (error) {
      // 배치가 실패해도 서버는 계속 떠 있어야 한다.
      console.error('[Job] 방문 하루 전 알림 실행 실패:', error.message);
    }
  });

  console.log(`[Job] 방문 하루 전 알림 배치 등록 완료 (cron: ${config.jobs.scheduleReminderCron})`);
}

module.exports = { registerJobs };
