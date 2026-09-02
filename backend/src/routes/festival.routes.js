const express = require('express');
const festivalController = require('../controllers/festival.controller');
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/requireAdmin');
const optionalAuthenticate = require('../middlewares/optionalAuthenticate');
const discoveryController = require('../controllers/discovery.controller');

// 지역축제 도메인 관련 라우터
const router = express.Router();

// 아래 고정 경로들은 ":id" 라우트보다 먼저 등록해야 id로 해석되지 않는다.

// 축제 캘린더 조회 (월 단위) - 공개
router.get('/calendar', festivalController.calendar);

// 홈 화면 큐레이션: 진행 중 / 이번 주말 / 곧 시작 - 공개
router.get('/curated', discoveryController.curated);

// 내 주변 축제 (좌표 기준, 가까운 순) - 공개
router.get('/nearby', discoveryController.nearbyFestivals);

// 지역축제 목록 조회 (검색/필터/페이지네이션) - 공개
router.get('/', festivalController.list);

// 지역축제 상세 조회 - 공개 (로그인 시 위시리스트 담김 여부를 함께 반환)
router.get('/:id', optionalAuthenticate, festivalController.getById);

// 이 축제 주변의 문화재 - 공개 (축제 갔다가 들를 곳 추천)
router.get('/:id/nearby-heritages', discoveryController.heritagesNearFestival);

// 지역축제 등록 - 운영자 전용
router.post('/', authenticate, requireAdmin, festivalController.create);

// 지역축제 수정 - 운영자 전용
router.put('/:id', authenticate, requireAdmin, festivalController.update);

// 지역축제 삭제 - 운영자 전용
router.delete('/:id', authenticate, requireAdmin, festivalController.remove);

module.exports = router;
