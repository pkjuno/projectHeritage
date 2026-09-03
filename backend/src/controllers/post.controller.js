const postService = require('../services/post.service');
const { success } = require('../utils/response');

/**
 * 응답에 개인화 플래그를 덧붙인다.
 *
 * 목록/상세는 비회원도 볼 수 있으므로 로그인한 경우에만 "내 글인지"를 알려준다.
 * (축제 조회에서 isWishlisted를 함께 내려주는 것과 같은 방식)
 * @param {Post} post
 * @param {{id: number}} [user] - 로그인한 회원 (없으면 비회원)
 */
function withPersonalFlags(post, user) {
  return {
    ...post.toJSON(),
    isMine: Boolean(user) && post.userId === user.id,
  };
}

/**
 * [GET] /api/community/posts
 * 게시글 목록 조회 컨트롤러. (게시판/축제/키워드 필터, 최신순·인기순 정렬)
 */
async function list(req, res, next) {
  try {
    const result = await postService.list(req.query);
    return success(res, 200, '게시글 목록 조회 성공', {
      ...result,
      items: result.items.map((post) => withPersonalFlags(post, req.user)),
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * [GET] /api/community/posts/:id
 * 게시글 상세 조회 컨트롤러. (조회수 집계 포함)
 */
async function getById(req, res, next) {
  try {
    const post = await postService.getById(Number(req.params.id), req);
    return success(res, 200, '게시글 조회 성공', withPersonalFlags(post, req.user));
  } catch (error) {
    return next(error);
  }
}

/**
 * [POST] /api/community/posts
 * 게시글 작성 컨트롤러.
 */
async function create(req, res, next) {
  try {
    const post = await postService.create(req.user.id, req.body);
    return success(res, 201, '게시글이 등록되었습니다.', withPersonalFlags(post, req.user));
  } catch (error) {
    return next(error);
  }
}

/**
 * [PUT] /api/community/posts/:id
 * 게시글 수정 컨트롤러. (작성자 본인만)
 */
async function update(req, res, next) {
  try {
    const post = await postService.update(req.user.id, Number(req.params.id), req.body);
    return success(res, 200, '게시글이 수정되었습니다.', withPersonalFlags(post, req.user));
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/community/posts/:id
 * 게시글 삭제 컨트롤러. (작성자 본인 또는 운영자)
 */
async function remove(req, res, next) {
  try {
    await postService.remove(req.user.id, Number(req.params.id));
    return success(res, 200, '게시글이 삭제되었습니다.');
  } catch (error) {
    return next(error);
  }
}

/**
 * [PATCH] /api/community/posts/:id/pin
 * 게시글 상단 고정 토글 컨트롤러. (운영자 전용)
 */
async function setPinned(req, res, next) {
  try {
    const post = await postService.setPinned(Number(req.params.id), req.body.isPinned);
    return success(res, 200, post.isPinned ? '글을 상단에 고정했습니다.' : '고정을 해제했습니다.', post);
  } catch (error) {
    return next(error);
  }
}

/**
 * [PATCH] /api/community/posts/:id/hide
 * 게시글 블라인드 처리 컨트롤러. (운영자 전용)
 */
async function setHidden(req, res, next) {
  try {
    const post = await postService.setHidden(Number(req.params.id), req.body.hidden);
    const message = post.status === 'hidden' ? '글을 숨김 처리했습니다.' : '숨김을 해제했습니다.';
    return success(res, 200, message, post);
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, getById, create, update, remove, setPinned, setHidden };
