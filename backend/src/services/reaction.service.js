const { literal, fn, col } = require('sequelize');
const { sequelize } = require('../config/database');
const Post = require('../models/post.model');
const PostReaction = require('../models/postReaction.model');
const PostShare = require('../models/postShare.model');
const AppError = require('../utils/AppError');

/**
 * 게시글 반응(좋아요/공감)과 공유 서비스.
 *
 * 좋아요와 공감은 한 테이블이다. 한 회원은 글 하나에 반응을 **하나만** 남기고,
 * '좋아요'에서 '슬퍼요'로 바꾸면 새 행이 생기는 게 아니라 type만 갈아탄다.
 * 그래서 반응을 바꿔도 총 반응 수는 변하지 않는다.
 */

/**
 * 반응을 남길 수 있는 게시글인지 확인하고 반환한다.
 * @param {number} postId
 * @param {import('sequelize').Transaction} [transaction]
 * @returns {Promise<Post>}
 */
async function findReactablePostOrThrow(postId, transaction) {
  const post = await Post.findByPk(postId, { transaction });

  if (!post || !post.isVisible()) {
    throw new AppError(404, '게시글을 찾을 수 없습니다.');
  }

  return post;
}

/**
 * 반응 타입을 검증한다.
 * @param {string} type
 * @returns {string}
 */
function validateType(type) {
  if (!PostReaction.REACTION_TYPES.includes(type)) {
    throw new AppError(
      400,
      `반응 종류는 ${PostReaction.REACTION_TYPES.join(', ')} 중 하나여야 합니다.`
    );
  }

  return type;
}

/**
 * 게시글의 반응 집계를 만든다. (총 개수 + 타입별 개수 + 내 반응)
 *
 * 화면에는 "총 12개"와 함께 어떤 이모지가 몇 개인지를 같이 보여줘야 하므로
 * 총합만으로는 부족하고, 타입별 분포까지 내려준다.
 *
 * @param {number} postId
 * @param {number} [userId] - 로그인한 회원 (없으면 myReaction은 null)
 * @returns {Promise<{total: number, byType: Record<string, number>, myReaction: string|null}>}
 */
async function getSummary(postId, userId) {
  const rows = await PostReaction.findAll({
    where: { postId },
    attributes: ['type', [fn('COUNT', col('id')), 'count']],
    group: ['type'],
    raw: true,
  });

  // 반응이 하나도 없는 타입도 0으로 채워 내려준다.
  // 없는 키를 화면에서 매번 방어하게 만들지 않기 위해서다.
  const byType = Object.fromEntries(PostReaction.REACTION_TYPES.map((type) => [type, 0]));
  let total = 0;

  for (const row of rows) {
    const count = Number(row.count);
    byType[row.type] = count;
    total += count;
  }

  const mine = userId ? await PostReaction.findOne({ where: { postId, userId } }) : null;

  return { total, byType, myReaction: mine?.type ?? null };
}

/**
 * 여러 게시글에 대한 내 반응을 한 번에 조회한다. (목록 화면용)
 *
 * 글마다 따로 조회하면 목록 한 페이지에 20번의 쿼리가 나간다.
 * @param {number|undefined} userId
 * @param {number[]} postIds
 * @returns {Promise<Map<number, string>>} postId -> 반응 타입
 */
async function getMyReactionMap(userId, postIds) {
  if (!userId || postIds.length === 0) return new Map();

  const reactions = await PostReaction.findAll({
    where: { userId, postId: postIds },
    attributes: ['postId', 'type'],
  });

  return new Map(reactions.map((reaction) => [reaction.postId, reaction.type]));
}

/**
 * 반응을 남기거나 종류를 바꾼다.
 *
 * 세 가지 경우를 한 곳에서 처리한다.
 *  - 처음 반응 → 행 생성 + 반응 수 +1
 *  - 같은 종류로 다시 → 아무것도 하지 않음 (같은 요청을 두 번 보내도 결과가 같다)
 *  - 다른 종류로 변경 → type만 수정, 반응 수는 그대로
 *
 * @param {number} userId
 * @param {number} postId
 * @param {string} type
 * @returns {Promise<{total: number, byType: object, myReaction: string}>}
 */
async function set(userId, postId, type) {
  const validType = validateType(type);

  const isNewReaction = await sequelize.transaction(async (transaction) => {
    await findReactablePostOrThrow(postId, transaction);

    const existing = await PostReaction.findOne({ where: { userId, postId }, transaction });

    if (!existing) {
      await PostReaction.create({ userId, postId, type: validType }, { transaction });
      await Post.increment('reactionCount', { by: 1, where: { id: postId }, transaction });
      return true;
    }

    // 종류만 바뀌므로 카운터는 건드리지 않는다. 여기서 증가시키면
    // 이모지를 바꿀 때마다 반응 수가 부풀어 오른다.
    if (existing.type !== validType) {
      await existing.update({ type: validType }, { transaction });
    }

    // 종류만 바꾼 것은 새 반응이 아니다. 여기서 알림을 보내면
    // 이모지를 바꿀 때마다 글쓴이에게 알림이 간다.
    return false;
  });

  if (isNewReaction) {
    // 알림은 트랜잭션 커밋 뒤에 보낸다. (댓글과 같은 이유)
    const post = await Post.findByPk(postId);
    await require('./communityNotifier.service').notifyReactionAdded(post, userId);
  }

  return getSummary(postId, userId);
}

/**
 * 반응을 취소한다.
 * @param {number} userId
 * @param {number} postId
 * @returns {Promise<{total: number, byType: object, myReaction: null}>}
 */
async function remove(userId, postId) {
  await sequelize.transaction(async (transaction) => {
    await findReactablePostOrThrow(postId, transaction);

    const existing = await PostReaction.findOne({ where: { userId, postId }, transaction });

    if (!existing) {
      throw new AppError(404, '남긴 반응이 없습니다.');
    }

    await existing.destroy({ transaction });

    await Post.update(
      { reactionCount: literal('GREATEST(reaction_count - 1, 0)') },
      { where: { id: postId }, transaction }
    );
  });

  return getSummary(postId, userId);
}

/**
 * 공유를 기록한다.
 *
 * 반응/좋아요와 달리 같은 사람이 여러 번 공유할 수 있으므로 중복을 막지 않는다.
 *
 * 주의: 이 값은 클라이언트가 "공유했다"고 알려주는 자진신고 지표다.
 * 공유 버튼을 눌렀을 뿐 실제로 전송했는지는 알 수 없으므로 정확한 유입 수치가 아니다.
 *
 * @param {number} userId
 * @param {number} postId
 * @param {string} [channel]
 * @returns {Promise<{shareCount: number}>}
 */
async function share(userId, postId, channel = 'link') {
  if (!PostShare.SHARE_CHANNELS.includes(channel)) {
    throw new AppError(400, `공유 채널은 ${PostShare.SHARE_CHANNELS.join(', ')} 중 하나여야 합니다.`);
  }

  return sequelize.transaction(async (transaction) => {
    const post = await findReactablePostOrThrow(postId, transaction);

    await PostShare.create({ postId, userId, channel }, { transaction });
    await Post.increment('shareCount', { by: 1, where: { id: postId }, transaction });

    await post.reload({ transaction });

    return { shareCount: post.shareCount };
  });
}

module.exports = { set, remove, share, getSummary, getMyReactionMap };
