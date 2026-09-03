const { Op } = require('sequelize');
const Post = require('../models/post.model');
const PostComment = require('../models/postComment.model');
const PostReport = require('../models/postReport.model');
const CommentReport = require('../models/commentReport.model');
const UserBlock = require('../models/userBlock.model');
const User = require('../models/user.model');
const userService = require('./user.service');
const AppError = require('../utils/AppError');
const { parsePagination, toPagedResult } = require('../utils/pagination');

/**
 * 신고 / 차단 / 운영자 처리 서비스.
 *
 * 신고와 차단은 답하는 질문이 다르다.
 *  - 신고: "이 글을 운영자가 봐줬으면 좋겠다" — 공개 조치 요청
 *  - 차단: "이 사람 글을 나만 안 보고 싶다" — 개인 설정
 */

// 신고 사유가 '기타'일 때 설명을 반드시 받는다.
const DETAIL_REQUIRED_REASON = 'etc';
const DETAIL_MAX = 500;

/**
 * 신고 입력값을 검증한다.
 * @param {{reason?: string, detail?: string}} body
 * @returns {{reason: string, detail: string|null}}
 */
function validateReport(body = {}) {
  const { reason, detail } = body;

  if (!PostReport.REPORT_REASONS.includes(reason)) {
    throw new AppError(
      400,
      `신고 사유는 ${PostReport.REPORT_REASONS.join(', ')} 중 하나여야 합니다.`
    );
  }

  const trimmed = String(detail ?? '').trim();

  // '기타'로 신고하면서 설명이 없으면 운영자가 무엇을 봐야 할지 알 수 없다.
  if (reason === DETAIL_REQUIRED_REASON && trimmed.length === 0) {
    throw new AppError(400, "사유가 '기타'인 경우 설명을 입력해 주세요.");
  }

  if (trimmed.length > DETAIL_MAX) {
    throw new AppError(400, `설명은 ${DETAIL_MAX}자 이하로 입력해 주세요.`);
  }

  return { reason, detail: trimmed.length > 0 ? trimmed : null };
}

/**
 * 게시글을 신고한다.
 *
 * 신고가 쌓였다고 글이 자동으로 숨겨지지는 않는다.
 * 자동 숨김을 넣으면 여러 계정으로 신고를 몰아 남의 글을 지우는 도구가 된다.
 *
 * @param {number} userId
 * @param {number} postId
 * @param {{reason?: string, detail?: string}} body
 * @returns {Promise<PostReport>}
 */
async function reportPost(userId, postId, body) {
  const { reason, detail } = validateReport(body);
  const post = await Post.findByPk(postId);

  if (!post || !post.isVisible()) {
    throw new AppError(404, '게시글을 찾을 수 없습니다.');
  }

  // 자기 글을 신고하는 것은 의미가 없다. 지우면 된다.
  if (post.userId === userId) {
    throw new AppError(400, '본인이 작성한 글은 신고할 수 없습니다.');
  }

  const [report, created] = await PostReport.findOrCreate({
    where: { reporterId: userId, postId },
    defaults: { reporterId: userId, postId, reason, detail },
  });

  if (!created) {
    throw new AppError(409, '이미 신고한 게시글입니다.');
  }

  return report;
}

/**
 * 댓글을 신고한다.
 * @param {number} userId
 * @param {number} commentId
 * @param {{reason?: string, detail?: string}} body
 * @returns {Promise<CommentReport>}
 */
async function reportComment(userId, commentId, body) {
  const { reason, detail } = validateReport(body);
  const comment = await PostComment.findByPk(commentId);

  if (!comment || comment.status === 'deleted') {
    throw new AppError(404, '댓글을 찾을 수 없습니다.');
  }

  if (comment.userId === userId) {
    throw new AppError(400, '본인이 작성한 댓글은 신고할 수 없습니다.');
  }

  const [report, created] = await CommentReport.findOrCreate({
    where: { reporterId: userId, commentId },
    defaults: { reporterId: userId, commentId, reason, detail },
  });

  if (!created) {
    throw new AppError(409, '이미 신고한 댓글입니다.');
  }

  return report;
}

// --- 차단 ---

/**
 * 회원을 차단한다.
 * @param {number} userId - 차단하는 사람
 * @param {number} blockedUserId - 차단당하는 사람
 * @returns {Promise<UserBlock>}
 */
async function blockUser(userId, blockedUserId) {
  if (userId === blockedUserId) {
    throw new AppError(400, '자기 자신은 차단할 수 없습니다.');
  }

  const target = await userService.findById(blockedUserId);
  if (!target || target.status === 'withdrawn') {
    throw new AppError(404, '회원을 찾을 수 없습니다.');
  }

  // 운영자를 차단하면 공지사항이 보이지 않게 된다.
  if (target.isAdmin()) {
    throw new AppError(400, '운영자는 차단할 수 없습니다.');
  }

  const [block, created] = await UserBlock.findOrCreate({
    where: { userId, blockedUserId },
  });

  if (!created) {
    throw new AppError(409, '이미 차단한 회원입니다.');
  }

  return block;
}

/**
 * 차단을 해제한다.
 * @param {number} userId
 * @param {number} blockedUserId
 * @returns {Promise<void>}
 */
async function unblockUser(userId, blockedUserId) {
  const deleted = await UserBlock.destroy({ where: { userId, blockedUserId } });

  if (deleted === 0) {
    throw new AppError(404, '차단하지 않은 회원입니다.');
  }
}

/**
 * 내가 차단한 회원 목록.
 * @param {number} userId
 * @param {object} query
 */
async function listBlocks(userId, query = {}) {
  const pagination = parsePagination(query);

  const result = await UserBlock.findAndCountAll({
    where: { userId },
    include: [
      {
        model: User,
        as: 'blockedUser',
        attributes: ['id', 'name', 'nickname', 'profileImageUrl'],
      },
    ],
    limit: pagination.limit,
    offset: pagination.offset,
    order: [['createdAt', 'DESC']],
  });

  return toPagedResult(result, pagination);
}

/**
 * 내가 차단한 회원 ID 목록을 구한다.
 *
 * 목록 조회마다 호출되므로 ID만 가볍게 가져온다.
 * @param {number|undefined} userId
 * @returns {Promise<number[]>}
 */
async function getBlockedUserIds(userId) {
  if (!userId) return [];

  const blocks = await UserBlock.findAll({
    where: { userId },
    attributes: ['blockedUserId'],
    raw: true,
  });

  return blocks.map((block) => block.blockedUserId);
}

/**
 * 목록 조회의 where 조건에 "차단한 사람 글 제외"를 붙인다.
 *
 * 차단은 삭제가 아니므로 원본은 그대로 두고, 조회하는 쪽에서만 걸러낸다.
 * @param {object} where - Sequelize where 절
 * @param {number[]} blockedIds
 * @returns {object} 조건이 추가된 where
 */
function excludeBlocked(where, blockedIds) {
  if (blockedIds.length === 0) return where;
  return { ...where, userId: { [Op.notIn]: blockedIds } };
}

// --- 운영자 처리 ---

/**
 * 처리 대기 중인 신고 목록을 조회한다. (운영자 전용)
 *
 * 게시글 신고와 댓글 신고를 한 번에 보여준다.
 * 운영자가 두 화면을 오가게 만들면 놓치는 신고가 생긴다.
 *
 * @param {{status?: string, page?: string, limit?: string}} query
 */
async function listReports(query = {}) {
  const status = query.status ?? 'pending';

  if (!PostReport.REPORT_STATUSES.includes(status)) {
    throw new AppError(400, '알 수 없는 처리 상태입니다.');
  }

  const pagination = parsePagination(query);
  const reporterInclude = {
    model: User,
    as: 'reporter',
    attributes: ['id', 'name', 'nickname'],
  };

  const [postReports, commentReports] = await Promise.all([
    PostReport.findAll({
      where: { status },
      include: [
        reporterInclude,
        { model: Post, as: 'post', attributes: ['id', 'title', 'status', 'userId'] },
      ],
      order: [['createdAt', 'DESC']],
    }),
    CommentReport.findAll({
      where: { status },
      include: [
        reporterInclude,
        {
          model: PostComment,
          as: 'comment',
          attributes: ['id', 'postId', 'content', 'status', 'userId'],
        },
      ],
      order: [['createdAt', 'DESC']],
    }),
  ]);

  // 두 종류를 하나의 시간순 목록으로 합친다.
  const merged = [
    ...postReports.map((report) => ({ ...report.toJSON(), targetType: 'post' })),
    ...commentReports.map((report) => ({ ...report.toJSON(), targetType: 'comment' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // 합친 뒤 자르므로 DB 페이지네이션을 쓸 수 없다.
  // 처리 대기 신고는 많아야 수백 건이라 지금은 문제되지 않는다.
  // 규모가 커지면 신고를 한 테이블로 합치거나 UNION 쿼리로 옮겨야 한다.
  const page = merged.slice(pagination.offset, pagination.offset + pagination.limit);

  return toPagedResult({ rows: page, count: merged.length }, pagination);
}

/**
 * 신고를 처리한다. (운영자 전용)
 *
 * @param {number} adminId
 * @param {'post'|'comment'} targetType
 * @param {number} reportId
 * @param {{status?: string, hide?: boolean}} body
 *   status - resolved(조치함) 또는 rejected(문제 없음)
 *   hide   - true면 대상 글/댓글을 함께 숨긴다
 * @returns {Promise<object>}
 */
async function handleReport(adminId, targetType, reportId, body = {}) {
  const status = body.status ?? 'resolved';

  if (!['resolved', 'rejected'].includes(status)) {
    throw new AppError(400, "처리 상태는 resolved 또는 rejected여야 합니다.");
  }

  const isPost = targetType === 'post';
  const Model = isPost ? PostReport : CommentReport;
  const report = await Model.findByPk(reportId);

  if (!report) {
    throw new AppError(404, '신고를 찾을 수 없습니다.');
  }

  if (report.status !== 'pending') {
    throw new AppError(409, '이미 처리된 신고입니다.');
  }

  // 같은 대상에 대한 다른 신고들도 함께 처리한다.
  // 하나씩 처리하게 두면 같은 글에 대한 신고 10건이 목록에 10번 남는다.
  const targetKey = isPost ? { postId: report.postId } : { commentId: report.commentId };

  await Model.update(
    { status, handledBy: adminId, handledAt: new Date() },
    { where: { ...targetKey, status: 'pending' } }
  );

  // 요청하면 대상을 숨긴다. 신고 처리와 숨김은 별개의 판단이므로 자동으로 하지 않는다.
  if (body.hide === true) {
    if (isPost) {
      await Post.update({ status: 'hidden' }, { where: { id: report.postId } });
    } else {
      await PostComment.update({ status: 'deleted' }, { where: { id: report.commentId } });
    }
  }

  return Model.findByPk(reportId);
}

/**
 * 특정 게시글에 쌓인 처리 대기 신고 수. (게시글 상세의 운영자 표시용)
 * @param {number} postId
 * @returns {Promise<number>}
 */
async function countPendingReports(postId) {
  return PostReport.count({ where: { postId, status: 'pending' } });
}

module.exports = {
  reportPost,
  reportComment,
  blockUser,
  unblockUser,
  listBlocks,
  getBlockedUserIds,
  excludeBlocked,
  listReports,
  handleReport,
  countPendingReports,
};
