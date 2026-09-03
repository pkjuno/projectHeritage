const { Op, fn, col, literal, where: sqlWhere } = require('sequelize');
const Post = require('../models/post.model');
const PostComment = require('../models/postComment.model');
const PostReaction = require('../models/postReaction.model');
const BoardCategory = require('../models/boardCategory.model');
const Festival = require('../models/festival.model');
const User = require('../models/user.model');
const config = require('../config');

/**
 * 커뮤니티 대시보드 서비스.
 *
 * 커뮤니티 홈 화면을 한 번의 요청으로 다 그릴 수 있게 묶어서 내려준다.
 * 화면 조각마다 API를 따로 부르면 첫 화면에만 5~6번의 왕복이 생긴다.
 */

// 인기글로 볼 기간. 이 기간을 벗어난 글은 아무리 반응이 많아도 인기글이 아니다.
// (한 달 전 글이 계속 상단에 남아 있으면 커뮤니티가 죽은 것처럼 보인다)
const TRENDING_DAYS = 7;

// 각 섹션에 담을 개수
const TRENDING_LIMIT = 5;
const LATEST_LIMIT = 5;
const FESTIVAL_TALK_LIMIT = 3;

// 목록에 함께 실을 최소 정보. 대시보드는 요약이므로 본문은 싣지 않는다.
const SUMMARY_ATTRIBUTES = [
  'id',
  'title',
  'viewCount',
  'commentCount',
  'reactionCount',
  'shareCount',
  'createdAt',
];

const SUMMARY_INCLUDE = [
  { model: User, as: 'author', attributes: ['id', 'name', 'nickname', 'profileImageUrl'] },
  { model: BoardCategory, as: 'category', attributes: ['id', 'code', 'name'] },
];

/**
 * N일 전 시각을 구한다.
 * @param {number} days
 * @returns {Date}
 */
function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * 오늘 0시를 구한다. (카테고리별 "오늘 올라온 글" 집계 기준)
 * @returns {Date}
 */
function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * 인기 점수 식. post.service의 인기순 정렬과 같은 가중치를 쓴다.
 *
 * 저장 컬럼으로 두지 않는 이유: 가중치를 바꿀 때마다 전체 재계산 배치가 필요해진다.
 * 대상이 최근 7일 글로 제한돼 있어 정렬 대상 자체가 적다.
 * 글이 많아져 느려지면 그때 trending_score 컬럼 + 배치로 옮긴다.
 * @returns {import('sequelize').Literal}
 */
function popularScore() {
  const { reaction, comment, view } = config.community.popularWeight;
  return literal(
    `(reaction_count * ${reaction} + comment_count * ${comment} + view_count * ${view})`
  );
}

/**
 * 최근 7일 인기글을 조회한다.
 * @returns {Promise<Post[]>}
 */
async function getTrending() {
  return Post.findAll({
    where: { status: 'published', createdAt: { [Op.gte]: daysAgo(TRENDING_DAYS) } },
    attributes: SUMMARY_ATTRIBUTES,
    include: SUMMARY_INCLUDE,
    order: [[popularScore(), 'DESC'], ['createdAt', 'DESC']],
    limit: TRENDING_LIMIT,
  });
}

/**
 * 전체 최신글을 조회한다.
 * @returns {Promise<Post[]>}
 */
async function getLatest() {
  return Post.findAll({
    where: { status: 'published' },
    attributes: SUMMARY_ATTRIBUTES,
    include: SUMMARY_INCLUDE,
    order: [['createdAt', 'DESC']],
    limit: LATEST_LIMIT,
  });
}

/**
 * 게시판별 글 수와 오늘 올라온 글 수를 구한다.
 *
 * 게시판 수만큼 COUNT 쿼리를 날리지 않도록 두 번의 집계 쿼리로 끝낸다.
 * @returns {Promise<Array<{code: string, name: string, postCount: number, todayCount: number}>>}
 */
async function getCategorySummary() {
  const categories = await BoardCategory.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC']],
  });

  const countRows = await Post.findAll({
    where: { status: 'published' },
    attributes: ['categoryId', [fn('COUNT', col('id')), 'count']],
    group: ['categoryId'],
    raw: true,
  });

  const todayRows = await Post.findAll({
    where: { status: 'published', createdAt: { [Op.gte]: startOfToday() } },
    attributes: ['categoryId', [fn('COUNT', col('id')), 'count']],
    group: ['categoryId'],
    raw: true,
  });

  const totalByCategory = new Map(countRows.map((row) => [row.categoryId, Number(row.count)]));
  const todayByCategory = new Map(todayRows.map((row) => [row.categoryId, Number(row.count)]));

  return categories.map((category) => ({
    id: category.id,
    code: category.code,
    name: category.name,
    description: category.description,
    // 글이 없는 게시판도 0으로 내려준다. 화면에서 빈 게시판이 사라지면 안 된다.
    postCount: totalByCategory.get(category.id) ?? 0,
    todayCount: todayByCategory.get(category.id) ?? 0,
  }));
}

/**
 * 지금 진행 중인 축제 가운데 이야기가 많은 축제를 구한다.
 *
 * 이 섹션이 이 대시보드의 차별점이다. 일반 게시판 대시보드에는 없고,
 * 축제 도메인과 커뮤니티를 잇는 자리다.
 * @returns {Promise<Array<{festival: object, postCount: number}>>}
 */
async function getFestivalTalk() {
  const today = new Date().toISOString().slice(0, 10);

  const rows = await Post.findAll({
    where: { status: 'published', festivalId: { [Op.ne]: null } },
    attributes: ['festivalId', [fn('COUNT', col('Post.id')), 'postCount']],
    include: [
      {
        model: Festival,
        as: 'festival',
        attributes: ['id', 'name', 'startDate', 'endDate'],
        required: true,
        // 이미 끝난 축제의 후기가 계속 상단에 남아 있으면 "지금 뭐가 열리는지"를 알 수 없다.
        where: { startDate: { [Op.lte]: today }, endDate: { [Op.gte]: today } },
      },
    ],
    group: ['festivalId', 'festival.id'],
    order: [[literal('postCount'), 'DESC']],
    limit: FESTIVAL_TALK_LIMIT,
  });

  return rows.map((row) => ({
    festival: row.festival,
    postCount: Number(row.get('postCount')),
  }));
}

/**
 * 내 활동 요약을 구한다. (로그인한 경우에만)
 *
 * receivedReactionCount는 "내가 남긴 반응"이 아니라 **내 글이 받은 반응**이다.
 * 커뮤니티에서 의미 있는 숫자는 내가 얼마나 눌렀는지가 아니라 얼마나 받았는지다.
 *
 * @param {number} userId
 * @returns {Promise<{postCount: number, commentCount: number, receivedReactionCount: number}>}
 */
async function getMyActivity(userId) {
  const [postCount, commentCount, receivedReactionCount] = await Promise.all([
    Post.count({ where: { userId, status: 'published' } }),
    PostComment.count({ where: { userId, status: 'published' } }),
    PostReaction.count({
      include: [
        {
          model: Post,
          as: 'post',
          attributes: [],
          required: true,
          where: { userId, status: 'published' },
        },
      ],
      // 내가 내 글에 남긴 반응은 "받은 반응"이 아니다.
      where: sqlWhere(col('PostReaction.user_id'), { [Op.ne]: userId }),
    }),
  ]);

  return { postCount, commentCount, receivedReactionCount };
}

/**
 * 커뮤니티 대시보드 데이터를 한 번에 만든다.
 * @param {number} [userId] - 로그인한 회원 (없으면 myActivity는 null)
 */
async function getDashboard(userId) {
  const [trending, latest, categories, festivalTalk] = await Promise.all([
    getTrending(),
    getLatest(),
    getCategorySummary(),
    getFestivalTalk(),
  ]);

  return {
    trending,
    latest,
    categories,
    festivalTalk,
    myActivity: userId ? await getMyActivity(userId) : null,
  };
}

module.exports = {
  getDashboard,
  getTrending,
  getLatest,
  getCategorySummary,
  getFestivalTalk,
  getMyActivity,
  TRENDING_DAYS,
};
