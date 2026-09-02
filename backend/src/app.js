const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const apiRoutes = require('./routes');
const notFoundHandler = require('./middlewares/notFoundHandler');
const errorHandler = require('./middlewares/errorHandler');

// Express 애플리케이션 인스턴스 생성
const app = express();

// 보안 관련 HTTP 헤더를 자동으로 설정해주는 미들웨어
app.use(helmet());

// 프론트엔드(Flutter 앱)와의 CORS 통신을 허용하는 미들웨어
app.use(cors({ origin: config.clientOrigin }));

// HTTP 요청 로그를 콘솔에 출력하는 미들웨어 (개발 환경에서 유용)
app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));

// JSON 형식의 요청 본문을 파싱하는 미들웨어
app.use(express.json());

// URL-encoded 형식의 요청 본문을 파싱하는 미들웨어
app.use(express.urlencoded({ extended: true }));

// "/api" 로 시작하는 모든 요청은 apiRoutes 에서 처리
app.use('/api', apiRoutes);

// 위에서 처리되지 않은 요청은 404 핸들러로 전달
app.use(notFoundHandler);

// 모든 에러는 마지막에 등록된 errorHandler에서 일괄 처리
app.use(errorHandler);

module.exports = app;
