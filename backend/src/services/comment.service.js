const { literal } = require('sequelize');
const { sequelize } = require('../config/database');
const Post = require('../models/post.model');
const PostComment = require('../models/postComment.model');
const CommentLike = require('../models/commentLike.model');
const User = require('../models/user.model');
const userService = require('./user.service');
const AppError = require('../utils/AppError');
const { parsePagination, toPagedResult } = require('../utils/pagination');

// 댓글 길이 제한. 본문(10000자)보다 훨씬 짧게 잡는다.
const CONTENT_MIN = 1;
const CONTENT_MAX = 1000;

// 삭제된 댓글 자리에 대신 보여줄 문구
const DELETED_PLACEHOLDER = '삭제된 댓글입니다.';

// 댓글 작성자 정보. attributes를 지정하지 않으면 비밀번호 해시까지 응답에 실려 나간다.
const AUTHOR_INCLUDE = {
  model: User,
  as: 'author',
  attributes: ['id', 'name', 'nickname', 'profileImageUrl'],
};

/**
 * 댓글을 조회하고 없으면 404를 던진다.
 * @param {number} commentId
 * @param {import('sequelize').Transaction} [transaction]
 * @returns {Promise<PostComment>}
 */
async function findCommentOrThrow(commentId, transaction) {
  const comment = await PostComment.findByPk(commentId, { transaction });

  if (!comment || comment.status === 'deleted') {
    throw new AppError(404, '댓글을 찾을 수 없습니다.');
  }

  return comment;
}

/**
 * 댓글을 달 수 있는 게시글인지 확인하고 반환한다.
 *
 * 숨김/삭제된 글에는 댓글을 달 수 없다. 존재를 알릴 이유가 없으므로 404다.
 * @param {number} postId
 * @param {import('sequelize').Transaction} [transaction]
 * @returns {Promise<Post>}
 */
async function findWritablePostOrThrow(postId, transaction) {
  const post = await Post.findByPk(postId, { transaction });

  if (!post || !post.isVisible()) {
    throw new AppError(404, '게시글을 찾을 수 없습니다.');
  }

  return post;
}

/**
 * 댓글 본문을 검증하고 앞뒤 공백을 제거한 값을 돌려준다.
 * @param {string} content
 * @returns {string}
 */
function validateContent(content) {
  const trimmed = String(content ?? '').trim();

  if (trimmed.length < CONTENT_MIN || trimmed.length > CONTENT_MAX) {
    throw new AppError(400, `댓글은 ${CONTENT_MIN}자 이상 ${CONTENT_MAX}자 이하로 입력해 주세요.`);
  }

  return trimmed;
}

/**
 * 대댓글의 부모를 결정한다.
 *
 * 깊이는 1단계까지만 허용한다. 대댓글에 답글을 달면 그 대댓글이 아니라
 * **최상위 댓글**을 부모로 삼는다. 무한 depth는 모바일에서 들여쓰기를 감당할 수 없고
 * 조회가 재귀 쿼리로 간다.
 *
 * @param {number|undefined|null} parentId - 클라이언트가 보낸 부모 댓글 ID
 * @param {number} postId - 댓글이 달릴 게시글
 * @param {import('sequelize').Transaction} transaction
 * @returns {Promise<number|null>} 실제로 저장할 parentId
 */
async function resolveParentId(parentId, postId, transaction) {
  if (!parentId) return null;

  const parent = await PostComment.findByPk(parentId, { transaction });

  if (!parent || parent.status === 'deleted') {
    throw new AppError(404, '답글을 달 댓글을 찾을 수 없습니다.');
  }

  // 다른 글의 댓글을 부모로 지정해 댓글을 옮겨 붙이는 것을 막는다.
  if (parent.postId !== postId) {
    throw new AppError(400, '다른 게시글의 댓글에는 답글을 달 수 없습니다.');
  }

  // 부모가 이미 대댓글이면 그 부모(최상위 댓글)에 붙인다.
  return parent.parentId ?? parent.id;
}

/**
 * 게시글의 댓글 목록을 조회한다.
 *
 * 최상위 댓글을 기준으로 페이지를 나누고, 각 댓글의 대댓글은 모두 함께 내려준다.
 * 대댓글까지 잘라서 페이지를 나누면 "답글 3개 중 1개만 보이는" 화면이 나온다.
 *
 * @param {number} postId
 * @param {{page?: string, limit?: string}} query
 * @param {{id: number}} [currentUser] - 로그인한 회원 (isMine/isLiked 판단용)
 */
async function list(postId, query = {}, currentUser) {
  await findWritablePostOrThrow(postId);

  const pagination = parsePagination(query);

  // 1) 최상위 댓글만 페이지네이션해서 가져온다.
  const parents = await PostComment.findAndCountAll({
    where: { postId, parentId: null },
    include: [AUTHOR_INCLUDE],
    limit: pagination.limit,
    offset: pagination.offset,
    order: [['createdAt', 'ASC']],
  });

  const parentIds = parents.rows.map((comment) => comment.id);

  // 2) 그 댓글들에 달린 대댓글을 한 번에 가져온다. (댓글 수만큼 쿼리하지 않기 위해)
  const replies = parentIds.length
    ? await PostComment.findAll({
        where: { parentId: parentIds },
        include: [AUTHOR_INCLUDE],
        order: [['createdAt', 'ASC']],
      })
    : [];

  // 3) 내가 좋아요한 댓글을 한 번에 조회한다.
  const allIds = [...parentIds, ...replies.map((reply) => reply.id)];
  const likedIds = await getLikedCommentIds(currentUser?.id, allIds);

  const repliesByParent = new Map();
  for (const reply of replies) {
    const bucket = repliesByParent.get(reply.parentId) ?? [];
    bucket.push(toResponse(reply, currentUser, likedIds));
    repliesByParent.set(reply.parentId, bucket);
  }

  const items = parents.rows
    .map((parent) => ({
      ...toResponse(parent, currentUser, likedIds),
      replies: repliesByParent.get(parent.id) ?? [],
    }))
    // 삭제된 댓글은 답글이 남아 있을 때만 자리를 지킨다.
    // 답글이 없으면 "삭제된 댓글입니다"만 덩그러니 남을 이유가 없다.
    .filter((comment) => comment.status !== 'deleted' || comment.replies.length > 0);

  return toPagedResult({ rows: items, count: parents.count }, pagination);
}

/**
 * 내가 좋아요를 누른 댓글 ID 집합을 구한다.
 * @param {number|undefined} userId
 * @param {number[]} commentIds
 * @returns {Promise<Set<number>>}
 */
async function getLikedCommentIds(userId, commentIds) {
  if (!userId || commentIds.length === 0) return new Set();

  const likes = await CommentLike.findAll({
    where: { userId, commentId: commentIds },
    attributes: ['commentId'],
  });

  return new Set(likes.map((like) => like.commentId));
}

/**
 * 댓글을 응답 형태로 바꾼다.
 *
 * 삭제된 댓글은 행을 남기되 내용은 가린다. 자식 대댓글이 붙어 있는 댓글을
 * 통째로 지우면 대화 맥락이 끊기기 때문에 자리만 남기는 것이다.
 * 작성자 정보도 함께 가린다. 내용만 가리고 이름을 남기면 누가 무엇을 지웠는지가 드러난다.
 *
 * @param {PostComment} comment
 * @param {{id: number}} [currentUser]
 * @param {Set<number>} likedIds
 */
function toResponse(comment, currentUser, likedIds) {
  const isDeleted = comment.status === 'deleted';

  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    content: isDeleted ? DELETED_PLACEHOLDER : comment.content,
    status: comment.status,
    likeCount: isDeleted ? 0 : comment.likeCount,
    author: isDeleted ? null : comment.author,
    isMine: !isDeleted && Boolean(currentUser) && comment.userId === currentUser.id,
    isLiked: !isDeleted && likedIds.has(comment.id),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

/**
 * 댓글 또는 대댓글을 작성한다.
 *
 * 댓글 생성과 게시글의 댓글 수 증가는 반드시 같은 트랜잭션에서 처리한다.
 * 따로 두면 댓글은 달렸는데 목록의 댓글 수는 그대로인 상태가 생긴다.
 *
 * @param {number} userId
 * @param {number} postId
 * @param {{content?: string, parentId?: number}} body
 * @returns {Promise<object>}
 */
async function create(userId, postId, body = {}) {
  const content = validateContent(body.content);

  const comment = await sequelize.transaction(async (transaction) => {
    await findWritablePostOrThrow(postId, transaction);
    const parentId = await resolveParentId(body.parentId, postId, transaction);

    const created = await PostComment.create(
      { postId, userId, parentId, content },
      { transaction }
    );

    await Post.increment('commentCount', { by: 1, where: { id: postId }, transaction });

    return created;
  });

  // 알림은 트랜잭션이 커밋된 뒤에 보낸다.
  // 안에서 보내면 알림 저장 실패가 댓글 작성까지 롤백시킨다.
  // (순환 참조를 피하려고 함수 안에서 require 한다)
  await require('./communityNotifier.service').notifyCommentCreated(comment);

  const withAuthor = await PostComment.findByPk(comment.id, { include: [AUTHOR_INCLUDE] });
  return toResponse(withAuthor, { id: userId }, new Set());
}

/**
 * 댓글을 수정한다. 작성자 본인만 가능하다. (게시글과 동일하게 운영자도 수정할 수 없다)
 * @param {number} userId
 * @param {number} commentId
 * @param {{content?: string}} body
 * @returns {Promise<object>}
 */
async function update(userId, commentId, body = {}) {
  const comment = await findCommentOrThrow(commentId);

  if (!comment.isEditableBy({ id: userId })) {
    throw new AppError(403, '본인이 작성한 댓글만 수정할 수 있습니다.');
  }

  await comment.update({ content: validateContent(body.content) });

  const withAuthor = await PostComment.findByPk(comment.id, { include: [AUTHOR_INCLUDE] });
  const likedIds = await getLikedCommentIds(userId, [comment.id]);
  return toResponse(withAuthor, { id: userId }, likedIds);
}

/**
 * 댓글을 삭제한다. 작성자 본인 또는 운영자만 가능하다.
 *
 * 행을 지우지 않고 상태만 바꾼다. 대댓글이 붙어 있는 댓글을 물리 삭제하면
 * 대화 맥락이 끊기기 때문이다. 화면에 보이는 댓글 수는 줄어야 하므로 카운터는 내린다.
 *
 * @param {number} userId
 * @param {number} commentId
 * @returns {Promise<void>}
 */
async function remove(userId, commentId) {
  const actor = await userService.findById(userId);

  if (!actor || actor.status === 'withdrawn') {
    throw new AppError(401, '유효하지 않은 회원입니다.');
  }

  await sequelize.transaction(async (transaction) => {
    const comment = await findCommentOrThrow(commentId, transaction);

    if (!comment.isDeletableBy(actor)) {
      throw new AppError(403, '본인이 작성한 댓글만 삭제할 수 있습니다.');
    }

    await comment.update({ status: 'deleted' }, { transaction });

    // GREATEST로 감싸 카운터가 음수로 내려가는 것을 원천 차단한다.
    // 어딘가에서 증가를 빠뜨렸더라도 "-1개의 댓글"이 화면에 나오지는 않게 한다.
    await Post.update(
      { commentCount: literal('GREATEST(comment_count - 1, 0)') },
      { where: { id: comment.postId }, transaction }
    );
  });
}

/**
 * 댓글 좋아요를 토글한다. (누른 적 없으면 등록, 있으면 취소)
 *
 * 좋아요 행과 댓글의 좋아요 수는 같은 트랜잭션에서 함께 움직인다.
 * @param {number} userId
 * @param {number} commentId
 * @returns {Promise<{liked: boolean, likeCount: number}>}
 */
async function toggleLike(userId, commentId) {
  return sequelize.transaction(async (transaction) => {
    const comment = await findCommentOrThrow(commentId, transaction);

    const existing = await CommentLike.findOne({
      where: { userId, commentId },
      transaction,
    });

    if (existing) {
      await existing.destroy({ transaction });
      await PostComment.update(
        { likeCount: literal('GREATEST(like_count - 1, 0)') },
        { where: { id: commentId }, transaction }
      );
    } else {
      await CommentLike.create({ userId, commentId }, { transaction });
      await PostComment.increment('likeCount', { by: 1, where: { id: commentId }, transaction });
    }

    await comment.reload({ transaction });

    return { liked: !existing, likeCount: comment.likeCount };
  });
}

module.exports = {
  list,
  create,
  update,
  remove,
  toggleLike,
  findCommentOrThrow,
  CONTENT_MAX,
  DELETED_PLACEHOLDER,
};
