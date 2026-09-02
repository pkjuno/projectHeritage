const express = require('express');
const heritageController = require('../controllers/heritage.controller');
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/requireAdmin');

// 문화재 도메인 관련 라우터
const router = express.Router();

// 문화재 목록 조회 (검색/필터/페이지네이션) - 공개
router.get('/', heritageController.list);

// 문화재 상세 조회 - 공개
router.get('/:id', heritageController.getById);

// 문화재 등록 - 운영자 전용
router.post('/', authenticate, requireAdmin, heritageController.create);

// 문화재 수정 - 운영자 전용
router.put('/:id', authenticate, requireAdmin, heritageController.update);

// 문화재 삭제 - 운영자 전용
router.delete('/:id', authenticate, requireAdmin, heritageController.remove);

module.exports = router;
