const Post = require('../models/post.model');
const PostComment = require('../models/postComment.model');
const PostReaction = require('../models/postReaction.model');
const BoardCategory = require('../models/boardCategory.model');
const { parsePagination, toPagedResult } = require('../utils/pagination');

/**
 * 내 커뮤니티 활동 내역 조회 서비스. (내 글 / 내 댓글 / 내가 반응한 글)
 *
 * 세 목록 모두 삭제된 것은 빼고 보여준다.
 * 내가 지운 글이 "내 글" 목록에 계속 남아 있으면 지운 것이 아니다.
 */

// 목록 카드에 필요한 최소 정보
const POST_SUMMARY = [
  'id',
  'title',
  'status',
  'viewCount',
  'commentCount',
  'reactionCount',
  'createdAt',
];

const CATEGORY_INCLUDE = {
  model: BoardCategory,
  as: 'category',
  attributes: ['id', 'code', 'name'],
};

/**
 * 내가 쓴 글 목록.
 *
 * 숨김 처리된 글은 남겨둔다. 운영자가 왜 숨겼는지 확인할 방법이 있어야 한다.
 * @param {number} userId
 * @param {{page?: string, limit?: string}} query
 */
async function listMyPosts(userId, query = {}) {
  const pagination = parsePagination(query);

  const result = await Post.findAndCountAll({
    where: { userId, status: ['published', 'hidden'] },
    attributes: POST_SUMMARY,
    include: [CATEGORY_INCLUDE],
    limit: pagination.limit,
    offset: pagination.offset,
    order: [['createdAt', 'DESC']],
  });

  return toPagedResult(result, pagination);
}

/**
 * 내가 쓴 댓글 목록.
 *
 * 댓글만 보여주면 "무슨 글에 단 댓글인지" 알 수 없으므로 원글 정보를 함께 싣는다.
 * 원글이 지워졌거나 숨겨진 댓글은 제외한다. 눌러도 갈 곳이 없기 때문이다.
 * @param {number} userId
 * @param {{page?: string, limit?: string}} query
 */
async function listMyComments(userId, query = {}) {
  const pagination = parsePagination(query);

  const result = await PostComment.findAndCountAll({
    where: { userId, status: 'published' },
    attributes: ['id', 'postId', 'parentId', 'content', 'likeCount', 'createdAt'],
    include: [
      {
        model: Post,
        as: 'post',
        attributes: ['id', 'title'],
        required: true,
        where: { status: 'published' },
        include: [CATEGORY_INCLUDE],
      },
    ],
    limit: pagination.limit,
    offset: pagination.offset,
    order: [['createdAt', 'DESC']],
  });

  return toPagedResult(result, pagination);
}

/**
 * 내가 반응을 남긴 글 목록.
 *
 * 화면에서는 "내가 좋아요한 글" 탭이 된다.
 * 어떤 반응을 남겼는지(type)도 함께 내려줘야 이모지를 그릴 수 있다.
 * @param {number} userId
 * @param {{page?: string, limit?: string}} query
 */
async function listMyReactions(userId, query = {}) {
  const pagination = parsePagination(query);

  const result = await PostReaction.findAndCountAll({
    where: { userId },
    attributes: ['id', 'type', 'createdAt'],
    include: [
      {
        model: Post,
        as: 'post',
        attributes: POST_SUMMARY,
        required: true,
        // 지워진 글에 남긴 반응은 갈 곳이 없다.
        where: { status: 'published' },
        include: [CATEGORY_INCLUDE],
      },
    ],
    limit: pagination.limit,
    offset: pagination.offset,
    order: [['createdAt', 'DESC']],
  });

  return toPagedResult(result, pagination);
}

module.exports = { listMyPosts, listMyComments, listMyReactions };
