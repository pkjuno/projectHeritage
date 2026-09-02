const FestivalSchedule = require('../models/festivalSchedule.model');
const Festival = require('../models/festival.model');
const User = require('../models/user.model');
const notificationService = require('./../services/notification.service');
const config = require('../config');
const { formatDate } = require('../utils/dateRange');

/**
 * 방문 예정일 하루 전에 알림을 만들어주는 배치.
 *
 * 일정만 등록해두면 사용자가 직접 앱을 열어보기 전까지 아무 일도 일어나지 않으므로,
 * "내일 축제 있어요"를 알려주는 것이 일정 기능의 나머지 절반이다.
 */

/**
 * 기준일(오늘)로부터 [daysAhead]일 뒤 날짜를 'YYYY-MM-DD'로 구한다.
 * @param {Date} baseDate
 * @param {number} daysAhead
 * @returns {string}
 */
function getTargetDate(baseDate, daysAhead) {
  const target = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate() + daysAhead)
  );
  return formatDate(target);
}

/**
 * 방문 예정일이 [daysAhead]일 뒤인 일정을 찾아 알림을 생성한다.
 *
 * 같은 일정에 대해서는 dedupeKey("schedule_reminder:<일정ID>")로 중복 생성을 막으므로,
 * 배치가 하루에 여러 번 돌거나 재시도되어도 알림은 한 번만 만들어진다.
 *
 * @param {{baseDate?: Date, daysAhead?: number}} [options]
 * @returns {Promise<{targetDate: string, scanned: number, created: number, skipped: number}>}
 */
async function runScheduleReminder({ baseDate = new Date(), daysAhead = 1 } = {}) {
  const targetDate = getTargetDate(baseDate, daysAhead);

  const schedules = await FestivalSchedule.findAll({
    where: { visitDate: targetDate },
    include: [
      { model: Festival, as: 'festival' },
      // 탈퇴 회원에게는 알림을 만들지 않는다.
      { model: User, as: 'user', where: { status: 'active' }, attributes: ['id'] },
    ],
  });

  let created = 0;
  let skipped = 0;

  for (const schedule of schedules) {
    // 축제가 삭제된 일정은 건너뛴다. (CASCADE로 정리되지만 방어적으로 확인)
    if (!schedule.festival) {
      skipped += 1;
      continue;
    }

    const festivalName = schedule.festival.name;
    const place = schedule.festival.location ? ` (${schedule.festival.location})` : '';

    const result = await notificationService.createIfAbsent({
      userId: schedule.userId,
      type: 'schedule_reminder',
      title: '내일 방문 예정인 축제가 있어요',
      body: `${festivalName}${place} 방문일이 내일입니다.`,
      festivalId: schedule.festivalId,
      // 일정 1건당 알림 1건
      dedupeKey: `schedule_reminder:${schedule.id}`,
    });

    if (result.created) {
      created += 1;
    } else {
      skipped += 1;
    }
  }

  const summary = { targetDate, scanned: schedules.length, created, skipped };

  if (config.env !== 'test') {
    console.log(
      `[Job] 방문 하루 전 알림 - 대상일 ${targetDate}: 일정 ${summary.scanned}건 중 ${created}건 생성, ${skipped}건 건너뜀`
    );
  }

  return summary;
}

module.exports = { runScheduleReminder, getTargetDate };
