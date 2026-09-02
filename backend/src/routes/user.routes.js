const express = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middlewares/authenticate');

// User 도메인 관련 라우터
const router = express.Router();

// 내 정보 조회 (인증 필요)
router.get('/me', authenticate, userController.getMe);

module.exports = router;
