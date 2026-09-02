const notificationService = require('../services/notification.service');
const profileService = require('../services/profile.service');
const AppError = require('../utils/AppError');
const { success } = require('../utils/response');

/**
 * [GET] /api/users/me/notifications
 * 내 알림 목록 조회 컨트롤러. 안 읽은 개수도 함께 내려준다.
 */
async function list(req, res, next) {
  try {
    const [result, unreadCount] = await Promise.all([
      notificationService.list(req.user.id, req.query),
      notificationService.countUnread(req.user.id),
    ]);

    return success(res, 200, '알림 목록 조회 성공', { ...result, unreadCount });
  } catch (error) {
    return next(error);
  }
}

/**
 * [PATCH] /api/users/me/notifications/read-all
 * 안 읽은 알림을 모두 읽음 처리하는 컨트롤러.
 */
async function readAll(req, res, next) {
  try {
    const updatedCount = await notificationService.markAllAsRead(req.user.id);
    return success(res, 200, '모든 알림을 읽음 처리했습니다.', { updatedCount });
  } catch (error) {
    return next(error);
  }
}

/**
 * [PATCH] /api/users/me/notifications/:id/read
 * 알림 1건을 읽음 처리하는 컨트롤러.
 */
async function read(req, res, next) {
  try {
    const notification = await notificationService.markAsRead(req.user.id, Number(req.params.id));
    return success(res, 200, '알림을 읽음 처리했습니다.', notification);
  } catch (error) {
    return next(error);
  }
}

/**
 * [PUT] /api/users/me/push-settings
 * 푸시 수신 설정과 기기 토큰을 등록/변경하는 컨트롤러.
 * (body: pushEnabled, pushToken)
 */
async function updatePushSettings(req, res, next) {
  try {
    const { pushEnabled, pushToken } = req.body;

    if (pushEnabled === undefined && pushToken === undefined) {
      throw new AppError(400, '변경할 항목이 없습니다. (pushEnabled, pushToken)');
    }

    const user = await profileService.updatePushSettings(req.user.id, { pushEnabled, pushToken });

    return success(res, 200, '알림 설정이 저장되었습니다.', {
      pushEnabled: user.pushEnabled,
      // 기기 토큰 자체는 응답에 그대로 돌려주지 않고 등록 여부만 알려준다.
      hasPushToken: Boolean(user.pushToken),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, read, readAll, updatePushSettings };
