// 실제 푸시 전송은 외부 서비스(FCM)에 의존하므로 가짜로 대체한다.
// 알림 생성/조회 로직과 배치 동작은 실제 코드로 검증한다.
jest.mock('../../src/services/pushSender.service');

const pushSender = require('../../src/services/pushSender.service');
const {
  request,
  app,
  resetDatabase,
  createUserAndLogin,
  createFestival,
  authHeader,
} = require('../helpers');
const { runScheduleReminder } = require('../../src/jobs/scheduleReminder.job');
const Notification = require('../../src/models/notification.model');
const User = require('../../src/models/user.model');

describe('알림 (방문 하루 전 리마인더)', () => {
  let me;
  let festival;

  beforeEach(async () => {
    await resetDatabase();
    jest.clearAllMocks();
    // 기본값: 푸시 전송 성공
    pushSender.sendPush.mockResolvedValue(true);

    me = await createUserAndLogin({ email: 'me@example.com' });
    festival = await createFestival({ startDate: '2026-11-05', endDate: '2026-11-07' });
  });

  /**
   * 방문 일정을 등록하는 헬퍼.
   * @param {string} visitDate
   */
  async function addSchedule(visitDate, token = me.token) {
    const response = await request(app)
      .post('/api/users/me/schedules')
      .set(authHeader(token))
      .send({ festivalId: festival.id, visitDate })
      .expect(201);
    return response.body.data;
  }

  describe('배치 - 대상 선정', () => {
    it('내일 방문 예정인 일정에 알림을 만든다', async () => {
      await addSchedule('2026-11-06');

      // 2026-11-05를 "오늘"로 보면 내일은 2026-11-06이다.
      const summary = await runScheduleReminder({ baseDate: new Date('2026-11-05T00:00:00Z') });

      expect(summary.targetDate).toBe('2026-11-06');
      expect(summary.created).toBe(1);

      const notifications = await Notification.findAll({ where: { userId: me.user.id } });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('schedule_reminder');
      expect(notifications[0].body).toContain(festival.name);
      expect(notifications[0].festivalId).toBe(festival.id);
    });

    it('내일이 아닌 일정에는 알림을 만들지 않는다', async () => {
      await addSchedule('2026-11-07');

      const summary = await runScheduleReminder({ baseDate: new Date('2026-11-05T00:00:00Z') });

      expect(summary.targetDate).toBe('2026-11-06');
      expect(summary.created).toBe(0);
      expect(await Notification.count()).toBe(0);
    });

    it('탈퇴한 회원에게는 알림을 만들지 않는다', async () => {
      await addSchedule('2026-11-06');
      await User.update({ status: 'withdrawn' }, { where: { id: me.user.id } });

      const summary = await runScheduleReminder({ baseDate: new Date('2026-11-05T00:00:00Z') });

      expect(summary.created).toBe(0);
    });

    it('daysAhead를 바꾸면 그만큼 앞선 일정을 대상으로 한다', async () => {
      await addSchedule('2026-11-07');

      const summary = await runScheduleReminder({
        baseDate: new Date('2026-11-05T00:00:00Z'),
        daysAhead: 2,
      });

      expect(summary.targetDate).toBe('2026-11-07');
      expect(summary.created).toBe(1);
    });

    it('여러 회원의 일정을 각각 처리한다', async () => {
      const other = await createUserAndLogin({ email: 'other@example.com' });
      await addSchedule('2026-11-06');
      await addSchedule('2026-11-06', other.token);

      const summary = await runScheduleReminder({ baseDate: new Date('2026-11-05T00:00:00Z') });

      expect(summary.created).toBe(2);
      expect(await Notification.count({ where: { userId: me.user.id } })).toBe(1);
      expect(await Notification.count({ where: { userId: other.user.id } })).toBe(1);
    });
  });

  describe('배치 - 멱등성', () => {
    it('여러 번 실행해도 같은 알림이 중복 생성되지 않는다', async () => {
      await addSchedule('2026-11-06');
      const baseDate = new Date('2026-11-05T00:00:00Z');

      const first = await runScheduleReminder({ baseDate });
      const second = await runScheduleReminder({ baseDate });
      const third = await runScheduleReminder({ baseDate });

      expect(first.created).toBe(1);
      expect(second.created).toBe(0);
      expect(second.skipped).toBe(1);
      expect(third.created).toBe(0);

      expect(await Notification.count()).toBe(1);
    });
  });

  describe('푸시 전송 연동', () => {
    it('기기 토큰이 등록되어 있으면 푸시를 시도하고 발송 시각을 남긴다', async () => {
      await request(app)
        .put('/api/users/me/push-settings')
        .set(authHeader(me.token))
        .send({ pushToken: 'device-token-abc' })
        .expect(200);

      await addSchedule('2026-11-06');
      await runScheduleReminder({ baseDate: new Date('2026-11-05T00:00:00Z') });

      expect(pushSender.sendPush).toHaveBeenCalledTimes(1);
      expect(pushSender.sendPush).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'device-token-abc' })
      );

      const notification = await Notification.findOne({ where: { userId: me.user.id } });
      expect(notification.sentAt).not.toBeNull();
    });

    it('기기 토큰이 없으면 푸시는 건너뛰지만 알림함에는 쌓인다', async () => {
      await addSchedule('2026-11-06');
      await runScheduleReminder({ baseDate: new Date('2026-11-05T00:00:00Z') });

      expect(pushSender.sendPush).not.toHaveBeenCalled();
      expect(await Notification.count()).toBe(1);
    });

    it('수신을 거부한 회원에게는 푸시를 보내지 않는다', async () => {
      await request(app)
        .put('/api/users/me/push-settings')
        .set(authHeader(me.token))
        .send({ pushToken: 'device-token-abc', pushEnabled: false })
        .expect(200);

      await addSchedule('2026-11-06');
      await runScheduleReminder({ baseDate: new Date('2026-11-05T00:00:00Z') });

      expect(pushSender.sendPush).not.toHaveBeenCalled();
      // 그래도 알림 이력은 남는다.
      expect(await Notification.count()).toBe(1);
    });

    it('푸시 전송에 실패해도 알림은 남고 sentAt은 비어 있다', async () => {
      pushSender.sendPush.mockResolvedValue(false);

      await request(app)
        .put('/api/users/me/push-settings')
        .set(authHeader(me.token))
        .send({ pushToken: 'device-token-abc' });

      await addSchedule('2026-11-06');
      await runScheduleReminder({ baseDate: new Date('2026-11-05T00:00:00Z') });

      const notification = await Notification.findOne({ where: { userId: me.user.id } });
      expect(notification).not.toBeNull();
      expect(notification.sentAt).toBeNull();
    });
  });

  describe('알림 API', () => {
    beforeEach(async () => {
      await addSchedule('2026-11-06');
      await runScheduleReminder({ baseDate: new Date('2026-11-05T00:00:00Z') });
    });

    it('내 알림 목록과 안 읽은 개수를 조회한다', async () => {
      const response = await request(app)
        .get('/api/users/me/notifications')
        .set(authHeader(me.token))
        .expect(200);

      expect(response.body.data.total).toBe(1);
      expect(response.body.data.unreadCount).toBe(1);
      expect(response.body.data.items[0].festival.name).toBe(festival.name);
    });

    it('알림을 읽음 처리하면 안 읽은 개수가 줄어든다', async () => {
      const list = await request(app).get('/api/users/me/notifications').set(authHeader(me.token));
      const notificationId = list.body.data.items[0].id;

      await request(app)
        .patch(`/api/users/me/notifications/${notificationId}/read`)
        .set(authHeader(me.token))
        .expect(200);

      const after = await request(app).get('/api/users/me/notifications').set(authHeader(me.token));
      expect(after.body.data.unreadCount).toBe(0);
    });

    it('전체 읽음 처리를 할 수 있다', async () => {
      const response = await request(app)
        .patch('/api/users/me/notifications/read-all')
        .set(authHeader(me.token))
        .expect(200);

      expect(response.body.data.updatedCount).toBe(1);

      const after = await request(app).get('/api/users/me/notifications').set(authHeader(me.token));
      expect(after.body.data.unreadCount).toBe(0);
    });

    it('남의 알림은 읽음 처리할 수 없다', async () => {
      const other = await createUserAndLogin({ email: 'other2@example.com' });
      const list = await request(app).get('/api/users/me/notifications').set(authHeader(me.token));
      const notificationId = list.body.data.items[0].id;

      await request(app)
        .patch(`/api/users/me/notifications/${notificationId}/read`)
        .set(authHeader(other.token))
        .expect(404);
    });

    it('비로그인은 알림을 조회할 수 없다', async () => {
      await request(app).get('/api/users/me/notifications').expect(401);
    });
  });

  describe('푸시 설정 API', () => {
    it('기기 토큰 자체는 응답에 노출하지 않는다', async () => {
      const response = await request(app)
        .put('/api/users/me/push-settings')
        .set(authHeader(me.token))
        .send({ pushToken: 'device-token-abc' })
        .expect(200);

      expect(response.body.data.hasPushToken).toBe(true);
      expect(response.body.data.pushToken).toBeUndefined();
    });

    it('로그아웃 시 토큰을 지울 수 있다', async () => {
      await request(app)
        .put('/api/users/me/push-settings')
        .set(authHeader(me.token))
        .send({ pushToken: 'device-token-abc' });

      const response = await request(app)
        .put('/api/users/me/push-settings')
        .set(authHeader(me.token))
        .send({ pushToken: null })
        .expect(200);

      expect(response.body.data.hasPushToken).toBe(false);
    });

    it('변경할 항목이 없으면 400', async () => {
      await request(app)
        .put('/api/users/me/push-settings')
        .set(authHeader(me.token))
        .send({})
        .expect(400);
    });

    it('pushEnabled가 boolean이 아니면 400', async () => {
      await request(app)
        .put('/api/users/me/push-settings')
        .set(authHeader(me.token))
        .send({ pushEnabled: 'yes' })
        .expect(400);
    });
  });
});
