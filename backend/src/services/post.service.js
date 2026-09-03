const { Op, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const Festival = require('../models/festival.model');
const BoardCategory = require('../models/boardCategory.model');
const boardCategoryService = require('./boardCategory.service');
const postViewService = require('./postView.service');
const userService = require('./user.service');
const AppError = require('../utils/AppError');
const config = require('../config');
const { parsePagination, toPagedResult } = require('../utils/pagination');

// 목록에 함께 내려줄 본문 미리보기 길이.
// 목록에서 제목만 보이면 어떤 글인지 판단하려고 매번 들어가 봐야 한다.
// 그렇다고 본문 전체를 실으면 20개짜리 한 페이지가 수백 KB가 된다.
const PREVIEW_LENGTH = 150;

// 제목/본문 길이 제한.
// content는 TEXT(최대 65535바이트)인데 한글은 UTF-8에서 글자당 3바이트라
// 넉넉히 잡아도 2만 자를 넘기면 잘린다. 그래서 컬럼 한계보다 훨씬 앞에서 막는다.
const TITLE_MIN = 2;
const TITLE_MAX = 200;
const CONTENT_MIN = 1;
const CONTENT_MAX = 10000;

/**
 * 목록/상세 응답에 함께 내려줄 연관 정보.
 *
 * 작성자는 반드시 attributes를 명시한다. 지정하지 않으면 비밀번호 해시와
 * refreshToken까지 응답에 실려 나간다.
 */
const POST_INCLUDE = [
  {
    model: User,
    as: 'author',
    attributes: ['id', 'name', 'nickname', 'profileImageUrl'],
  },
  {
    model: BoardCategory,
    as: 'category',
    attributes: ['id', 'code', 'name'],
  },
  {
    model: Festival,
    as: 'festival',
    attributes: ['id', 'name', 'startDate', 'endDate'],
  },
];

/**
 * 인기순 정렬에 쓰는 점수 식을 만든다.
 *
 * 반응 > 댓글 > 조회 순으로 가중치를 둔다. 조회는 누구나 올릴 수 있어 가장 낮다.
 * 미리 계산해 저장하지 않고 조회 시 계산하는 이유는, 가중치를 바꿀 때
 * 전체 재계산 배치가 필요해지기 때문이다. (글이 많아지면 그때 컬럼으로 옮긴다)
 * @returns {import('sequelize').Literal}
 */
function popularScore() {
  const { reaction, comment, view } = config.community.popularWeight;
  return literal(`(reaction_count * ${reaction} + comment_count * ${comment} + view_count * ${view})`);
}

/**
 * 게시글을 조회하고 없으면 404를 던진다. (상태는 확인하지 않는다)
 * @param {number} postId
 * @param {{transaction?: import('sequelize').Transaction, include?: boolean}} [options]
 * @returns {Promise<Post>}
 */
async function findPostOrThrow(postId, { transaction, include = false } = {}) {
  const post = await Post.findByPk(postId, {
    include: include ? POST_INCLUDE : undefined,
    transaction,
  });

  if (!post) {
    throw new AppError(404, '게시글을 찾을 수 없습니다.');
  }

  return post;
}

/**
 * 권한 판단에 쓸 회원 정보를 DB에서 읽어온다.
 *
 * JWT에는 role이 없다. 토큰에 역할을 담으면 권한을 회수해도 토큰이 만료될 때까지
 * 남기 때문인데(requireAdmin과 같은 이유), 그래서 역할이 필요한 경로에서는 매번 조회한다.
 * @param {number} userId
 * @returns {Promise<User>}
 */
async function loadActor(userId) {
  const user = await userService.findById(userId);

  if (!user || user.status === 'withdrawn') {
    throw new AppError(401, '유효하지 않은 회원입니다.');
  }

  return user;
}

/**
 * 제목/본문 입력값을 검증하고 앞뒤 공백을 제거한 값을 돌려준다.
 * @param {{title?: string, content?: string}} input
 * @param {{partial?: boolean}} [options] - partial이면 없는 항목은 검사하지 않는다 (수정 시)
 * @returns {{title?: string, content?: string}}
 */
function validateContentFields({ title, content }, { partial = false } = {}) {
  const result = {};

  if (title !== undefined || !partial) {
    const trimmed = String(title ?? '').trim();
    if (trimmed.length < TITLE_MIN || trimmed.length > TITLE_MAX) {
      throw new AppError(400, `제목은 ${TITLE_MIN}자 이상 ${TITLE_MAX}자 이하로 입력해 주세요.`);
    }
    result.title = trimmed;
  }

  if (content !== undefined || !partial) {
    // 본문은 줄바꿈과 들여쓰기가 의미를 갖는 경우가 있어 내부 공백은 건드리지 않는다.
    const trimmed = String(content ?? '').trim();
    if (trimmed.length < CONTENT_MIN || trimmed.length > CONTENT_MAX) {
      throw new AppError(400, `본문은 ${CONTENT_MIN}자 이상 ${CONTENT_MAX}자 이하로 입력해 주세요.`);
    }
    result.content = trimmed;
  }

  return result;
}

/**
 * 게시판 정책에 맞는 축제 연결인지 검증하고, 연결할 축제 ID를 확정한다.
 *
 * @param {BoardCategory} category
 * @param {number|null|undefined} festivalId
 * @returns {Promise<number|null>}
 */
async function resolveFestivalId(category, festivalId) {
  // 축제 후기 게시판처럼 대상 축제가 반드시 있어야 하는 게시판이 있다.
  if (category.requireFestival && !festivalId) {
    throw new AppError(400, `'${category.name}' 게시판은 축제를 선택해야 합니다.`);
  }

  if (!festivalId) return null;

  const festival = await Festival.findByPk(festivalId);
  if (!festival) {
    throw new AppError(404, '연결할 지역축제를 찾을 수 없습니다.');
  }

  return festival.id;
}

/**
 * 게시글 목록을 조회한다.
 *
 * 목록에는 정상 상태(published)의 글만 나온다.
 * 숨김/삭제된 글은 작성자 본인에게도 목록에서는 보이지 않는다. (상세로는 접근 가능)
 *
 * @param {{category?: string, festivalId?: string, keyword?: string, sort?: string,
 *          page?: string, limit?: string}} query
 */
async function list(query = {}, currentUserId) {
  const pagination = parsePagination(query);
  let where = { status: 'published' };

  // 차단한 사람의 글은 목록에서 빼준다.
  // 차단은 삭제가 아니므로 원본은 그대로 두고 조회하는 쪽에서만 걸러낸다.
  const moderationService = require('./moderation.service');
  const blockedIds = await moderationService.getBlockedUserIds(currentUserId);
  where = moderationService.excludeBlocked(where, blockedIds);

  // 게시판 필터. 코드로 받으므로 ID로 바꿔준다.
  if (query.category) {
    const category = await BoardCategory.findOne({ where: { code: query.category } });
    if (!category) {
      throw new AppError(404, '존재하지 않는 게시판입니다.');
    }
    where.categoryId = category.id;
  }

  // 특정 축제에 연결된 글만 (축제 상세의 "이 축제 후기")
  if (query.festivalId) {
    where.festivalId = Number(query.festivalId);
  }

  // 제목/본문 부분 일치 검색.
  // LIKE '%키워드%'는 인덱스를 타지 못한다. 글이 쌓이면 ngram FULLTEXT 인덱스로 옮겨야 한다.
  if (query.keyword) {
    const keyword = `%${query.keyword}%`;
    where[Op.or] = [{ title: { [Op.like]: keyword } }, { content: { [Op.like]: keyword } }];
  }

  // 고정 글(공지 등)은 정렬 방식과 무관하게 항상 위로 올린다.
  const order =
    query.sort === 'popular'
      ? [['isPinned', 'DESC'], [popularScore(), 'DESC'], ['createdAt', 'DESC']]
      : [['isPinned', 'DESC'], ['createdAt', 'DESC']];

  const result = await Post.findAndCountAll({
    where,
    attributes: {
      // 본문은 통째로 내리지 않고 앞부분만 잘라 preview로 준다.
      // 자르는 일은 DB에 시킨다. 애플리케이션에서 자르면 이미 전체 본문을
      // 네트워크로 실어 온 뒤라 아끼려던 것을 못 아낀다.
      include: [[literal(`LEFT(\`Post\`.\`content\`, ${PREVIEW_LENGTH})`), 'preview']],
      exclude: ['content'],
    },
    include: POST_INCLUDE,
    limit: pagination.limit,
    offset: pagination.offset,
    order,
    // include가 hasMany가 아니므로 중복 행은 생기지 않지만,
    // count 쿼리가 조인으로 부풀지 않도록 명시한다.
    distinct: true,
  });

  return toPagedResult(result, pagination);
}

/**
 * 게시글 상세를 조회하고 조회수를 집계한다.
 *
 * @param {number} postId
 * @param {import('express').Request} req - 조회자 식별(회원 ID 또는 IP)에 사용
 * @returns {Promise<Post>}
 */
async function getById(postId, req) {
  const post = await findPostOrThrow(postId, { include: true });

  // 삭제된 글은 누구에게도 보이지 않는다. (존재 자체를 알릴 이유가 없어 404)
  if (post.status === 'deleted') {
    throw new AppError(404, '게시글을 찾을 수 없습니다.');
  }

  // 숨김 처리된 글은 작성자 본인과 운영자만 볼 수 있다.
  // 작성자에게까지 404를 주면 자기 글이 왜 사라졌는지 알 방법이 없다.
  if (post.status === 'hidden') {
    const actor = req.user?.id ? await loadActor(req.user.id) : null;
    const canSee = actor && (actor.id === post.userId || actor.isAdmin());
    if (!canSee) {
      throw new AppError(404, '게시글을 찾을 수 없습니다.');
    }
  }

  await countViewIfNeeded(post, req);

  // 화면은 "총 12개"와 함께 어떤 이모지가 몇 개인지를 같이 보여줘야 하므로
  // 총합(reactionCount)만으로는 부족하다. 타입별 분포와 내 반응을 함께 싣는다.
  // (순환 참조를 피하려고 함수 안에서 require 한다: reaction.service도 post를 다룬다)
  const reactionService = require('./reaction.service');
  post.setDataValue('reactions', await reactionService.getSummary(post.id, req.user?.id));

  return post;
}

/**
 * 필요한 경우에만 조회수를 1 올린다.
 *
 * 세지 않는 경우:
 *  - 정상 상태가 아닌 글 (숨김/삭제)
 *  - 작성자 본인의 조회 (자기 글을 열어보는 것으로 순위가 오르면 안 된다)
 *  - 같은 사람이 같은 날 이미 본 글
 *
 * @param {Post} post - 조회수를 반영할 인스턴스 (메모리 값도 함께 갱신한다)
 * @param {import('express').Request} req
 * @returns {Promise<void>}
 */
async function countViewIfNeeded(post, req) {
  if (!post.isVisible()) return;
  if (req.user?.id === post.userId) return;

  const viewerKey = postViewService.buildViewerKey(req);

  // 로그 기록과 카운터 증가는 반드시 같은 트랜잭션에서 처리한다.
  // 따로 두면 로그만 남고 카운터가 안 오르는(또는 반대의) 어긋남이 생긴다.
  await sequelize.transaction(async (transaction) => {
    const counted = await postViewService.recordView(post.id, viewerKey, transaction);
    if (!counted) return;

    // 읽어서 +1 하지 않고 SQL에서 직접 증가시킨다. 동시 요청에서 값이 덮어써지지 않는다.
    await Post.increment('viewCount', { by: 1, where: { id: post.id }, transaction });

    // 방금 올린 값이 응답에 반영되도록 메모리 값도 맞춰준다. (다시 조회하지 않기 위함)
    post.viewCount += 1;
  });
}

/**
 * 게시글을 작성한다.
 *
 * @param {number} userId - 작성자
 * @param {{category?: string, title?: string, content?: string, festivalId?: number}} body
 * @returns {Promise<Post>}
 */
async function create(userId, body = {}) {
  const actor = await loadActor(userId);
  const category = await boardCategoryService.findByCodeOrThrow(body.category);

  // 공지사항처럼 운영자만 쓸 수 있는 게시판이 있다.
  if (!category.canWrite(actor)) {
    throw new AppError(403, `'${category.name}' 게시판은 운영자만 작성할 수 있습니다.`);
  }

  const fields = validateContentFields(body);
  const festivalId = await resolveFestivalId(category, body.festivalId);

  const post = await Post.create({
    categoryId: category.id,
    userId: actor.id,
    festivalId,
    title: fields.title,
    content: fields.content,
  });

  return findPostOrThrow(post.id, { include: true });
}

/**
 * 게시글을 수정한다. 작성자 본인만 가능하다.
 *
 * 운영자에게도 수정 권한을 주지 않는다. 남의 글 내용을 바꿀 수 있다는 것 자체가 사고 원인이고,
 * 문제가 있는 글은 고치는 게 아니라 숨기는(hidden) 것이 맞다.
 *
 * 게시판(category) 이동은 지원하지 않는다. 게시판마다 작성 권한과 축제 연결 정책이 달라
 * 이동을 허용하면 그 검증을 모두 다시 통과시켜야 하는데, 실익보다 사고 위험이 크다.
 *
 * @param {number} userId
 * @param {number} postId
 * @param {{title?: string, content?: string, festivalId?: number|null}} body
 * @returns {Promise<Post>}
 */
async function update(userId, postId, body = {}) {
  const post = await findPostOrThrow(postId);

  if (post.status === 'deleted') {
    throw new AppError(404, '게시글을 찾을 수 없습니다.');
  }

  if (!post.isEditableBy({ id: userId })) {
    throw new AppError(403, '본인이 작성한 글만 수정할 수 있습니다.');
  }

  // 숨김 처리된 글을 수정해서 되살리는 우회를 막는다.
  if (post.status === 'hidden') {
    throw new AppError(403, '숨김 처리된 글은 수정할 수 없습니다.');
  }

  const fields = validateContentFields(body, { partial: true });

  // 축제 연결은 명시적으로 보냈을 때만 건드린다. (null을 보내면 연결 해제)
  if (body.festivalId !== undefined) {
    const category = await BoardCategory.findByPk(post.categoryId);
    fields.festivalId = await resolveFestivalId(category, body.festivalId);
  }

  if (Object.keys(fields).length === 0) {
    throw new AppError(400, '수정할 항목이 없습니다. (title, content, festivalId)');
  }

  await post.update(fields);

  return findPostOrThrow(post.id, { include: true });
}

/**
 * 게시글을 삭제한다. 작성자 본인 또는 운영자만 가능하다.
 *
 * 행을 지우지 않고 status를 바꾼다. 물리 삭제하면 신고 처리 이력과 통계가 함께 사라진다.
 *
 * @param {number} userId
 * @param {number} postId
 * @returns {Promise<void>}
 */
async function remove(userId, postId) {
  const actor = await loadActor(userId);
  const post = await findPostOrThrow(postId);

  if (post.status === 'deleted') {
    throw new AppError(404, '게시글을 찾을 수 없습니다.');
  }

  if (!post.isDeletableBy(actor)) {
    throw new AppError(403, '본인이 작성한 글만 삭제할 수 있습니다.');
  }

  await post.update({ status: 'deleted', deletedAt: new Date() });
}

/**
 * 게시글 상단 고정 여부를 변경한다. (운영자 전용)
 * @param {number} postId
 * @param {boolean} isPinned
 * @returns {Promise<Post>}
 */
async function setPinned(postId, isPinned) {
  const post = await findPostOrThrow(postId);

  if (post.status !== 'published') {
    throw new AppError(400, '정상 상태의 글만 고정할 수 있습니다.');
  }

  await post.update({ isPinned: Boolean(isPinned) });

  return findPostOrThrow(post.id, { include: true });
}

/**
 * 게시글을 숨기거나 숨김을 해제한다. (운영자 전용, 블라인드 처리)
 *
 * 작성자가 삭제한 글(deleted)은 대상이 아니다. 운영자가 숨김을 해제하면
 * 작성자가 지운 글이 되살아나는 셈이 된다.
 *
 * @param {number} postId
 * @param {boolean} hidden
 * @returns {Promise<Post>}
 */
async function setHidden(postId, hidden) {
  const post = await findPostOrThrow(postId);

  if (post.status === 'deleted') {
    throw new AppError(404, '게시글을 찾을 수 없습니다.');
  }

  await post.update({ status: hidden ? 'hidden' : 'published' });

  return findPostOrThrow(post.id, { include: true });
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  setPinned,
  setHidden,
  findPostOrThrow,
  TITLE_MIN,
  TITLE_MAX,
  CONTENT_MAX,
  PREVIEW_LENGTH,
};
