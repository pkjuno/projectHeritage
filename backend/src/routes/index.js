const express = require('express');
const userRoutes = require('./user.routes');

// 모든 도메인 라우터를 하나로 모으는 루트 라우터
const router = express.Router();

// 헬스체크 엔드포인트 - 서버가 정상 동작 중인지 확인용
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

// /api/users 하위 경로는 user.routes.js 에서 처리
router.use('/users', userRoutes);

module.exports = router;
