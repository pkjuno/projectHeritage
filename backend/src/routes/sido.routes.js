const express = require('express');
const sidoController = require('../controllers/sido.controller');

// 광역시도 마스터 라우터
const router = express.Router();

// 시도 목록 조회 (문화재/축제 검색 필터용 기준 데이터)
router.get('/', sidoController.getSidos);

module.exports = router;
