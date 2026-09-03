const Post = require('../models/post.model');
const PostComment = require('../models/postComment.model');
const notificationService = require('./notification.service');

/**
 * 커뮤니티 활동 알림 발송 서비스.
 *
 * === 트랜잭션 밖에서 호출하는 이유 ===
 * 알림은 부수 효과다. 알림 저장이 실패했다고 방금 단 댓글까지 롤백되면
 * 사용자는 "댓글이 안 달렸다"고 느낀다. 알림 하나를 잃는 편이 낫다.
 * 그래서 모든 함수는 예외를 밖으로 던지지 않고 로그만 남긴다.
 *
 * 대신 알림이 조용히 유실될 수 있다는 뜻이기도 하다.
 * 유실까지 막으려면 outbox 테이블에 기록하고 배치가 재시도하는 구조가 필요하다.
 * 지금 규모에서는 과한 구조라 판단해 넣지 않았다.
 */

// 알림 본문에 넣을 게시글 제목의 최대 길이. 너무 길면 푸시 알림에서 잘린다.
const TITLE_PREVIEW_LENGTH = 20;

/**
 * 알림 문구에 넣을 짧은 제목을 만든다.
 * @param {string} title
 * @returns {string}
 */
function preview(title) {
  return title.length > TITLE_PREVIEW_LENGTH
    ? `${title.slice(0, TITLE_PREVIEW_LENGTH)}...`
    : title;
}

/**
 * 알림 발송을 시도하되, 실패해도 호출한 쪽의 작업을 망치지 않는다.
 * @param {() => Promise<any>} task
 * @param {string} label - 실패 로그에 남길 설명
 */
async function safely(task, label) {
  try {
    await task();
  } catch (error) {
    // 알림 실패로 본 기능을 막지 않는다. 대신 조용히 사라지지 않도록 로그는 남긴다.
    console.error(`[알림] ${label} 실패:`, error.message);
  }
}

/**
 * 댓글이 달렸을 때 알림을 보낸다.
 *
 * 두 사람에게 갈 수 있다.
 *  - 게시글 작성자: "내 글에 댓글이 달렸다"
 *  - (대댓글이면) 부모 댓글 작성자: "내 댓글에 답글이 달렸다"
 *
 * 자기 자신에게는 보내지 않는다. 내가 쓴 글에 내가 댓글을 달았다는 알림은 소음이다.
 * 두 대상이 같은 사람이면 답글 알림 하나만 보낸다. (같은 사건으로 두 번 울리지 않게)
 *
 * @param {PostComment} comment - 방금 생성된 댓글
 * @returns {Promise<void>}
 */
async function notifyCommentCreated(comment) {
  await safely(async () => {
    const post = await Post.findByPk(comment.postId);
    if (!post) return;

    // 대댓글이면 부모 댓글 작성자에게 먼저 알린다.
    let parentAuthorId = null;

    if (comment.parentId) {
      const parent = await PostComment.findByPk(comment.parentId);

      if (parent && parent.userId !== comment.userId) {
        parentAuthorId = parent.userId;
        await notificationService.createIfAbsent({
          userId: parent.userId,
          type: 'comment_reply',
          title: '내 댓글에 답글이 달렸어요',
          body: `'${preview(post.title)}' 글의 내 댓글에 답글이 달렸습니다.`,
          postId: post.id,
          dedupeKey: `comment_reply:${comment.id}`,
        });
      }
    }

    // 게시글 작성자에게 알린다.
    // 본인이 단 댓글이거나, 방금 답글 알림을 받은 사람이면 보내지 않는다.
    if (post.userId === comment.userId || post.userId === parentAuthorId) return;

    await notificationService.createIfAbsent({
      userId: post.userId,
      type: 'post_comment',
      title: '내 글에 댓글이 달렸어요',
      body: `'${preview(post.title)}' 글에 새 댓글이 달렸습니다.`,
      postId: post.id,
      dedupeKey: `post_comment:${comment.id}`,
    });
  }, '댓글 알림');
}

/**
 * 반응이 달렸을 때 알림을 보낸다.
 *
 * 반응은 건건이 알리면 너무 시끄럽다. 인기 글이면 하루에 수십 번 울린다.
 * 그래서 **글 하나당 하루 한 번**으로 묶고, 그날의 반응 수를 본문에 담는다.
 * dedupeKey에 날짜를 넣는 것이 그 묶음의 기준이다.
 *
 * 이미 만들어진 알림은 본문만 갱신한다. (5개 -> 6개)
 * 새 알림을 만들면 하루에 한 번이라는 원칙이 깨지고,
 * 그냥 두면 "1개"에서 숫자가 멈춰 있는 알림이 남는다.
 *
 * @param {Post} post - 반응이 달린 게시글
 * @param {number} reactorId - 반응을 남긴 회원
 * @returns {Promise<void>}
 */
async function notifyReactionAdded(post, reactorId) {
  await safely(async () => {
    if (post.userId === reactorId) return;

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const body = `'${preview(post.title)}' 글에 반응 ${post.reactionCount}개가 달렸습니다.`;

    const { notification, created } = await notificationService.createIfAbsent({
      userId: post.userId,
      type: 'post_reaction',
      title: '내 글에 반응이 달렸어요',
      body,
      postId: post.id,
      dedupeKey: `post_reaction:${post.id}:${today}`,
    });

    if (!created) {
      // 오늘 이미 보낸 알림이라면 개수만 최신으로 고쳐준다.
      await notification.update({ body });
    }
  }, '반응 알림');
}

module.exports = { notifyCommentCreated, notifyReactionAdded };
