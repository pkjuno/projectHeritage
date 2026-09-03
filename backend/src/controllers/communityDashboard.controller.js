const dashboardService = require('../services/communityDashboard.service');
const myActivityService = require('../services/myActivity.service');
const { success } = require('../utils/response');

/**
 * [GET] /api/community/dashboard
 * 커뮤니티 홈 대시보드 컨트롤러.
 *
 * 인기글/최신글/게시판 요약/축제 이야기를 한 번에 내려준다.
 * 로그인한 경우에는 내 활동 요약(myActivity)이 함께 온다.
 */
async function getDashboard(req, res, next) {
  try {
    const data = await dashboardService.getDashboard(req.user?.id);
    return success(res, 200, '커뮤니티 대시보드 조회 성공', data);
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/community/me/posts
 * 내가 쓴 글 목록 컨트롤러.
 */
async function listMyPosts(req, res, next) {
  try {
    const result = await myActivityService.listMyPosts(req.user.id, req.query);
    return success(res, 200, '내가 쓴 글 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/community/me/comments
 * 내가 쓴 댓글 목록 컨트롤러.
 */
async function listMyComments(req, res, next) {
  try {
    const result = await myActivityService.listMyComments(req.user.id, req.query);
    return success(res, 200, '내가 쓴 댓글 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/community/me/reactions
 * 내가 반응한 글 목록 컨트롤러.
 */
async function listMyReactions(req, res, next) {
  try {
    const result = await myActivityService.listMyReactions(req.user.id, req.query);
    return success(res, 200, '내가 반응한 글 조회 성공', result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { getDashboard, listMyPosts, listMyComments, listMyReactions };
