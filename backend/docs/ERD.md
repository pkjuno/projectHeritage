# Project Heritage - ERD

`data.go.kr` 공공데이터포털의 **전국 지정문화재 현황**, **전국문화축제표준데이터** 등의 필드 구성을
참고하여 설계한 데이터베이스 구조입니다. (참고: 국가유산청 Open API 시도코드 `ccbaCtcd`)

- **Sido**: 광역시도 마스터 (국가유산청 Open API 시도코드 기준 17개 고정 데이터)
- **Heritage**: 문화재(국가유산) 정보
- **Festival**: 지역축제 정보
- **User**: 회원 (이전에 구현한 인증 도메인, 문화재/축제와 직접적인 FK 관계는 없음)

GitHub에서는 아래 Mermaid 코드 블록이 다이어그램으로 자동 렌더링됩니다.

```mermaid
erDiagram
    SIDO ||--o{ HERITAGE : "소재한다"
    SIDO ||--o{ FESTIVAL : "개최된다"

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
        string email
        string password "bcrypt 해시, SNS 전용 계정은 null"
        string name
        enum provider "local/naver/kakao/google"
        string provider_id "SNS 고유 ID"
        string refresh_token "bcrypt 해시"
        enum status "active/withdrawn"
        datetime withdrawn_at
        datetime created_at
        datetime updated_at
    }
```

## 관계 설명

| 관계 | 설명 |
| --- | --- |
| Sido 1 : N Heritage | 하나의 시도에 여러 문화재가 소속된다. |
| Sido 1 : N Festival | 하나의 시도에서 여러 지역축제가 개최된다. |
| User | 현재 Heritage/Festival과 직접적인 연관관계는 없다. (추후 "관심 축제/문화재 즐겨찾기" 등 확장 시 User-Festival, User-Heritage 다대다 관계 추가 가능) |

## 설계 근거 (PDF 자료 매핑)

| 테이블 | 참고한 공공데이터셋 | 주요 매핑 필드 |
| --- | --- | --- |
| Sido | 국가유산 Open API 시도코드(`ccbaCtcd`) 표 | `code`, `name` |
| Heritage | 국가유산청_전국 지정문화재 현황 Open API, 국가유산청_문화재 공간 정보 Open API | 명칭→`name`, 지정일→`designated_date`, 소재 시도→`sido_id`, 좌표→`latitude`/`longitude`, 설명→`description` |
| Festival | 전국문화축제표준데이터, 문화체육관광부_연도별 지역축제 현황 | 축제명→`name`, 개최장소→`location`, 기간→`start_date`/`end_date`, 주최기관→`host_organization`, 홈페이지→`homepage_url`, 위도·경도→`latitude`/`longitude` |

> 공공데이터포털 Open API 응답 필드는 데이터셋마다 조금씩 다를 수 있으므로, 실제 연동 시
> `categoryCode`/`managementNo`처럼 원본 API 고유 필드를 별도 컬럼으로 보관해두면
> 추후 재동기화(재수집) 시 원본 레코드와 매칭하기 용이합니다.
