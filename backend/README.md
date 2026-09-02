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

> **기존 개발 DB가 있다면 주의하세요.**
> 마이페이지 기능을 추가하면서 회원 스키마가 변경되었습니다.
> (`users`에서 `provider`/`provider_id` 제거 → `social_accounts` 테이블로 분리, `nickname`/`profile_image_url` 추가)
> `sequelize.sync()`는 기존 테이블을 변경하지 않으므로, 개발 DB는 아래처럼 새로 만드는 것이 가장 간단합니다.
>
> ```sql
> DROP TABLE IF EXISTS social_accounts, users;
> ```
>
> 데이터를 보존해야 한다면 아래 마이그레이션 SQL을 참고하세요.
>
> ```sql
> -- 1) 새 컬럼 추가
> ALTER TABLE users
>   ADD COLUMN nickname VARCHAR(30) NULL,
>   ADD COLUMN profile_image_url VARCHAR(500) NULL;
>
> -- 2) 간편로그인 연결 테이블 생성 후 기존 SNS 가입 회원의 연결 정보 이관
> --    (social_accounts 테이블은 서버를 한 번 기동하면 자동 생성됩니다)
> INSERT INTO social_accounts (user_id, provider, provider_id, provider_email, created_at, updated_at)
> SELECT id, provider, provider_id, email, NOW(), NOW()
>   FROM users
>  WHERE provider <> 'local' AND provider_id IS NOT NULL;
>
> -- 3) 기존 유니크 인덱스/컬럼 정리 및 이메일 전역 유니크 적용
> ALTER TABLE users
>   DROP INDEX uq_provider_provider_id,
>   DROP INDEX uq_provider_email,
>   DROP COLUMN provider,
>   DROP COLUMN provider_id,
>   ADD UNIQUE INDEX uq_users_email (email);
> ```
>
> 3번을 적용하기 전에 `email` 중복 행이 없는지 먼저 확인해야 합니다.

## 회원(Auth) API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | 일반 회원가입 (email, password, name) | X |
| POST | `/api/auth/login` | 일반 로그인 (email, password) | X |
| POST | `/api/auth/social/:provider` | SNS 간편로그인 (`naver`\|`kakao`\|`google`, body: accessToken) | X |
| POST | `/api/auth/refresh` | Access Token 재발급 (body: refreshToken) | X |
| POST | `/api/auth/logout` | 로그아웃 | O |
| DELETE | `/api/auth/withdraw` | 회원 탈퇴 | O |

인증이 필요한 API는 `Authorization: Bearer {accessToken}` 헤더가 필요합니다.

## 마이페이지 API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/users/me` | 내 정보 + 연결된 간편로그인 목록 조회 | O |
| PATCH | `/api/users/me` | 회원정보 수정 (body: `nickname`, `name`) | O |
| PUT | `/api/users/me/profile-image` | 프로필 이미지 등록/수정 (multipart/form-data, 필드명 `image`) | O |
| DELETE | `/api/users/me/profile-image` | 프로필 이미지 삭제 | O |
| GET | `/api/users/me/social-accounts` | 연결된 간편로그인 목록 조회 | O |
| POST | `/api/users/me/social-accounts/:provider` | 간편로그인 연결 (body: `accessToken`) | O |
| DELETE | `/api/users/me/social-accounts/:provider` | 간편로그인 연결 해지 | O |

### 회원과 간편로그인 연결 구조

회원(`users`)과 간편로그인 연결(`social_accounts`)은 1:N으로 분리되어 있어,
한 회원이 카카오/네이버/구글을 **동시에 연결하고 개별적으로 해지**할 수 있습니다.

- 연결: 앱이 해당 SNS SDK로 로그인해 받은 `accessToken`을 보내면, 서버가 SNS API로 본인 확인 후 연결합니다.
- 이미 다른 회원이 사용 중인 SNS 계정은 연결할 수 없습니다. (409)
- 해지: 해지 후 로그인 수단이 하나도 남지 않는 경우(비밀번호 없음 + 마지막 SNS 연결)에는
  계정 잠김을 막기 위해 거부합니다. (400)
- 간편로그인 최초 가입 시 SNS 이메일이 기존 회원과 겹치면, 본인 확인 없는 자동 병합 대신
  409를 반환하고 "기존 계정으로 로그인 후 마이페이지에서 연결"하도록 안내합니다.

### 프로필 이미지 업로드

- 저장 위치: `UPLOAD_DIR`(기본 `uploads/`) 아래 `profiles/` 디렉터리
- 접근 경로: `/uploads/profiles/{파일명}` (Express static으로 제공)
- 허용 형식: jpg / png / webp / gif, 최대 용량 `UPLOAD_MAX_IMAGE_SIZE`(기본 5MB)
- 원본 파일명은 신뢰하지 않고 UUID로 새로 저장하며, 이미지 교체/삭제 시 이전 파일을 정리합니다.
- 로컬 디스크 저장 방식이므로, 서버를 여러 대로 확장할 때는 S3 등 외부 스토리지로 교체하는 것을 권장합니다.

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

### 데이터 출처

본 API의 스키마는 공공데이터포털(data.go.kr)의 아래 데이터셋 구조를 참고해 설계했습니다.

- 국가유산청_전국 지정문화재 현황: https://www.data.go.kr/data/15034324/openapi.do
- 국가유산청_문화재 공간 정보: https://www.data.go.kr/data/3070426/openapi.do
- 전국문화축제표준데이터: https://www.data.go.kr/data/15013104/standard.do
- 문화체육관광부_연도별 지역축제 현황: https://www.data.go.kr/data/15119156/fileData.do

## 공공데이터 배치 적재 (Importer)

`src/importers/`에 공공 Open API에서 실제 데이터를 가져와 DB에 적재하는 배치 스크립트가 있습니다.

```bash
# 문화재 전체 시도 수집/적재
npm run import:heritage

# 특정 시도만 (서울=11)
npm run import:heritage -- --sidoCode=11

# DB에 저장하지 않고 수집/매핑만 확인
npm run import:heritage -- --dry-run

# 원본 응답 1건 + 매핑 결과를 콘솔에 출력 (필드 매핑 검증용, 최초 실행 전 권장)
npm run import:heritage -- --sample

# 지역축제 수집/적재 (동일한 옵션 지원)
npm run import:festival -- --sample
```

### 동작 방식

1. `connectDatabase()`로 DB 연결/스키마 동기화 → `seedSidos()`로 시도 마스터 확인
2. **문화재**: 국가유산청 "국가유산검색" Open API(`HERITAGE_API_LIST_URL`, 인증키 불필요)를
   17개 시도코드(`ccbaCtcd`)별로 페이지네이션 조회 → `종목코드(ccbaKdcd)+관리번호(ccbaAsno)+시도` 자연키로 upsert
3. **지역축제**: `.env`의 `FESTIVAL_API_URL`(+`FESTIVAL_API_SERVICE_KEY`)로 지정한 API를
   `page`/`perPage` 파라미터로 페이지네이션 조회 → `축제명+시도+시작일` 자연키로 upsert
4. 재실행해도 같은 레코드는 새로 만들지 않고 갱신만 하므로(idempotent) 크론으로 주기 실행해도 안전합니다.
5. 공공 API 요청은 실패 시 최대 3회까지 지수 백오프로 재시도합니다.

### ⚠️ 반드시 확인할 것 — 지역축제 API 설정

문화재 API(`HERITAGE_API_LIST_URL`)는 참고자료에 명시된 인증키 불필요 엔드포인트를 기본값으로
사용하므로 별도 설정 없이 바로 동작합니다.

반면 지역축제는 데이터셋마다 활용신청 후에만 실제 요청 URL/인증키를 알 수 있는 구조이므로,
**`FESTIVAL_API_URL`/`FESTIVAL_API_SERVICE_KEY`를 직접 채워 넣어야 동작합니다.**

1. data.go.kr에서 "전국문화축제표준데이터"(15013104) 등을 활용신청하고 인증키를 발급받습니다.
2. 활용신청 상세페이지에 표시되는 "요청 URL"을 `.env`의 `FESTIVAL_API_URL`에 그대로 붙여넣습니다.
3. `npm run import:festival -- --sample --dry-run`으로 원본 응답 1건을 먼저 확인합니다.
4. `src/importers/festivalImporter.js`의 `mapItem()` 함수는 표준데이터 명세의 한글 컬럼명
   (`축제명`, `축제시작일자`, `축제종료일자`, `개최장소` 등) 기준으로 작성되어 있습니다.
   실제 응답 필드명이 다르면 이 함수만 그에 맞게 수정하면 됩니다.

문화재 쪽도 `--sample`로 원본 `ccceName`(종목명) 표기를 확인한 뒤,
`heritageImporter.js`의 `mapDesignationType()` 매핑 규칙이 실제 값과 맞는지 검증하는 것을 권장합니다.
