const commentService = require('../services/comment.service');
const { success } = require('../utils/response');

/**
 * [GET] /api/community/posts/:id/comments
 * 댓글 목록 조회 컨트롤러. (최상위 댓글 기준 페이지네이션, 대댓글은 함께)
 */
async function list(req, res, next) {
  try {
    const result = await commentService.list(Number(req.params.id), req.query, req.user);
    return success(res, 200, '댓글 목록 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/community/posts/:id/comments
 * 댓글/대댓글 작성 컨트롤러.
 */
async function create(req, res, next) {
  try {
    const comment = await commentService.create(req.user.id, Number(req.params.id), req.body);
    return success(res, 201, '댓글이 등록되었습니다.', comment);
  } catch (error) {
    return next(error);
  }
}

/**
 * [PUT] /api/community/comments/:id
 * 댓글 수정 컨트롤러. (작성자 본인만)
 */
async function update(req, res, next) {
  try {
    const comment = await commentService.update(req.user.id, Number(req.params.id), req.body);
    return success(res, 200, '댓글이 수정되었습니다.', comment);
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/community/comments/:id
 * 댓글 삭제 컨트롤러. (작성자 본인 또는 운영자)
 */
async function remove(req, res, next) {
  try {
    await commentService.remove(req.user.id, Number(req.params.id));
    return success(res, 200, '댓글이 삭제되었습니다.');
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/community/comments/:id/like
 * 댓글 좋아요 토글 컨트롤러.
 */
async function toggleLike(req, res, next) {
  try {
    const result = await commentService.toggleLike(req.user.id, Number(req.params.id));
    const message = result.liked ? '댓글을 좋아합니다.' : '좋아요를 취소했습니다.';
    return success(res, 200, message, result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, update, remove, toggleLike };
