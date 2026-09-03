const Notification = require('../models/notification.model');
const Festival = require('../models/festival.model');
const Post = require('../models/post.model');
const userService = require('./user.service');
const pushSender = require('./pushSender.service');
const AppError = require('../utils/AppError');
const { parsePagination, toPagedResult } = require('../utils/pagination');

/**
 * 알림 생성/조회 서비스.
 */

/**
 * 알림을 생성하고, 수신 동의한 회원에게는 푸시도 시도한다.
 *
 * dedupeKey가 같은 알림이 이미 있으면 새로 만들지 않는다.
 * (배치가 재실행되어도 같은 알림이 두 번 가지 않도록 하는 안전장치)
 *
 * @param {{userId: number, type: string, title: string, body: string, festivalId?: number, postId?: number, dedupeKey: string}} payload
 * @returns {Promise<{notification: Notification, created: boolean}>}
 */
async function createIfAbsent({
  userId,
  type,
  title,
  body,
  festivalId = null,
  postId = null,
  dedupeKey,
}) {
  const [notification, created] = await Notification.findOrCreate({
    where: { userId, dedupeKey },
    defaults: { userId, type, title, body, festivalId, postId, dedupeKey },
  });

  if (!created) {
    return { notification, created: false };
  }

  const user = await userService.findById(userId);

  // 수신 거부했거나 기기 토큰이 없으면 알림함에만 쌓아둔다.
  if (user?.pushEnabled && user.pushToken) {
    const sent = await pushSender.sendPush({
      token: user.pushToken,
      title,
      body,
      // 앱이 알림을 눌렀을 때 어느 화면으로 갈지 판단하는 데 쓴다.
      data: {
        type,
        notificationId: String(notification.id),
        festivalId: festivalId ? String(festivalId) : '',
        // 커뮤니티 알림은 축제가 아니라 게시글 화면으로 이동해야 한다.
        postId: postId ? String(postId) : '',
      },
    });

    if (sent) {
      notification.sentAt = new Date();
      await notification.save();
    }
  }

  return { notification, created: true };
}

/**
 * 내 알림 목록을 최신순으로 조회한다.
 * @param {number} userId
 * @param {{page?: string, limit?: string}} query
 */
async function list(userId, query = {}) {
  const pagination = parsePagination(query);

  const result = await Notification.findAndCountAll({
    where: { userId },
    include: [
      { model: Festival, as: 'festival', attributes: ['id', 'name', 'startDate', 'endDate'] },
      // 앱이 알림을 눌렀을 때 축제 상세로 갈지 게시글 상세로 갈지 판단할 수 있도록
      // 연결된 게시글 정보도 함께 내려준다.
      { model: Post, as: 'post', attributes: ['id', 'title', 'status'] },
    ],
    limit: pagination.limit,
    offset: pagination.offset,
    order: [['createdAt', 'DESC']],
  });

  return toPagedResult(result, pagination);
}

/**
 * 안 읽은 알림 개수를 센다. (앱의 뱃지 표시용)
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function countUnread(userId) {
  return Notification.count({ where: { userId, readAt: null } });
}

/**
 * 알림 1건을 읽음 처리한다.
 * @param {number} userId
 * @param {number} notificationId
 * @returns {Promise<Notification>}
 */
async function markAsRead(userId, notificationId) {
  const notification = await Notification.findOne({ where: { id: notificationId, userId } });

  if (!notification) {
    throw new AppError(404, '알림을 찾을 수 없습니다.');
  }

  // 이미 읽은 알림이면 시각을 덮어쓰지 않는다.
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
}

/**
 * 안 읽은 알림을 모두 읽음 처리한다.
 * @param {number} userId
 * @returns {Promise<number>} 읽음 처리된 개수
 */
async function markAllAsRead(userId) {
  const [updatedCount] = await Notification.update(
    { readAt: new Date() },
    { where: { userId, readAt: null } }
  );

  return updatedCount;
}

module.exports = { createIfAbsent, list, countUnread, markAsRead, markAllAsRead };
