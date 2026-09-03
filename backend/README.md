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
│   ├── scripts/          # 운영용 CLI 스크립트 (운영자 권한 부여 등)
│   ├── jobs/             # 주기 실행 배치 (방문 하루 전 알림 등)
│   ├── migrations/       # DB 스키마 마이그레이션 (sequelize-cli)
│   ├── utils/          # 공통 유틸리티 함수
│   ├── app.js          # Express 앱 설정
│   └── server.js        # 서버 진입점
├── tests/
│   ├── unit/             # 순수 로직 단위 테스트 (DB 불필요)
│   └── integration/      # API 통합 테스트 (테스트 DB 사용)
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
3. 의존성 설치, **스키마 생성**, 서버 실행
   ```bash
   npm install
   npm run db:migrate   # 테이블 생성 (최초 1회 및 스키마 변경 시마다)
   npm run dev
   ```
   서버는 기동 시 마이그레이션이 적용되어 있는지 확인하고,
   광역시도 마스터 데이터(17개)를 자동으로 시드합니다.

## 데이터베이스 마이그레이션

스키마는 **마이그레이션이 유일한 기준**입니다. 서버는 테이블을 자동으로 만들거나 바꾸지 않습니다.

```bash
npm run db:migrate          # 아직 적용되지 않은 마이그레이션 실행
npm run db:migrate:status   # 적용 상태 확인
npm run db:migrate:undo     # 마지막 마이그레이션 되돌리기
```

### 왜 sync()를 쓰지 않는가

예전에는 기동할 때마다 `sequelize.sync()`로 테이블을 만들었습니다.
그런데 `sync()`는 **이미 있는 테이블에 새 컬럼을 추가하지 않습니다.**
그래서 모델에 필드를 더할 때마다 기존 DB에서 `Unknown column` 오류가 났고,
README에 수동 `ALTER TABLE` SQL을 계속 덧붙여야 했습니다.
(실제로 개발 중 두 번 겪었습니다)

이제 스키마 변경은 마이그레이션 파일 하나만 추가하면 되고, 적용 이력도 DB에 남습니다.

### 스키마를 바꾸려면

1. 모델 파일(`src/models/*.js`)을 수정합니다.
2. 같은 변경을 적용하는 마이그레이션을 추가합니다.
   ```bash
   npx sequelize-cli migration:generate --name add-something-to-users
   ```
3. `npm test`를 돌립니다.
   **모델과 마이그레이션이 어긋나면 테스트가 실패합니다.**
   (`tests/integration/migration.test.js`가 두 스키마를 컬럼·인덱스 단위로 비교합니다)
4. `npm run db:migrate`로 적용합니다.

`down`(되돌리기)도 반드시 구현해야 합니다. 이것 역시 테스트가 강제합니다.

## 테스트

```bash
npm test              # 전체 테스트 실행
npm run test:watch    # 파일 변경 감지 모드
```

- `tests/unit/` — 날짜 계산, 캘린더 인덱스 생성 등 **순수 로직**. DB가 필요 없습니다.
- `tests/integration/` — supertest로 라우터부터 DB까지 **실제 경로를 그대로** 통과시킵니다.
  외부 SNS API 호출만 `jest.mock`으로 대체합니다.

테스트는 **테스트 전용 DB**(`DB_NAME_TEST`, 기본 `project_heritage_test`)를 사용합니다.
매 케이스마다 테이블을 비우기 때문에, 개발 DB를 실수로 지우지 않도록
`NODE_ENV=test`일 때는 `DB_NAME`을 아예 참조하지 않도록 되어 있습니다.

```sql
CREATE DATABASE project_heritage_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

통합 테스트가 같은 DB를 공유하므로 `--runInBand`(직렬 실행)로 돌립니다.

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

### 알림 API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/users/me/notifications` | 내 알림 목록 + 안 읽은 개수 | O |
| PATCH | `/api/users/me/notifications/read-all` | 전체 읽음 처리 | O |
| PATCH | `/api/users/me/notifications/:id/read` | 1건 읽음 처리 | O |
| PUT | `/api/users/me/push-settings` | 푸시 수신 설정/기기 토큰 등록 (body: `pushEnabled`, `pushToken`) | O |

### 방문 하루 전 알림

일정을 등록해두기만 하면 사용자가 직접 앱을 열기 전까지 아무 일도 일어나지 않습니다.
그래서 **방문 예정일 하루 전에 알림을 만들어주는 배치**가 일정 기능의 나머지 절반입니다.

```bash
npm run job:reminder                        # 오늘 기준 "내일" 방문 일정에 알림 생성
npm run job:reminder -- --days=3            # 3일 뒤 방문 일정 대상
npm run job:reminder -- --date=2026-11-05   # 특정 날짜를 "오늘"로 간주 (테스트용)
```

서버가 뜨면 `SCHEDULE_REMINDER_CRON`(기본 `0 9 * * *`, 매일 오전 9시) 주기로 자동 실행됩니다.

- 알림은 **DB에 이력으로 남고**(알림함), 그와 별개로 푸시를 시도합니다.
  푸시 전송에 실패해도 사용자가 앱에서 확인할 수 있고, 나중에 재발송 대상을 찾을 수 있습니다.
- 같은 일정에 대해서는 `dedupeKey`로 중복 생성을 막으므로,
  배치가 하루에 여러 번 돌거나 재시도되어도 알림은 한 번만 만들어집니다.
- 수신을 거부(`pushEnabled=false`)했거나 기기 토큰이 없으면 푸시는 건너뛰고 알림함에만 쌓입니다.

> **실제 푸시 전송은 아직 연결되어 있지 않습니다.**
> FCM 서비스 계정 키가 필요하므로, 전송부를 `src/services/pushSender.service.js` 한 곳으로
> 분리해두고 현재는 로그만 남깁니다. 실제 연동 시 그 파일의 `sendPush` 안에 있는 TODO만
> 구현하면 되고 나머지 코드는 그대로 둡니다.
>
> 기기 토큰은 현재 **회원당 1개**만 저장하므로 다른 기기에서 로그인하면 대체됩니다.
> 여러 기기를 동시에 지원하려면 `device_tokens` 테이블로 분리해야 합니다.

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

## 권한 (운영자 / 일반 회원)

축제·문화재 데이터는 공공데이터를 정제해 서비스하는 자산이므로,
**등록/수정/삭제는 운영자(admin)만** 할 수 있습니다. 조회는 누구나 가능합니다.

| 구분 | 조회 | 등록/수정/삭제 |
| --- | --- | --- |
| 축제 · 문화재 | 누구나 | 운영자만 |
| 위시리스트 · 내 일정 · 마이페이지 | 본인만 | 본인만 |

- 신규 가입 회원은 항상 `user` 권한입니다. 가입 요청에 `role`을 넣어도 무시됩니다.
- 권한 승격은 **서버에 접근 가능한 사람만 실행할 수 있는 CLI**로만 제공합니다.
  API로 열어두면 그 자체가 권한 상승 통로가 되기 때문입니다.

```bash
npm run admin:grant -- admin@example.com            # 운영자로 승격
npm run admin:grant -- admin@example.com --revoke   # 권한 회수
```

- 권한은 JWT에 담지 않고 **매 요청마다 DB에서 확인**합니다.
  토큰에 넣으면 권한을 회수해도 토큰이 만료될 때까지(기본 1시간) 운영자로 남기 때문입니다.

## 문화재(국가유산) API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/heritages` | 목록 조회 (query: `sidoCode`, `keyword`, `designationType`, `page`, `limit`) | X |
| GET | `/api/heritages/:id` | 상세 조회 | X |
| POST | `/api/heritages` | 등록 (body: `sidoId`, `name`, `designationType`, `designatedDate`, `address`, `latitude`, `longitude`, `description`, `imageUrl` 등) | 운영자 |
| PUT | `/api/heritages/:id` | 수정 | 운영자 |
| DELETE | `/api/heritages/:id` | 삭제 | 운영자 |

`designationType`은 `국가지정문화재`\|`시도지정문화재`\|`문화재자료`\|`등록문화재`\|`향토문화유적` 중 하나입니다.

## 지역축제 API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/festivals` | 목록 조회 (query: `sidoCode`, `keyword`, `from`, `to`, `page`, `limit`) | X |
| GET | `/api/festivals/calendar` | 캘린더 조회 (query: `year`, `month`, `sidoCode`, `keyword`) | X |
| GET | `/api/festivals/:id` | 상세 조회 (로그인 시 `isWishlisted` 포함) | 선택 |
| POST | `/api/festivals` | 등록 (body: `sidoId`, `name`, `startDate`, `endDate`, `location`, `hostOrganization`, `grade` 등) | 운영자 |
| PUT | `/api/festivals/:id` | 수정 | 운영자 |
| DELETE | `/api/festivals/:id` | 삭제 | 운영자 |

`from`/`to`는 조회하려는 기간이며, 해당 기간과 축제 개최기간(`startDate`~`endDate`)이
하루라도 겹치는 축제를 조회합니다. (예: `?from=2026-11-01&to=2026-11-30`)

## 탐색 API (큐레이션 / 내 주변)

캘린더는 "날짜를 알고 찾는" 화면이라, "이번 주말에 갈 만한 거 없나?" 같은 실제 탐색 방식과는 맞지 않습니다.
그래서 **시간**과 **거리** 기준으로 찾는 API를 따로 뒀습니다.

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/festivals/curated` | 진행 중 / 이번 주말 / 곧 시작 (query: `sidoCode`, `limit`, `date`) | X |
| GET | `/api/festivals/nearby` | 내 주변 축제 (query: `lat`, `lng`, `radius`, `limit`, `onlyOngoing`) | X |
| GET | `/api/heritages/nearby` | 내 주변 문화재 (query: `lat`, `lng`, `radius`, `limit`) | X |
| GET | `/api/festivals/:id/nearby-heritages` | 이 축제 주변 문화재 (query: `radius`, `limit`) | X |

- 거리 계산은 MySQL `ST_Distance_Sphere`를 사용하며, 응답의 각 항목에 `distanceKm`가 함께 담깁니다.
  정렬은 가까운 순입니다.
- **반경은 최대 200km로 제한**됩니다. "주변"의 의미를 벗어나면 전국 조회와 다를 바 없기 때문입니다.
  기본값은 20km입니다.
- 좌표가 없는 데이터(`latitude`/`longitude`가 null)는 거리 계산이 불가능하므로 결과에서 제외됩니다.
- `/api/festivals/nearby`는 기본적으로 **아직 끝나지 않은 축제만** 반환합니다.
  이미 끝난 축제를 "근처"라고 안내하면 쓸모가 없기 때문입니다. (`onlyOngoing=false`로 해제 가능)
- `이번 주말`은 기준일이 속한 주의 토~일입니다. 이미 주말이면 그 주말을, 평일이면 다가오는 주말을 가리킵니다.

`/api/festivals/:id/nearby-heritages`는 **"축제 갔다가 근처 문화재 들르기"** 동선을 위한 API로,
축제 상세 화면에서 사용합니다. 축제에 좌표가 없으면 400과 함께 그 이유를 알려줍니다.

### 축제 캘린더 응답 구조

축제는 **기간**을 가지므로 캘린더에서는 시작일 하루가 아니라 **진행 중인 모든 날짜**에 표시되어야 합니다.
다만 축제 객체를 날짜마다 복사하면 한 달 내내 열리는 축제가 30번 중복되므로,
목록은 한 번만 내려주고 날짜별로는 **ID 인덱스**만 제공합니다.

```jsonc
GET /api/festivals/calendar?year=2026&month=11&sidoCode=11

{
  "year": 2026, "month": 11,
  "startDate": "2026-11-01", "endDate": "2026-11-30",
  "festivals": [ { "id": 1, "name": "서울빛초롱축제", "startDate": "2026-11-05", "endDate": "2026-11-07", ... } ],
  "days": { "2026-11-05": [1], "2026-11-06": [1], "2026-11-07": [1] },
  "truncated": false   // true면 축제가 너무 많아 일부만 내려간 것 (지역/키워드로 좁혀야 함)
}
```

- 월을 걸쳐 진행되는 축제는 **조회한 달에 해당하는 구간만** `days`에 들어갑니다.
  (10/28~11/02 축제는 11월 조회 시 `2026-11-01`, `2026-11-02`에만 표시)
- 한 달에 담을 수 있는 축제는 최대 500건이며, 초과 시 `truncated: true`로 알려줍니다.

## 위시리스트 / 내 일정 API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/users/me/wishlists` | 내가 찜한 축제 목록 (query: `page`, `limit`) | O |
| POST | `/api/users/me/wishlists/:festivalId` | 위시리스트에 추가 | O |
| DELETE | `/api/users/me/wishlists/:festivalId` | 위시리스트에서 제거 | O |
| GET | `/api/users/me/schedules` | 내 일정 목록 (query: `from`, `to`) | O |
| POST | `/api/users/me/schedules` | 일정 등록 (body: `festivalId`, `visitDate`, `memo`) | O |
| PATCH | `/api/users/me/schedules/:id` | 일정 수정 (body: `visitDate`, `memo`) | O |
| DELETE | `/api/users/me/schedules/:id` | 일정 삭제 | O |

### 위시리스트와 일정을 나눈 이유

두 기능은 답하는 질문이 다릅니다.

- **위시리스트**: "가보고 싶다" — 날짜가 없는 북마크. 축제당 1건만 담을 수 있습니다.
- **일정**: "언제 갈지" — 방문일과 메모가 있는 개인 계획. 같은 축제를 여러 날 방문하는 계획도 세울 수 있습니다.

일정 등록/수정 시 **방문일이 축제 개최 기간 안에 있는지 검증**합니다.
축제가 열리지 않는 날짜로 일정을 잡는 것을 막기 위한 도메인 규칙입니다.
같은 축제를 같은 날짜로 중복 등록하는 것도 막습니다. (409)

### 데이터 출처

본 API의 스키마는 공공데이터포털(data.go.kr)의 아래 데이터셋 구조를 참고해 설계했습니다.

- 국가유산청_전국 지정문화재 현황: https://www.data.go.kr/data/15034324/openapi.do
- 국가유산청_문화재 공간 정보: https://www.data.go.kr/data/3070426/openapi.do
- 전국문화축제표준데이터: https://www.data.go.kr/data/15013104/standard.do
- 문화체육관광부_연도별 지역축제 현황: https://www.data.go.kr/data/15119156/fileData.do

## 커뮤니티 API

축제와 연결되는 게시판입니다. 게시글은 `festivalId`를 선택적으로 가질 수 있어,
축제 상세 화면에 그 축제의 후기를 붙일 수 있습니다.

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/community/categories` | 게시판 목록 | - |
| GET | `/api/community/posts` | 게시글 목록 (query: `category`, `festivalId`, `keyword`, `sort`, `page`, `limit`) | 선택 |
| GET | `/api/community/posts/:id` | 게시글 상세 (조회수 집계 포함) | 선택 |
| POST | `/api/community/posts` | 글 작성 (body: `category`, `title`, `content`, `festivalId`) | O |
| PUT | `/api/community/posts/:id` | 글 수정 (body: `title`, `content`, `festivalId`) | O (작성자) |
| DELETE | `/api/community/posts/:id` | 글 삭제 | O (작성자/운영자) |
| PATCH | `/api/community/posts/:id/pin` | 상단 고정 (body: `isPinned`) | O (운영자) |
| PATCH | `/api/community/posts/:id/hide` | 블라인드 처리 (body: `hidden`) | O (운영자) |

목록 응답에는 본문(`content`) 대신 앞 150자만 잘린 `preview`가 담깁니다.
제목만 보이면 어떤 글인지 판단하려고 매번 들어가 봐야 하고, 그렇다고 본문 전체를 실으면
20개짜리 한 페이지가 수백 KB가 됩니다. 자르는 일은 `LEFT()`로 DB에 시킵니다 —
애플리케이션에서 자르면 이미 전체 본문을 네트워크로 실어 온 뒤라 아끼려던 것을 못 아낍니다.

`sort`는 `latest`(기본)와 `popular`를 지원합니다. 고정 글은 정렬 방식과 무관하게 항상 맨 위입니다.
목록/상세는 비회원도 볼 수 있고, 로그인한 경우 각 글에 `isMine` 플래그가 붙습니다.

### 게시판별 정책

게시판은 ENUM이 아니라 `board_categories` 테이블입니다.
게시판을 추가할 때 마이그레이션이 필요 없고, 게시판별 정책이 컬럼으로 표현됩니다.

| 코드 | 이름 | 작성 권한 | 축제 연결 |
| --- | --- | --- | --- |
| `notice` | 공지사항 | 운영자만 | - |
| `free` | 자유게시판 | 누구나 | 선택 |
| `review` | 축제 후기 | 누구나 | **필수** |
| `companion` | 동행 구해요 | 누구나 | 선택 |
| `question` | 질문/답변 | 누구나 | 선택 |

### 권한 정책

| 행위 | 비회원 | 회원 | 작성자 | 운영자 |
| --- | --- | --- | --- | --- |
| 목록/상세 조회 | O | O | O | O |
| 글 작성 | X | O | - | O |
| 공지 작성 | X | X | - | O |
| 글 수정 | X | X | O | **X** |
| 글 삭제 | X | X | O | O |
| 고정 / 블라인드 | X | X | X | O |

운영자에게 **수정 권한을 주지 않습니다.** 남의 글 내용을 바꿀 수 있다는 것 자체가 사고 원인이고,
문제가 있는 글은 고치는 게 아니라 숨기는(`hidden`) 것이 맞습니다.

권한은 JWT 클레임이 아니라 **매 요청 DB에서 확인**합니다. 토큰에 역할을 담으면
권한을 회수해도 토큰이 만료될 때까지(기본 1시간) 운영자로 남습니다.

### 삭제 정책

물리 삭제를 하지 않습니다. 행을 지우면 신고 처리 이력과 통계가 함께 사라집니다.

| 상태 | 의미 | 목록 | 상세 |
| --- | --- | --- | --- |
| `published` | 정상 | 노출 | 누구나 |
| `hidden` | 운영자 블라인드 | 제외 | 작성자와 운영자만 (그 외 404) |
| `deleted` | 작성자 삭제 | 제외 | 404 (작성자에게도) |

숨김 처리된 글을 작성자에게까지 404로 감추면 자기 글이 왜 사라졌는지 알 방법이 없어서
작성자와 운영자에게는 보이게 했습니다. 대신 그 상태에서는 **수정할 수 없습니다.**
수정으로 상태를 되돌리는 우회를 막기 위해서입니다.

### 조회수를 세는 방식

상세를 열 때마다 +1 하면 새로고침만으로 숫자가 부풀고, 그 숫자가 인기글 점수에 들어가므로
순위까지 오염됩니다. 그래서 `post_views`에 "누가 / 어떤 글을 / 어느 날" 봤는지를 남기고
**하루에 한 번만** 셉니다.

- 로그인 회원은 `u:{회원ID}`, 비로그인은 `a:{IP 해시}`로 식별합니다.
  두 경우를 한 컬럼에 담아야 유니크 제약 하나로 중복을 막을 수 있습니다.
- **IP 원문은 저장하지 않습니다.** IPv4는 주소 공간이 좁아 소금 없는 해시는 전수 대입으로
  복원되므로, 서버 비밀 키(`POST_VIEW_HASH_SECRET`)를 붙인 HMAC을 씁니다.
  운영 환경에서는 이 값을 반드시 교체하세요.
- 작성자 본인의 조회는 세지 않습니다. 자기 글을 열어보는 것으로 순위가 오르면 안 됩니다.
- 로그 기록과 카운터 증가는 **같은 트랜잭션**에서 처리합니다.
  따로 두면 로그만 남고 카운터는 안 오르는 어긋남이 생깁니다.

`post_views`는 (글 x 조회자 x 날짜)만큼 쌓이므로 오래된 행을 지우는 정리 배치가 필요합니다.

### 댓글 / 반응 / 공유 API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/community/posts/:id/comments` | 댓글 목록 (대댓글 포함, query: `page`, `limit`) | 선택 |
| POST | `/api/community/posts/:id/comments` | 댓글 작성 (body: `content`, `parentId`) | O |
| PUT | `/api/community/comments/:id` | 댓글 수정 (body: `content`) | O (작성자) |
| DELETE | `/api/community/comments/:id` | 댓글 삭제 | O (작성자/운영자) |
| POST | `/api/community/comments/:id/like` | 댓글 좋아요 토글 | O |
| PUT | `/api/community/posts/:id/reaction` | 반응 등록/변경 (body: `type`) | O |
| DELETE | `/api/community/posts/:id/reaction` | 반응 취소 | O |
| POST | `/api/community/posts/:id/share` | 공유 기록 (body: `channel`) | O |

#### 좋아요와 공감이 한 테이블인 이유

한 회원은 글 하나에 반응을 **하나만** 남깁니다.
`like`가 곧 좋아요이고, `love`/`wow`/`sad`/`angry`가 공감입니다.
'좋아요'에서 '슬퍼요'로 바꾸면 새 행이 생기는 게 아니라 `type`만 갈아탑니다.
따라서 **종류를 바꿔도 총 반응 수는 변하지 않습니다.**

```jsonc
// PUT /api/community/posts/1/reaction  {"type": "sad"}
{
  "total": 2,
  "byType": { "like": 1, "love": 0, "wow": 0, "sad": 1, "angry": 0 },
  "myReaction": "sad"
}
```

반응이 없는 타입도 `0`으로 채워 내려줍니다. 화면에서 없는 키를 매번 방어하지 않기 위해서입니다.

토글(`POST .../like`)이 아니라 `PUT`인 이유는, '좋아요 → 슬퍼요' 변경이 토글로는
표현되지 않기 때문입니다. 하트 버튼 하나만 쓰는 화면이라면
`PUT {type:'like'}`와 `DELETE`를 번갈아 호출하면 됩니다.

#### 댓글 깊이는 1단계

대댓글에 답글을 달면 그 대댓글이 아니라 **최상위 댓글**에 붙습니다.
무한 depth는 모바일에서 들여쓰기를 감당할 수 없고 조회가 재귀 쿼리로 갑니다.

목록은 **최상위 댓글 기준으로 페이지를 나누고**, 각 댓글의 대댓글은 모두 함께 내려줍니다.
대댓글까지 잘라 페이지를 나누면 "답글 3개 중 1개만 보이는" 화면이 나옵니다.

#### 삭제된 댓글

행을 지우지 않고 `status='deleted'`로 두고 내용과 **작성자 정보를 함께 가립니다.**
내용만 가리고 이름을 남기면 누가 무엇을 지웠는지가 드러납니다.

- 답글이 달려 있으면 → 자리를 남기고 "삭제된 댓글입니다"로 표시 (대화 맥락 유지)
- 답글이 없으면 → 목록에서 아예 제외 (덩그러니 남을 이유가 없음)

#### 카운터 정합성

카운터 증감은 **원본 변경과 같은 트랜잭션**에서 처리합니다.
따로 두면 댓글은 달렸는데 목록의 댓글 수는 그대로인 상태가 생깁니다.

감소는 `GREATEST(count - 1, 0)`으로 감싸, 어딘가에서 증가를 빠뜨렸더라도
"-1개의 댓글"이 화면에 나오지는 않게 했습니다.

그래도 트랜잭션 밖의 사고(배포 중 강제 종료, 과거 데이터 이관)까지 막지는 못하므로
실제 값과 대조하는 보정 스크립트를 둡니다.

```bash
npm run community:recount            # 어긋난 항목만 출력 (변경 없음)
npm run community:recount -- --apply # 실제로 보정
```

```
[OK]  게시글 반응 수: 어긋난 행 없음
[!!]  게시글 댓글 수: 1건 불일치
        id=2 저장값=99 실제값=0
      -> 보정 완료
```

> 보정 기준은 "화면에 보이는 것"입니다. 삭제된 댓글(`status='deleted'`)은 세지 않습니다.
> 통합 테스트가 API로 만든 데이터의 카운터를 같은 기준으로 대조하므로,
> 스크립트와 서비스의 계산 기준이 어긋나면 테스트가 실패합니다.

### 대시보드 / 내 활동 API

| Method | Path | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/community/dashboard` | 커뮤니티 홈 (인기글/최신글/게시판/축제이야기/내 활동) | 선택 |
| GET | `/api/community/me/posts` | 내가 쓴 글 | O |
| GET | `/api/community/me/comments` | 내가 쓴 댓글 (원글 정보 포함) | O |
| GET | `/api/community/me/reactions` | 내가 반응한 글 (반응 종류 포함) | O |

대시보드는 커뮤니티 홈을 **한 번의 요청으로** 그립니다.
화면 조각마다 API를 따로 부르면 첫 화면에만 5~6번의 왕복이 생깁니다.

```jsonc
{
  "trending":   [ /* 최근 7일 인기글 5개 (본문 제외) */ ],
  "latest":     [ /* 전체 최신글 5개 */ ],
  "categories": [ { "code": "free", "name": "자유게시판", "postCount": 128, "todayCount": 4 } ],
  "festivalTalk": [ { "festival": {...}, "postCount": 12 } ],
  "myActivity": { "postCount": 3, "commentCount": 12, "receivedReactionCount": 40 } // 비로그인이면 null
}
```

#### 인기글 점수

```
score = 반응 x 3 + 댓글 x 2 + 조회 x 0.1
```

- 대상은 **최근 7일 글**입니다. 한 달 전 글이 계속 상단에 남아 있으면 커뮤니티가 죽은 것처럼 보입니다.
  (기간 제한은 인기글에만 적용되고 최신글 목록에는 없습니다)
- 점수는 저장하지 않고 **조회 시 계산**합니다. 컬럼으로 두면 가중치를 바꿀 때마다
  전체 재계산 배치가 필요합니다. 대상이 7일 글로 제한돼 정렬 대상 자체가 적습니다.
  글이 많아져 느려지면 그때 `trending_score` 컬럼 + 배치로 옮기면 됩니다.
- 대시보드에는 **본문을 싣지 않습니다.** 첫 화면 응답이 불필요하게 커집니다.

#### 축제 이야기

지금 **진행 중인** 축제 가운데 글이 많은 순으로 3개를 보여줍니다.
이 섹션이 일반 게시판 대시보드와 다른 지점이고, 축제 도메인과 커뮤니티를 잇는 자리입니다.
끝난 축제는 제외합니다. 그렇지 않으면 "지금 뭐가 열리는지"를 알 수 없습니다.

#### 내 활동

`receivedReactionCount`는 내가 **누른** 반응이 아니라 내 글이 **받은** 반응입니다.
커뮤니티에서 의미 있는 숫자는 얼마나 눌렀는지가 아니라 얼마나 받았는지입니다.
자기 글에 스스로 누른 반응은 세지 않습니다. 그러면 혼자서 숫자를 올릴 수 있습니다.

내 활동 목록의 노출 기준:

| 목록 | 포함 | 제외 |
| --- | --- | --- |
| 내 글 | `published`, `hidden` | `deleted` |
| 내 댓글 | 원글이 살아있는 댓글 | 원글이 지워진 댓글 |
| 내 반응 | 원글이 살아있는 반응 | 원글이 지워진 반응 |

숨겨진 글을 남기는 이유는 운영자가 왜 숨겼는지 확인할 방법이 있어야 하기 때문이고,
지운 글을 빼는 이유는 지운 글이 목록에 남아 있으면 지운 것이 아니기 때문입니다.

### 커뮤니티 알림

기존 알림 도메인(`notifications`)을 그대로 씁니다.
`type` ENUM에 3종이 추가되고 `post_id` 컬럼이 붙었습니다. (마이그레이션 `20260903120000`)

| type | 발생 시점 | 묶음 단위 |
| --- | --- | --- |
| `post_comment` | 내 글에 댓글이 달림 | 댓글 1건당 1회 |
| `comment_reply` | 내 댓글에 답글이 달림 | 답글 1건당 1회 |
| `post_reaction` | 내 글이 반응을 받음 | **글 1개당 하루 1회** |

- **자기 자신에게는 보내지 않습니다.** 내 글에 내가 단 댓글은 알림이 아니라 소음입니다.
- 글쓴이와 댓글쓴이가 같은 사람이면 답글 알림 하나만 갑니다.
  같은 사건으로 두 번 울리지 않게 하기 위해서입니다.
- **반응 알림은 하루 한 건으로 묶습니다.** 건건이 알리면 인기 글은 하루에 수십 번 울립니다.
  묶는 기준은 `dedupeKey`에 들어가는 날짜이고, 이미 보낸 알림은 **본문의 개수만 갱신**합니다.
  새로 만들면 하루 한 번 원칙이 깨지고, 그냥 두면 "1개"에서 숫자가 멈춘 알림이 남습니다.
- 반응 **종류만 바꾸는 것**은 새 반응이 아니므로 알림이 가지 않습니다.

#### 알림 발송은 트랜잭션 밖에서

알림은 부수 효과입니다. 알림 저장이 실패했다고 방금 단 댓글까지 롤백되면
사용자는 "댓글이 안 달렸다"고 느낍니다. 알림 하나를 잃는 편이 낫습니다.

그래서 `communityNotifier.service.js`는 트랜잭션이 **커밋된 뒤에** 호출되고,
예외를 밖으로 던지지 않고 로그만 남깁니다.

> 뒤집어 말하면 알림이 조용히 유실될 수 있다는 뜻입니다.
> 유실까지 막으려면 outbox 테이블에 기록하고 배치가 재시도하는 구조가 필요합니다.
> 지금 규모에서는 과하다고 판단해 넣지 않았습니다.

### 알려진 한계

- **검색**: `LIKE '%키워드%'`라 인덱스를 타지 못합니다. 글이 쌓이면 ngram 파서를 쓰는
  FULLTEXT 인덱스로 옮겨야 합니다.
- **인기순 정렬**: 카운터를 비정규화해 `COUNT(*)` + `GROUP BY`는 없앴지만,
  점수 식으로 정렬하는 부분은 여전히 filesort입니다. 실측 후
  `(category_id, status, reaction_count)` 인덱스를 추가할 수 있습니다.
- **공유 수는 자진신고 지표입니다.** 클라이언트가 "공유했다"고 알려준 값이라 실제로
  전송했는지는 알 수 없습니다. 정확한 유입은 딥링크 파라미터로 따로 측정해야 합니다.
- **알림 유실 가능성**: 알림 발송은 트랜잭션 밖에서 실패를 삼키므로, 드물게 알림이
  만들어지지 않을 수 있습니다. (본 기능은 정상 동작) outbox + 재시도가 근본 해법입니다.
- 신고/차단과 이미지 첨부는 아직 없습니다. (`docs/COMMUNITY_PLAN.md` 9장 참고)

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
