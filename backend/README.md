# Project Heritage - Backend (Node.js)

Node.js + Express + Sequelize(MySQL) 기반 백엔드 서버입니다.

## 폴더 구조

```
backend/
├── src/
│   ├── config/         # 환경 변수, DB(MySQL/Sequelize), JWT 등 설정
│   ├── routes/         # 라우터 (URL과 컨트롤러 연결)
│   ├── controllers/    # 요청/응답 처리
│   ├── services/       # 비즈니스 로직 (auth, user, token, oauth)
│   ├── models/         # 도메인 모델 (Sequelize)
│   ├── middlewares/    # 공통 미들웨어 (인증, 에러 처리 등)
│   ├── utils/          # 공통 유틸리티 함수
│   ├── app.js          # Express 앱 설정
│   └── server.js        # 서버 진입점
├── .env.example         # 환경 변수 예시 파일
└── package.json
```

## 실행 방법

1. MySQL 서버를 준비하고 데이터베이스를 생성합니다.
   ```sql
   CREATE DATABASE project_heritage CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. 환경 변수를 설정합니다.
   ```bash
   cp .env.example .env
   # DB_* , JWT_* 값을 실제 환경에 맞게 수정
   ```
3. 의존성 설치 및 서버 실행
   ```bash
   npm install
   npm run dev
   ```
   서버 최초 기동 시 `sequelize.sync()`로 `users` 테이블이 자동 생성됩니다.

## 회원(Auth) API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | 일반 회원가입 (email, password, name) | X |
| POST | `/api/auth/login` | 일반 로그인 (email, password) | X |
| POST | `/api/auth/social/:provider` | SNS 간편로그인 (`naver`\|`kakao`\|`google`, body: accessToken) | X |
| POST | `/api/auth/refresh` | Access Token 재발급 (body: refreshToken) | X |
| POST | `/api/auth/logout` | 로그아웃 | O |
| DELETE | `/api/auth/withdraw` | 회원 탈퇴 | O |
| GET | `/api/users/me` | 내 정보 조회 | O |

인증이 필요한 API는 `Authorization: Bearer {accessToken}` 헤더가 필요합니다.

### SNS 간편로그인 동작 방식

Flutter 앱이 각 SNS SDK(kakao_flutter_sdk, flutter_naver_login, google_sign_in)로 먼저 로그인해서
발급받은 **Access Token**을 `POST /api/auth/social/:provider` 로 전달하면,
백엔드가 해당 SNS의 사용자 정보 API를 호출해 프로필을 조회하고
최초 로그인 시 자동으로 회원을 생성한 뒤 자체 JWT(Access/Refresh Token)를 발급합니다.

### 세션(로그인 상태) 관리

- Access Token: 짧은 만료 시간(기본 1시간), 매 요청마다 Authorization 헤더로 전달
- Refresh Token: 긴 만료 시간(기본 14일), DB에 bcrypt 해시로 저장되어 로그아웃/탈취 감지 시 무효화 가능
- 로그아웃 시 DB에 저장된 Refresh Token을 제거해 재사용을 차단
