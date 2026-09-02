const express = require('express');
const userController = require('../controllers/user.controller');
const socialAccountController = require('../controllers/socialAccount.controller');
const wishlistController = require('../controllers/wishlist.controller');
const scheduleController = require('../controllers/schedule.controller');
const notificationController = require('../controllers/notification.controller');
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

// 알림 - 내 알림 목록 (안 읽은 개수 포함)
router.get('/me/notifications', notificationController.list);

// 알림 - 전체 읽음 처리
// ":id" 라우트보다 먼저 등록해야 "read-all"이 id로 해석되지 않는다.
router.patch('/me/notifications/read-all', notificationController.readAll);

// 알림 - 1건 읽음 처리
router.patch('/me/notifications/:id/read', notificationController.read);

// 알림 - 푸시 수신 설정 및 기기 토큰 등록
router.put('/me/push-settings', notificationController.updatePushSettings);

module.exports = router;
