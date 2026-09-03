const express = require('express');
const boardCategoryController = require('../controllers/boardCategory.controller');
const postController = require('../controllers/post.controller');
const authenticate = require('../middlewares/authenticate');
const optionalAuthenticate = require('../middlewares/optionalAuthenticate');
const requireAdmin = require('../middlewares/requireAdmin');

// 커뮤니티(게시판) 라우터
const router = express.Router();

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

module.exports = router;
