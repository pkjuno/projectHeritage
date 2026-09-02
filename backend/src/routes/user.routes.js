const express = require('express');
const userController = require('../controllers/user.controller');
const socialAccountController = require('../controllers/socialAccount.controller');
const wishlistController = require('../controllers/wishlist.controller');
const scheduleController = require('../controllers/schedule.controller');
const authenticate = require('../middlewares/authenticate');
const { uploadProfileImage } = require('../middlewares/upload');

// User(마이페이지) 도메인 관련 라우터. 모든 경로가 로그인 상태를 전제로 한다.
const router = express.Router();

// 이하 모든 라우트에 인증을 적용한다.
router.use(authenticate);

// 마이페이지 - 내 정보 조회 (연결된 간편로그인 포함)
router.get('/me', userController.getMe);

// 마이페이지 - 회원정보(닉네임/이름) 수정
router.patch('/me', userController.updateMe);

// 마이페이지 - 프로필 이미지 등록/수정 (multipart/form-data, 필드명: image)
router.put('/me/profile-image', uploadProfileImage, userController.updateProfileImage);

// 마이페이지 - 프로필 이미지 삭제
router.delete('/me/profile-image', userController.deleteProfileImage);

// 마이페이지 - 연결된 간편로그인 목록 조회
router.get('/me/social-accounts', socialAccountController.list);

// 마이페이지 - 간편로그인 연결 (provider: naver | kakao | google)
router.post('/me/social-accounts/:provider', socialAccountController.link);

// 마이페이지 - 간편로그인 연결 해지
router.delete('/me/social-accounts/:provider', socialAccountController.unlink);

// 위시리스트 - 내가 찜한 축제 목록
router.get('/me/wishlists', wishlistController.list);

// 위시리스트 - 축제 추가
router.post('/me/wishlists/:festivalId', wishlistController.add);

// 위시리스트 - 축제 제거
router.delete('/me/wishlists/:festivalId', wishlistController.remove);

// 내 일정 - 목록 조회 (query: from, to)
router.get('/me/schedules', scheduleController.list);

// 내 일정 - 등록 (body: festivalId, visitDate, memo)
router.post('/me/schedules', scheduleController.create);

// 내 일정 - 수정 (body: visitDate, memo)
router.patch('/me/schedules/:id', scheduleController.update);

// 내 일정 - 삭제
router.delete('/me/schedules/:id', scheduleController.remove);

module.exports = router;
