# Project Heritage - Frontend (Flutter)

Flutter 기반 프론트엔드 애플리케이션입니다.

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

## 검증

```bash
flutter analyze   # 정적 분석 (타입 오류, 잘못된 API 사용, 린트)
flutter test      # 모델 파싱 등 순수 로직 테스트
```

`flutter analyze`는 **패키지 API를 잘못 쓴 경우까지 잡아냅니다.**
실제로 카카오 SDK의 `isKakaoTalkInstalled()`를 `UserApi`의 메서드로 잘못 호출한 것을
이 단계에서 발견했습니다. 코드를 고친 뒤에는 반드시 돌려보세요.

`test/models_test.dart`는 서버 응답을 모델로 변환하는 부분을 검증합니다.
여기가 틀리면 화면에 엉뚱한 값이 나오거나 런타임 캐스팅 오류가 나는데,
실기기로 확인하기 전에는 알아채기 어려운 종류의 버그입니다.

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
