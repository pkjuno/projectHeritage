const reactionService = require('../services/reaction.service');
const { success } = require('../utils/response');

/**
 * [PUT] /api/community/posts/:id/reaction
 * 반응 등록/변경 컨트롤러.
 *
 * 토글(POST .../like)이 아니라 PUT인 이유:
 * '좋아요'에서 '슬퍼요'로 바꾸는 동작이 토글 API로는 표현되지 않는다.
 * 프론트의 하트 버튼은 PUT {type:'like'} 와 DELETE 를 번갈아 호출하면 된다.
 */
async function set(req, res, next) {
  try {
    const result = await reactionService.set(req.user.id, Number(req.params.id), req.body.type);
    return success(res, 200, '반응을 남겼습니다.', result);
  } catch (error) {
    return next(error);
  }
}

/**
 * [DELETE] /api/community/posts/:id/reaction
 * 반응 취소 컨트롤러.
 */
async function remove(req, res, next) {
  try {
    const result = await reactionService.remove(req.user.id, Number(req.params.id));
    return success(res, 200, '반응을 취소했습니다.', result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { set, remove };
