const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const sidoRoutes = require('./sido.routes');
const heritageRoutes = require('./heritage.routes');
const festivalRoutes = require('./festival.routes');

// 모든 도메인 라우터를 하나로 모으는 루트 라우터
const router = express.Router();

// 헬스체크 엔드포인트 - 서버가 정상 동작 중인지 확인용
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is healthy' });
});

// /api/auth 하위 경로는 auth.routes.js 에서 처리 (회원가입/로그인/로그아웃/탈퇴)
router.use('/auth', authRoutes);

// /api/users 하위 경로는 user.routes.js 에서 처리
router.use('/users', userRoutes);

// /api/sidos 하위 경로는 sido.routes.js 에서 처리 (광역시도 마스터)
router.use('/sidos', sidoRoutes);

// /api/heritages 하위 경로는 heritage.routes.js 에서 처리 (문화재)
router.use('/heritages', heritageRoutes);

// /api/festivals 하위 경로는 festival.routes.js 에서 처리 (지역축제)
router.use('/festivals', festivalRoutes);

module.exports = router;
