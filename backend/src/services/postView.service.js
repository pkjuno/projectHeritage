const crypto = require('crypto');
const PostView = require('../models/postView.model');
const config = require('../config');

/**
 * 게시글 조회수 집계 서비스.
 *
 * 상세를 열 때마다 조회수를 +1 하면 새로고침만으로 숫자가 부풀고,
 * 그 숫자가 인기글 점수에 들어가므로 순위까지 오염된다.
 * 그래서 "누가 / 어떤 글을 / 어느 날" 봤는지를 기록하고 하루에 한 번만 센다.
 */

/**
 * 비로그인 방문자의 IP를 식별용 해시로 바꾼다.
 *
 * IP 원문은 저장하지 않는다. 다만 단순 해시는 IPv4 주소 공간이 좁아
 * 전수 대입으로 복원할 수 있으므로 서버 비밀 키를 붙인 HMAC을 쓴다.
 * 32자로 자르는 것은 컬럼 길이를 아끼기 위한 것이고, 충돌 확률은 무시할 수준이다.
 * @param {string} ip - 요청자 IP
 * @returns {string} 32자 해시
 */
function hashIp(ip) {
  return crypto
    .createHmac('sha256', config.community.viewHashSecret)
    .update(String(ip || 'unknown'))
    .digest('hex')
    .slice(0, 32);
}

/**
 * 요청에서 조회자 식별키를 만든다.
 *
 * 로그인 회원은 IP가 바뀌어도 같은 사람으로 취급해야 하므로 회원 ID를 우선한다.
 * @param {import('express').Request} req
 * @returns {string} 'u:{회원ID}' 또는 'a:{IP 해시}'
 */
function buildViewerKey(req) {
  if (req.user?.id) {
    return PostView.buildViewerKey({ userId: req.user.id });
  }
  return PostView.buildViewerKey({ ipHash: hashIp(req.ip) });
}

/**
 * 오늘 날짜를 'YYYY-MM-DD'로 반환한다. (DATEONLY 컬럼과 형식을 맞추기 위함)
 * @returns {string}
 */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 조회를 기록하고, 이번 요청에서 조회수를 올려야 하는지 알려준다.
 *
 * 동시에 두 요청이 들어오면 둘 다 "새 조회"라고 판단할 수 있으므로,
 * 최종 방어선은 uq_post_view_post_viewer_date 유니크 인덱스다.
 * 유니크 위반은 "이미 센 조회"라는 뜻이므로 에러가 아니라 false로 처리한다.
 *
 * @param {number} postId
 * @param {string} viewerKey
 * @param {import('sequelize').Transaction} [transaction]
 * @returns {Promise<boolean>} 이번에 새로 집계됐으면 true
 */
async function recordView(postId, viewerKey, transaction) {
  try {
    const [, created] = await PostView.findOrCreate({
      where: { postId, viewerKey, viewDate: today() },
      transaction,
    });
    return created;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return false;
    }
    throw error;
  }
}

module.exports = { buildViewerKey, recordView, hashIp };
