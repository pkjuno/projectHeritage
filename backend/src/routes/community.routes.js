const express = require('express');
const boardCategoryController = require('../controllers/boardCategory.controller');
const postController = require('../controllers/post.controller');
const commentController = require('../controllers/comment.controller');
const reactionController = require('../controllers/reaction.controller');
const dashboardController = require('../controllers/communityDashboard.controller');
const authenticate = require('../middlewares/authenticate');
const optionalAuthenticate = require('../middlewares/optionalAuthenticate');
const requireAdmin = require('../middlewares/requireAdmin');

// 커뮤니티(게시판) 라우터
const router = express.Router();

// --- 대시보드 / 내 활동 ---
// 커뮤니티 홈을 한 번의 요청으로 그린다. 로그인하면 내 활동 요약이 함께 온다.
router.get('/dashboard', optionalAuthenticate, dashboardController.getDashboard);
router.get('/me/posts', authenticate, dashboardController.listMyPosts);
router.get('/me/comments', authenticate, dashboardController.listMyComments);
router.get('/me/reactions', authenticate, dashboardController.listMyReactions);

// 게시판 목록 (비회원 공개)
router.get('/categories', boardCategoryController.list);

// 게시글 목록.
// 비회원도 볼 수 있지만, 로그인했다면 "내 글인지(isMine)"를 함께 내려주기 위해 optionalAuthenticate를 쓴다.
router.get('/posts', optionalAuthenticate, postController.list);

// 게시글 상세. 조회수 집계에 회원 ID를 쓰므로 마찬가지로 optionalAuthenticate가 필요하다.
router.get('/posts/:id', optionalAuthenticate, postController.getById);

// 게시글 작성 (로그인 필요, 게시판별 작성 권한은 서비스에서 확인)
router.post('/posts', authenticate, postController.create);

// 게시글 수정 (작성자 본인만)
router.put('/posts/:id', authenticate, postController.update);

// 게시글 삭제 (작성자 본인 또는 운영자)
router.delete('/posts/:id', authenticate, postController.remove);

// 상단 고정 / 블라인드 처리는 운영자 전용이므로 미들웨어 단계에서 막는다.
router.patch('/posts/:id/pin', authenticate, requireAdmin, postController.setPinned);
router.patch('/posts/:id/hide', authenticate, requireAdmin, postController.setHidden);

// --- 댓글 ---
// 목록은 비회원도 볼 수 있고, 로그인했다면 "내 댓글인지/좋아요했는지"를 함께 내려준다.
router.get('/posts/:id/comments', optionalAuthenticate, commentController.list);
router.post('/posts/:id/comments', authenticate, commentController.create);
router.put('/comments/:id', authenticate, commentController.update);
router.delete('/comments/:id', authenticate, commentController.remove);
router.post('/comments/:id/like', authenticate, commentController.toggleLike);

// --- 반응 (좋아요 + 공감) ---
// 종류를 바꾸는 동작이 있으므로 토글이 아니라 PUT/DELETE로 둔다.
router.put('/posts/:id/reaction', authenticate, reactionController.set);
router.delete('/posts/:id/reaction', authenticate, reactionController.remove);

// --- 공유 ---
router.post('/posts/:id/share', authenticate, postController.share);

module.exports = router;
