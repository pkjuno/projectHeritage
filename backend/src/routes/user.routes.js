const express = require('express');
const userController = require('../controllers/user.controller');
const socialAccountController = require('../controllers/socialAccount.controller');
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

module.exports = router;
