# Project Heritage - ERD

`data.go.kr` 공공데이터포털의 **전국 지정문화재 현황**, **전국문화축제표준데이터** 등의 필드 구성을
참고하여 설계한 데이터베이스 구조입니다. (참고: 국가유산청 Open API 시도코드 `ccbaCtcd`)

- **Sido**: 광역시도 마스터 (국가유산청 Open API 시도코드 기준 17개 고정 데이터)
- **Heritage**: 문화재(국가유산) 정보
- **Festival**: 지역축제 정보
- **User**: 회원 (인증/마이페이지 도메인, 문화재/축제와 직접적인 FK 관계는 없음)
- **SocialAccount**: 회원에 연결된 간편로그인(카카오/네이버/구글). 회원 1명이 여러 개를 연결할 수 있다.
- **FestivalWishlist**: 회원이 찜한 축제 (날짜 없는 북마크)
- **FestivalSchedule**: 회원의 축제 방문 일정 (방문일 + 메모)
- **Notification**: 회원에게 보낸 알림 이력 (방문 하루 전 리마인더 등)

이 문서는 **읽기용 다이어그램**이고, 실제 스키마의 기준은 `src/migrations/`의 마이그레이션 파일입니다.
모델과 마이그레이션이 어긋나면 `npm test`가 실패하므로 셋은 항상 같은 상태를 유지합니다.

GitHub에서는 아래 Mermaid 코드 블록이 다이어그램으로 자동 렌더링됩니다.

```mermaid
erDiagram
    SIDO ||--o{ HERITAGE : "소재한다"
    SIDO ||--o{ FESTIVAL : "개최된다"
    USER ||--o{ SOCIAL_ACCOUNT : "연결한다"
    USER ||--o{ FESTIVAL_WISHLIST : "찜한다"
    USER ||--o{ FESTIVAL_SCHEDULE : "일정을 세운다"
    FESTIVAL ||--o{ FESTIVAL_WISHLIST : "찜된다"
    FESTIVAL ||--o{ FESTIVAL_SCHEDULE : "방문 대상이 된다"
    USER ||--o{ NOTIFICATION : "알림을 받는다"
    FESTIVAL ||--o{ NOTIFICATION : "알림의 대상이 된다"

    SIDO {
        int id PK
        string code UK "시도코드 (예: 11)"
        string name UK "시도명 (예: 서울특별시)"
        datetime created_at
        datetime updated_at
    }

    HERITAGE {
        int id PK
        int sido_id FK
        string name "문화재명"
        enum designation_type "지정구분(국가지정/시도지정/문화재자료/등록문화재/향토문화유적)"
        string category_code "종목코드(ccbaKdcd, 참고용)"
        string management_no "관리번호(ccbaAsno, 참고용)"
        date designated_date "지정일"
        string address "소재지 주소"
        decimal latitude "위도"
        decimal longitude "경도"
        text description "설명"
        string image_url "대표 이미지 URL"
        datetime created_at
        datetime updated_at
    }

    FESTIVAL {
        int id PK
        int sido_id FK
        string name "축제명"
        string sigungu "개최 시군구"
        string location "개최 장소"
        date start_date "개최 시작일"
        date end_date "개최 종료일"
        string host_organization "주최기관"
        string manage_organization "주관기관"
        string grade "축제 등급"
        string homepage_url "홈페이지 URL"
        decimal latitude "위도"
        decimal longitude "경도"
        text description "설명"
        datetime created_at
        datetime updated_at
    }

    USER {
        int id PK
        string email UK "로그인 아이디"
        string password "bcrypt 해시, 간편로그인 전용 계정은 null"
        string name "이름"
        string nickname "닉네임 (마이페이지에서 수정)"
        string profile_image_url "프로필 이미지 경로"
        string refresh_token "bcrypt 해시"
        boolean push_enabled "푸시 수신 동의"
        string push_token "기기 푸시 토큰 (회원당 1개)"
        enum role "user/admin (축제·문화재 관리 권한)"
        enum status "active/withdrawn"
        datetime withdrawn_at
        datetime created_at
        datetime updated_at
    }

    SOCIAL_ACCOUNT {
        int id PK
        int user_id FK
        enum provider "naver/kakao/google"
        string provider_id "제공자 발급 고유 ID"
        string provider_email "제공자가 준 이메일"
        datetime created_at "연결 시각"
        datetime updated_at
    }

    FESTIVAL_WISHLIST {
        int id PK
        int user_id FK
        int festival_id FK
        datetime created_at "찜한 시각"
        datetime updated_at
    }

    FESTIVAL_SCHEDULE {
        int id PK
        int user_id FK
        int festival_id FK
        date visit_date "방문 예정일 (축제 기간 내)"
        string memo "개인 메모"
        datetime created_at
        datetime updated_at
    }

    NOTIFICATION {
        int id PK
        int user_id FK
        int festival_id FK "이동할 축제 (없을 수 있음)"
        enum type "schedule_reminder/festival_start/notice"
        string title
        string body
        string dedupe_key "중복 생성 방지 키"
        datetime sent_at "푸시 발송 시각 (null이면 미발송)"
        datetime read_at "확인 시각 (null이면 안 읽음)"
        datetime created_at
        datetime updated_at
    }
```

## 관계 설명

| 관계 | 설명 |
| --- | --- |
| Sido 1 : N Heritage | 하나의 시도에 여러 문화재가 소속된다. |
| Sido 1 : N Festival | 하나의 시도에서 여러 지역축제가 개최된다. |
| User 1 : N SocialAccount | 회원 1명이 카카오/네이버/구글을 각각 연결할 수 있고, 마이페이지에서 개별 해지가 가능하다. 회원 삭제 시 연결 정보도 함께 삭제(CASCADE)된다. |
| User N : M Festival (Wishlist) | 회원이 축제를 찜한다. FestivalWishlist가 교차 테이블 역할을 하며, 회원/축제 삭제 시 함께 정리된다. |
| User N : M Festival (Schedule) | 회원이 축제 방문 일정을 세운다. 같은 축제를 여러 날 방문할 수 있어 방문일까지 포함해 유일성을 판단한다. |
| User - Heritage | 현재 직접적인 연관관계는 없다. (추후 문화재 즐겨찾기 등으로 확장 가능) |

### 위시리스트 / 일정 제약 조건

| 제약 | 목적 |
| --- | --- |
| `uq_wishlist_user_festival` (user_id + festival_id) | 같은 축제를 중복으로 찜하는 것을 방지 |
| `uq_schedule_user_festival_date` (user_id + festival_id + visit_date) | 같은 축제를 같은 날짜로 중복 등록하는 것을 방지 |
| `idx_schedule_user_visit_date` (user_id + visit_date) | 내 일정을 기간으로 조회할 때 사용 |
| `uq_notification_user_dedupe` (user_id + dedupe_key) | 배치 재실행 시 같은 알림이 중복 생성되는 것을 방지 |
| `idx_notification_user_created` (user_id + created_at) | 알림함을 최신순으로 조회할 때 사용 |

> 위시리스트는 "가보고 싶다"는 날짜 없는 북마크, 일정은 "언제 갈지" 정해진 계획이라
> 서로 다른 질문에 답하므로 테이블을 분리했습니다.
> 일정의 `visit_date`는 애플리케이션 레벨에서 해당 축제의 개최 기간 안에 있는지 검증합니다.

### SocialAccount 제약 조건

| 제약 | 목적 |
| --- | --- |
| `uq_social_provider_provider_id` (provider + provider_id) | 하나의 SNS 계정이 여러 회원에게 중복 연결되는 것을 방지 |
| `uq_social_user_provider` (user_id + provider) | 한 회원이 같은 제공자를 중복 연결하는 것을 방지 |

> 연결 해지 시 서버는 "비밀번호가 없고 남은 SNS 연결이 1개뿐인" 경우를 거부해,
> 로그인 수단이 모두 사라져 계정에 접근하지 못하게 되는 상황을 막습니다.

## 설계 근거 (PDF 자료 매핑)

| 테이블 | 참고한 공공데이터셋 | 주요 매핑 필드 |
| --- | --- | --- |
| Sido | 국가유산 Open API 시도코드(`ccbaCtcd`) 표 | `code`, `name` |
| Heritage | 국가유산청_전국 지정문화재 현황 Open API, 국가유산청_문화재 공간 정보 Open API | 명칭→`name`, 지정일→`designated_date`, 소재 시도→`sido_id`, 좌표→`latitude`/`longitude`, 설명→`description` |
| Festival | 전국문화축제표준데이터, 문화체육관광부_연도별 지역축제 현황 | 축제명→`name`, 개최장소→`location`, 기간→`start_date`/`end_date`, 주최기관→`host_organization`, 홈페이지→`homepage_url`, 위도·경도→`latitude`/`longitude` |

> 공공데이터포털 Open API 응답 필드는 데이터셋마다 조금씩 다를 수 있으므로, 실제 연동 시
> `categoryCode`/`managementNo`처럼 원본 API 고유 필드를 별도 컬럼으로 보관해두면
> 추후 재동기화(재수집) 시 원본 레코드와 매칭하기 용이합니다.

## 배치 적재(Importer) 자연키

`src/importers/`의 배치 스크립트(`npm run import:heritage` / `import:festival`)는 아래 자연키로
upsert하므로, 동일한 원본 데이터를 여러 번 수집해도 중복 생성되지 않습니다. 자세한 사용법은
[../README.md의 "공공데이터 배치 적재" 절](../README.md#공공데이터-배치-적재-importer)을 참고하세요.

| 테이블 | 자연키 | 비고 |
| --- | --- | --- |
| Heritage | `category_code` + `management_no` + `sido_id` | `uq_heritage_source_key` 유니크 인덱스로 DB 레벨에서도 강제 |
| Festival | `name` + `sido_id` + `start_date` | 원본에 안정적인 고유 ID가 없어 조합 키 사용 |
