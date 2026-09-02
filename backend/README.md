# Project Heritage - Backend (Node.js)

Node.js + Express + Sequelize(MySQL) 기반 백엔드 서버입니다.

## 폴더 구조

```
backend/
├── src/
│   ├── config/         # 환경 변수, DB(MySQL/Sequelize), JWT 등 설정
│   ├── routes/         # 라우터 (URL과 컨트롤러 연결)
│   ├── controllers/    # 요청/응답 처리
│   ├── services/       # 비즈니스 로직 (auth, user, token, oauth, heritage, festival)
│   ├── models/         # 도메인 모델 (Sequelize)
│   ├── middlewares/    # 공통 미들웨어 (인증, 에러 처리 등)
│   ├── seeders/         # 기준 데이터 시드 (시도 마스터 등)
│   ├── utils/          # 공통 유틸리티 함수
│   ├── app.js          # Express 앱 설정
│   └── server.js        # 서버 진입점
├── docs/
│   └── ERD.md            # 데이터베이스 ERD (Mermaid)
├── .env.example         # 환경 변수 예시 파일
└── package.json
```

데이터베이스 구조(ERD)는 [docs/ERD.md](./docs/ERD.md)에서 확인할 수 있습니다.

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
   서버 최초 기동 시 `sequelize.sync()`로 테이블이 자동 생성되고,
   이어서 광역시도 마스터 데이터(17개)가 자동으로 시드됩니다.

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

## 광역시도 API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/sidos` | 광역시도 마스터 목록 (17개, 국가유산 Open API 시도코드 기준) | X |

문화재/지역축제 검색 시 `sidoCode` 쿼리 파라미터(예: `11`=서울특별시)로 사용하는 기준 데이터입니다.

## 문화재(국가유산) API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/heritages` | 목록 조회 (query: `sidoCode`, `keyword`, `designationType`, `page`, `limit`) | X |
| GET | `/api/heritages/:id` | 상세 조회 | X |
| POST | `/api/heritages` | 등록 (body: `sidoId`, `name`, `designationType`, `designatedDate`, `address`, `latitude`, `longitude`, `description`, `imageUrl` 등) | O |
| PUT | `/api/heritages/:id` | 수정 | O |
| DELETE | `/api/heritages/:id` | 삭제 | O |

`designationType`은 `국가지정문화재`\|`시도지정문화재`\|`문화재자료`\|`등록문화재`\|`향토문화유적` 중 하나입니다.

## 지역축제 API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/festivals` | 목록 조회 (query: `sidoCode`, `keyword`, `from`, `to`, `page`, `limit`) | X |
| GET | `/api/festivals/:id` | 상세 조회 | X |
| POST | `/api/festivals` | 등록 (body: `sidoId`, `name`, `startDate`, `endDate`, `location`, `hostOrganization`, `grade` 등) | O |
| PUT | `/api/festivals/:id` | 수정 | O |
| DELETE | `/api/festivals/:id` | 삭제 | O |

`from`/`to`는 조회하려는 기간이며, 해당 기간과 축제 개최기간(`startDate`~`endDate`)이
하루라도 겹치는 축제를 조회합니다. (예: `?from=2026-11-01&to=2026-11-30`)

### 데이터 출처 및 적재 방법

본 API의 스키마는 공공데이터포털(data.go.kr)의 아래 데이터셋 구조를 참고해 설계했습니다.
실제 데이터를 채우려면 공공데이터포털 회원가입 및 활용신청(인증키 발급) 후,
각 Open API 응답을 위 등록 API(`POST /api/heritages`, `POST /api/festivals`) 요청 형태로
변환해 적재하는 별도의 배치/스크립트를 추가하면 됩니다. (현재 저장소에는 포함되어 있지 않습니다)

- 국가유산청_전국 지정문화재 현황: https://www.data.go.kr/data/15034324/openapi.do
- 국가유산청_문화재 공간 정보: https://www.data.go.kr/data/3070426/openapi.do
- 전국문화축제표준데이터: https://www.data.go.kr/data/15013104/standard.do
- 문화체육관광부_연도별 지역축제 현황: https://www.data.go.kr/data/15119156/fileData.do
