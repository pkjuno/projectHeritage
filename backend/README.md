# Project Heritage - Backend (Node.js)

Node.js + Express 기반 백엔드 서버입니다.

## 폴더 구조

```
backend/
├── src/
│   ├── config/         # 환경 변수, DB 등 설정
│   ├── routes/         # 라우터 (URL과 컨트롤러 연결)
│   ├── controllers/    # 요청/응답 처리
│   ├── services/       # 비즈니스 로직
│   ├── models/         # 도메인 모델
│   ├── middlewares/    # 공통 미들웨어 (에러 처리 등)
│   ├── utils/          # 공통 유틸리티 함수
│   ├── app.js          # Express 앱 설정
│   └── server.js        # 서버 진입점
├── .env.example         # 환경 변수 예시 파일
└── package.json
```

## 실행 방법

```bash
cp .env.example .env
npm install
npm run dev
```

## API 예시

- `GET /api/health` - 헬스체크
- `GET /api/users` - 사용자 목록 조회
- `GET /api/users/:id` - 사용자 단건 조회
- `POST /api/users` - 사용자 생성
