# Project Heritage - Frontend (Flutter)

Flutter 기반 프론트엔드 애플리케이션입니다.

## 디자인

무채색 기반에 **포인트 컬러 하나**를 쓰는 차분한 미니멀 톤입니다.
시안: 커뮤니티 5개 화면을 캔버스로 그려 확정한 뒤 코드에 반영했습니다.

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `background` | `#FAF9F7` | 화면 바탕 (따뜻한 오프화이트) |
| `surface` | `#FFFFFF` | 카드/목록이 얹히는 면 |
| `ink` | `#1C1B19` | 본문/제목 (따뜻한 근사 검정) |
| `inkMuted` | `#94908A` | 메타 정보 |
| `line` / `lineSubtle` | `#E9E6E1` / `#F3F0EB` | 구분선 |
| `accent` | `#3D5F52` | **유일한 강조색** (깊은 청자녹) |
| `danger` | `#9C4A3C` | 삭제/탈퇴 등 되돌리기 어려운 동작 |

- **색은 `theme/app_colors.dart`에만 정의합니다.** 화면에서 `Colors.grey` 같은 걸
  직접 쓰면 톤을 바꿀 때 전부 찾아다녀야 합니다.
- **강조색은 하나뿐입니다.** 새 색을 추가하고 싶어지면 그 자리가 정말 강조인지 먼저 의심하세요.
  위시리스트 하트와 간편로그인 연결 표시도 빨강/초록이 아니라 강조색을 씁니다.
  (카카오 노랑·네이버 초록은 브랜드 규정상 예외)
- **그림자 대신 얇은 선**으로 면을 구분합니다. 미니멀 톤에서 그림자는 소음입니다.

### 서체

`google_fonts`로 두 가지를 씁니다.

| 서체 | 쓰는 곳 | 이유 |
| --- | --- | --- |
| Gowun Batang (명조) | 화면 제목, 게시글 제목 | UI 전체가 산세리프면 어떤 앱과도 구별되지 않습니다 |
| IBM Plex Sans KR | 본문, 라벨, 메타 | 한글 자소가 또렷해 11~13px 작은 글자가 많은 목록에서 버팁니다 |

> `google_fonts`는 첫 실행 때 폰트를 내려받아 캐시합니다. 네트워크가 없으면
> 시스템 기본 한글 폰트로 대체되므로 화면이 깨지지는 않습니다.
> 오프라인 보장이 필요하면 폰트 파일을 `assets/`에 번들하세요.

### 형태

- 모서리 반경 **4px**. 알약 모양은 반응 칩·댓글 입력창·FAB에만 씁니다.
- 터치 목표는 **최소 44px**. 버튼 기본 높이는 48px입니다.
- 간격은 `AppSizes`의 **8 / 16 / 24**를 따릅니다.

## 폴더 구조

```
frontend/
├── lib/
│   ├── config/               # 앱 설정 값 (API 주소, SNS 앱 키 등)
│   ├── routes/                # 라우트 이름 및 화면 매핑
│   ├── screens/
│   │   ├── splash/            # 스플래시(자동 로그인 체크) 화면
│   │   ├── auth/               # 로그인 / 회원가입 화면
│   │   ├── home/                # 홈 화면
│   │   └── mypage/              # 마이페이지 (프로필/회원정보/간편로그인 연결)
│   ├── services/
│   │   ├── api_service.dart    # 공통 HTTP 통신 (인증 헤더 자동 부착, 파일 업로드)
│   │   ├── auth_service.dart   # 회원가입/로그인/로그아웃/탈퇴/토큰재발급
│   │   ├── user_service.dart   # 내 정보 조회/수정, 프로필 이미지
│   │   ├── social_account_service.dart # 간편로그인 연결/해지
│   │   ├── token_storage.dart  # JWT 보안 저장소 (flutter_secure_storage)
│   │   └── social/              # SNS(카카오/네이버/구글) 로그인 SDK 래퍼
│   ├── theme/                   # 색상 토큰(app_colors) + 전역 테마(app_theme)
│   ├── models/                 # 데이터 모델 (DTO)
│   ├── widgets/                  # 재사용 가능한 공통 위젯
│   ├── utils/                    # 공통 상수/유틸리티
│   ├── app.dart                  # MaterialApp 설정
│   └── main.dart                 # 앱 진입점 (SNS SDK 초기화 포함)
└── pubspec.yaml
```

## 실행 방법

이 저장소에는 플랫폼별(android/ios/web 등) 실행 폴더가 포함되어 있지 않습니다.
아래 명령어로 최초 1회 플랫폼 폴더를 생성한 뒤 실행하세요.

```bash
flutter create .
flutter pub get
flutter run
```

## 커뮤니티

`lib/screens/community/`

| 화면 | 역할 |
| --- | --- |
| `community_home_screen.dart` | 커뮤니티 홈. 내 활동 요약 / 게시판 / 축제 이야기 / 인기글 / 최신글 |
| `post_list_screen.dart` | 게시판별 목록. 검색 + 최신순·인기순 + 무한 스크롤 |
| `post_detail_screen.dart` | 본문 + 반응 바 + 댓글 트리 + 공유 |
| `post_editor_screen.dart` | 작성/수정 공용 |
| `my_activity_screen.dart` | 내 글 / 내 댓글 / 내 반응 탭 |

홈 화면은 서버의 대시보드 API 한 번으로 그립니다. 화면 조각마다 API를 부르면
첫 화면에만 5~6번의 왕복이 생깁니다.

### 게시판 정책은 서버에서 온다

게시판 코드를 앱에 하드코딩하지 않습니다. 서버가 `writeRole`과 `requireFestival`을
함께 내려주므로 작성 화면이 그 값만 보고 구성됩니다.

- `writeRole == 'admin'`인 게시판(공지사항)은 **선택지에서 제외**합니다.
  서버가 403으로 막지만, 고를 수 있게 두면 다 쓰고 나서야 거절당합니다.
- `requireFestival == true`인 게시판(축제 후기)에서만 축제 선택 칸이 나타납니다.

게시판 이동(수정 시 카테고리 변경)은 지원하지 않습니다. 서버도 막고 있습니다.

### 반응 UI

다섯 종류(👍😍😮😢😠)를 모두 보여주고 내가 고른 것만 강조합니다.
이미 고른 것을 다시 누르면 취소됩니다.

숫자는 **서버가 돌려준 집계를 그대로 반영**하고 앱에서 계산하지 않습니다.
"종류를 바꿔도 총합은 그대로" 같은 규칙을 앱에서 또 구현하면 서버와 어긋납니다.

`lib/utils/reaction_types.dart`의 목록은 서버 ENUM과 같아야 합니다.
없는 종류를 보내면 서버가 400을 냅니다. (테스트가 이 목록을 고정합니다)

### 댓글

- 답글은 한 단계만 들여씁니다. 서버가 깊이를 1단계로 고정하므로 계산이 필요 없습니다.
- 답글의 답글도 최상위 댓글에 붙으므로, 답글에 달린 "답글" 버튼도 대상은 최상위 댓글입니다.
- **삭제된 댓글에는 어떤 동작 버튼도 두지 않습니다.** 서버가 작성자를 null로 가려 보내므로
  화면도 이름을 비우고 내용만 흐리게 보여줍니다.
- 답글을 쓰는 중에는 입력창 위에 대상이 표시됩니다. 없으면 사용자가 어디에 쓰는지 알 수 없습니다.

### 축제 상세와의 연결

`festival_detail_screen.dart` 하단에 **이 축제 후기**가 붙습니다.
글이 없어도 "후기 쓰기" 버튼은 보여줍니다. 첫 후기를 남길 통로가 없으면
이 섹션은 영원히 비어 있게 됩니다.

여기서 후기를 쓰면 축제가 이미 정해져 있으므로 작성 화면에서 축제를 고르지 않습니다.

### 신고 / 차단

- 게시글·댓글 메뉴의 **신고**는 `widgets/report_sheet.dart` 바텀시트를 띄웁니다.
  사유는 서버 ENUM과 같은 5종이고, **'기타'는 설명이 있어야 제출 버튼이 켜집니다.**
- 시트 상단에 "신고만으로 바로 삭제되지는 않습니다"를 적어둡니다.
  이 안내가 없으면 "신고했는데 왜 그대로냐"는 오해가 생깁니다.
- **차단**은 확인 다이얼로그를 거칩니다. 차단하면 그 글도 목록에서 사라지므로
  확인 없이 실행하면 사용자가 무슨 일이 일어났는지 모릅니다.
  차단 후에는 그 사람의 글에 머물 이유가 없어 이전 화면으로 돌아갑니다.
- `mypage/blocked_users_screen.dart`에서 해제할 수 있습니다.
  차단은 조용히 걸리는 설정이라 해제할 자리가 없으면
  왜 어떤 사람의 글이 안 보이는지 알 방법이 없어집니다.

### 운영자 화면

`screens/admin/report_queue_screen.dart` — 커뮤니티 홈 우상단 깃발 아이콘.
**운영자에게만 보입니다.** 서버가 403으로 막지만, 보이면 눌러보게 되고 눌러보면 거절당합니다.

- 게시글 신고와 댓글 신고를 **한 목록**에 보여줍니다. 두 화면으로 나누면
  한쪽을 안 보게 되고, 안 보는 쪽의 신고가 쌓입니다.
- 처리 방식은 **조치함+숨김 / 조치함 / 문제 없음** 셋으로 나눠 고르게 합니다.
  처리와 숨김을 한 버튼으로 묶으면 "확인만 하려는데 글이 사라지는" 실수가 납니다.
- 이미 가려진 대상에는 `가려짐` 태그를 붙여 중복 조치를 막습니다.
- 목록의 한 줄 요약만 보고 판단하지 않도록, 눌러서 실제 글로 이동할 수 있습니다.

게시글 상세의 운영자 메뉴에서 **상단 고정 / 숨김**도 토글합니다.

> 앱의 `UserModel.role`은 **메뉴를 보여줄지만** 판단합니다.
> 실제 권한 검사는 서버가 매 요청마다 DB에서 다시 하므로,
> 이 값을 조작해도 운영자 기능이 실행되지는 않습니다.

### 사진 첨부

글 작성 화면에서 최대 5장(`AppConfig.maxPostImages`). 서버 설정과 같은 값이어야 하며,
다르면 다 고르고 나서 서버에 거절당합니다.

- 업로드 전 `maxWidth: 1600`, `imageQuality: 85`로 줄입니다.
  요즘 휴대폰 사진은 한 장이 5MB를 넘기 쉬워 원본 그대로 보내면 용량 제한에 걸립니다.
- 첨부가 없으면 JSON으로, 있으면 multipart로 보냅니다.
  첨부가 없는데도 multipart를 쓰면 요청이 불필요하게 커집니다.
- 상세에서는 세로로 이어 붙여 보여줍니다. 가로 스크롤은 사진이 몇 장인지 알기 어렵고
  본문을 읽는 흐름을 끊습니다.
- **수정 시에는 첨부를 바꿀 수 없습니다.** 서버가 지원하지 않으므로 화면에도 두지 않았습니다.

### 알림

`notification_screen.dart`는 `postId`가 있으면 게시글 상세로, 없으면 축제 상세로 보냅니다.

## 검증

```bash
flutter analyze   # 정적 분석 (타입 오류, 잘못된 API 사용, 린트)
flutter test      # 모델 파싱 + 백엔드 응답 계약 테스트
```

### 계약(contract) 테스트

`test/contract_test.dart`와 `test/fixtures/*.json`이 이 프로젝트에서 가장 중요한 테스트입니다.

픽스처는 **실제로 실행 중인 백엔드에서 받아온 응답을 그대로 저장한 것**입니다.
손으로 만든 샘플이 아닙니다.

손으로 만든 JSON으로 테스트하면 "내가 상상한 서버"에 맞춰 모델을 맞추게 되고,
서버가 필드를 빼거나 타입을 바꿔도 그 테스트는 계속 통과합니다.

픽스처는 신고·차단·이미지 첨부까지 포함해 실제 서버에서 다시 받아 갱신합니다.
`me.json`의 이메일 값만 치환했습니다 — 계약 테스트가 확인하는 것은
"어떤 키가 오는가"이지 값이 아니고, 데모 계정이라도 이메일을 저장소에 남길 이유가 없습니다.

> 실제로 이 테스트가 앱을 죽이는 버그 2건을 잡았습니다.
>
> 1. 게시글 작성자에 `UserModel`(로그인한 나 자신, 이메일 필수)을 재사용했는데,
>    서버는 게시판에 이메일을 노출하지 않습니다. **목록을 여는 순간 죽습니다.**
>    → 공개 프로필용 `AuthorModel`을 따로 만들어 해결했습니다.
> 2. "내 댓글"의 원글에는 id/제목/게시판만 오는데 `PostModel`(작성일 필수)로 파싱했습니다.
>    → 가벼운 `PostRefModel`을 만들어 해결했습니다.
>
> 둘 다 `flutter analyze`는 통과합니다. 런타임 캐스팅 오류라 정적 분석으로는 보이지 않습니다.

**픽스처를 다시 받는 방법**: 백엔드를 띄우고 API를 호출해 응답의 `data`를
`test/fixtures/`에 저장하면 됩니다. 서버 응답이 바뀌면 픽스처를 갱신하고,
그때 이 테스트가 깨지는 것이 정상입니다.

`flutter analyze`는 **패키지 API를 잘못 쓴 경우까지 잡아냅니다.**
실제로 카카오 SDK의 `isKakaoTalkInstalled()`를 `UserApi`의 메서드로 잘못 호출한 것을
이 단계에서 발견했습니다. 코드를 고친 뒤에는 반드시 돌려보세요.

## 백엔드 연동

`lib/config/app_config.dart`의 `baseUrl` 값을 백엔드 서버 주소로 맞춰주세요.
기본값은 로컬에서 실행 중인 `backend` 서버(`http://localhost:3000/api`)를 가리킵니다.

## SNS 간편로그인 설정 (필수)

`lib/config/app_config.dart`에 있는 아래 값들을 각 개발자 콘솔에서 발급받은 실제 키로 교체해야 합니다.
키를 설정하지 않으면 SNS 로그인 SDK 초기화/호출이 실패합니다.

| 값 | 발급처 |
| --- | --- |
| `kakaoNativeAppKey` | [Kakao Developers](https://developers.kakao.com) |
| `naverClientId` / `naverClientSecret` | [네이버 개발자 센터](https://developers.naver.com) |
| Google | `google_sign_in`은 Firebase 콘솔 또는 Google Cloud Console에서 발급한 `google-services.json`(Android) / `GoogleService-Info.plist`(iOS)를 플랫폼 폴더에 추가해야 합니다. |

또한 각 플랫폼별 네이티브 설정(AndroidManifest.xml의 URL scheme, iOS Info.plist의 URL Types,
카카오/네이버 개발자 콘솔에 등록하는 패키지명/키 해시 등)이 추가로 필요합니다.
자세한 절차는 각 SDK의 공식 문서를 참고하세요.

- kakao_flutter_sdk_user: https://developers.kakao.com/docs/latest/ko/flutter/getting-started
- flutter_naver_login: https://pub.dev/packages/flutter_naver_login
- google_sign_in: https://pub.dev/packages/google_sign_in

## 축제 캘린더

`lib/screens/festival/festival_calendar_screen.dart`

- `table_calendar`로 월 단위 달력을 그리고, 축제가 진행되는 날짜에 마커를 표시합니다.
- 상단 드롭다운에서 지역(시도)을 선택해 필터링할 수 있습니다. (전국이 기본)
- 날짜를 선택하면 그날 진행 중인 축제 목록이 아래에 나오고, 누르면 상세 화면으로 이동합니다.
- 달을 넘기면 해당 월 데이터를 새로 조회하며, 선택 날짜도 그 달 안으로 자동 이동합니다.

서버는 축제 목록과 "날짜 → 축제 ID" 인덱스를 따로 내려주므로,
한 달 내내 열리는 축제가 날짜마다 중복 전송되지 않습니다.
`FestivalCalendarModel.festivalsOn(date)`이 이 인덱스를 풀어 `eventLoader`에 연결됩니다.

### 축제 상세 / 위시리스트 / 내 일정

- `festival_detail_screen.dart`: 상세 정보와 함께 **위시리스트 담기/빼기**, **일정 추가**를 제공합니다.
  일정 추가 시 `showDatePicker`의 선택 범위를 **축제 개최 기간으로 제한**해,
  축제가 열리지 않는 날짜를 아예 고를 수 없게 합니다. (서버에서도 동일하게 검증)
- `mypage/my_festival_screen.dart`: 찜한 축제와 내 일정을 탭으로 나눠 보여주고 삭제할 수 있습니다.

## 둘러보기 / 알림

- `screens/festival/festival_discover_screen.dart`: **지금 진행 중 / 이번 주말 / 곧 시작** 큐레이션과
  **내 주변 축제**를 보여줍니다. 주변 축제는 위치 권한이 필요하므로 사용자가 버튼을 눌렀을 때만
  `geolocator`로 현재 위치를 받아 조회합니다. 권한 거부·위치 서비스 꺼짐 등 실패 사유를 구분해 안내합니다.
- `screens/festival/festival_detail_screen.dart`: 축제 상세 하단에 **이 축제 주변 문화재**를 가까운 순으로
  보여줍니다. (좌표가 없는 축제는 해당 섹션이 숨겨집니다)
- `screens/mypage/notification_screen.dart`: 알림함. 안 읽은 알림은 굵게 표시되고,
  누르면 읽음 처리 후 연결된 축제 상세로 이동합니다.

> `geolocator`는 플랫폼별 위치 권한 설정이 필요합니다.
> (Android: `AndroidManifest.xml`의 `ACCESS_FINE_LOCATION`, iOS: `Info.plist`의
> `NSLocationWhenInUseUsageDescription`) 자세한 내용은 https://pub.dev/packages/geolocator 참고.

## 마이페이지

`lib/screens/mypage/mypage_screen.dart`에서 아래 기능을 제공합니다.

- **프로필 관리**: `image_picker`로 갤러리에서 이미지를 선택해 등록/변경하고, 삭제할 수 있습니다.
  업로드 전 `maxWidth`/`imageQuality`로 리사이즈해 서버의 용량 제한(기본 5MB)을 넘지 않도록 합니다.
- **회원정보**: 닉네임을 수정합니다. (2~30자)
- **간편로그인 연결/해지**: 카카오/네이버/구글별로 연결 상태를 보여주고,
  연결 시에는 해당 SNS SDK로 로그인해 받은 토큰을 백엔드로 전달합니다.
  로그인 수단이 하나만 남는 경우 해지 버튼이 비활성화됩니다. (서버에서도 동일하게 차단)

> `image_picker`는 iOS의 사진 접근 권한 설명(`NSPhotoLibraryUsageDescription`) 등
> 플랫폼별 설정이 필요합니다. 자세한 내용은 https://pub.dev/packages/image_picker 를 참고하세요.

## 인증(로그인 상태) 흐름

1. 앱 실행 시 `SplashScreen`이 `TokenStorage`에 저장된 Access Token 유무로 로그인 여부를 판단한다.
2. 미로그인 상태면 `LoginScreen`으로 이동해 일반 로그인 또는 SNS 간편로그인을 진행한다.
3. 로그인 성공 시 백엔드가 발급한 Access/Refresh Token을 `flutter_secure_storage`에 저장한다.
4. 이후 인증이 필요한 API 호출은 `ApiService`가 저장된 Access Token을 자동으로 Authorization 헤더에 담아 보낸다.
5. 로그아웃/회원탈퇴 시 서버에 요청을 보낸 뒤 로컬에 저장된 토큰을 삭제한다.
