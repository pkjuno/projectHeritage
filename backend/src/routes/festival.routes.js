const express = require('express');
const festivalController = require('../controllers/festival.controller');
const authenticate = require('../middlewares/authenticate');

// 지역축제 도메인 관련 라우터
const router = express.Router();

// 지역축제 목록 조회 (검색/필터/페이지네이션) - 공개
router.get('/', festivalController.list);

// 지역축제 상세 조회 - 공개
router.get('/:id', festivalController.getById);

// 지역축제 등록 - 인증 필요
router.post('/', authenticate, festivalController.create);

// 지역축제 수정 - 인증 필요
router.put('/:id', authenticate, festivalController.update);

// 지역축제 삭제 - 인증 필요
router.delete('/:id', authenticate, festivalController.remove);

module.exports = router;
