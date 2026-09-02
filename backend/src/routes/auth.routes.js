const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middlewares/authenticate');

// 회원(인증) 관련 라우터
const router = express.Router();

// 일반 회원가입
router.post('/signup', authController.signup);

// 일반 로그인
router.post('/login', authController.login);

// SNS 간편로그인 (provider: naver | kakao | google)
router.post('/social/:provider', authController.socialLogin);

// Access Token 재발급
router.post('/refresh', authController.refresh);

// 로그아웃 (인증 필요)
router.post('/logout', authenticate, authController.logout);

// 회원 탈퇴 (인증 필요)
router.delete('/withdraw', authenticate, authController.withdraw);

module.exports = router;
