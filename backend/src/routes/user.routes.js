const express = require('express');
const userController = require('../controllers/user.controller');

// User 도메인 관련 라우터
const router = express.Router();

// 사용자 목록 조회
router.get('/', userController.getUsers);

// 사용자 단건 조회
router.get('/:id', userController.getUserById);

// 사용자 생성
router.post('/', userController.createUser);

module.exports = router;
