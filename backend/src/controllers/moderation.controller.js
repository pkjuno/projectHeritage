const moderationService = require('../services/moderation.service');
const { success } = require('../utils/response');

/**
 * [POST] /api/community/posts/:id/report
 * 게시글 신고 컨트롤러.
 */
async function reportPost(req, res, next) {
  try {
    const report = await moderationService.reportPost(
      req.user.id,
      Number(req.params.id),
      req.body
    );
    return success(res, 201, '신고가 접수되었습니다.', report);
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/community/comments/:id/report
 * 댓글 신고 컨트롤러.
 */
async function reportComment(req, res, next) {
  try {
    const report = await moderationService.reportComment(
      req.user.id,
      Number(req.params.id),
      req.body
    );
    return success(res, 201, '신고가 접수되었습니다.', report);
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/community/me/blocks
 * 내가 차단한 회원 목록 컨트롤러.
 */
async function listBlocks(req, res, next) {
  try {
    const result = await moderationService.listBlocks(req.user.id, req.query);
    return success(res, 200, '차단 목록 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/community/me/blocks/:userId
 * 회원 차단 컨트롤러.
 */
async function blockUser(req, res, next) {
  try {
    const block = await moderationService.blockUser(req.user.id, Number(req.params.userId));
    return success(res, 201, '차단했습니다. 이 회원의 글과 댓글이 보이지 않습니다.', block);
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/community/me/blocks/:userId
 * 차단 해제 컨트롤러.
 */
async function unblockUser(req, res, next) {
  try {
    await moderationService.unblockUser(req.user.id, Number(req.params.userId));
    return success(res, 200, '차단을 해제했습니다.');
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/community/admin/reports
 * 신고 목록 컨트롤러. (운영자 전용)
 */
async function listReports(req, res, next) {
  try {
    const result = await moderationService.listReports(req.query);
    return success(res, 200, '신고 목록 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [PATCH] /api/community/admin/reports/:targetType/:id
 * 신고 처리 컨트롤러. (운영자 전용)
 */
async function handleReport(req, res, next) {
  try {
    const report = await moderationService.handleReport(
      req.user.id,
      req.params.targetType,
      Number(req.params.id),
      req.body
    );
    return success(res, 200, '신고를 처리했습니다.', report);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  reportPost,
  reportComment,
  listBlocks,
  blockUser,
  unblockUser,
  listReports,
  handleReport,
};
