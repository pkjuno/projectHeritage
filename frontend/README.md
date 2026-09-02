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
│   │   └── home/                # 홈(마이페이지) 화면
│   ├── services/
│   │   ├── api_service.dart    # 공통 HTTP 통신 (인증 헤더 자동 부착)
│   │   ├── auth_service.dart   # 회원가입/로그인/로그아웃/탈퇴/토큰재발급
│   │   ├── user_service.dart   # 내 정보 조회
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

## 인증(로그인 상태) 흐름

1. 앱 실행 시 `SplashScreen`이 `TokenStorage`에 저장된 Access Token 유무로 로그인 여부를 판단한다.
2. 미로그인 상태면 `LoginScreen`으로 이동해 일반 로그인 또는 SNS 간편로그인을 진행한다.
3. 로그인 성공 시 백엔드가 발급한 Access/Refresh Token을 `flutter_secure_storage`에 저장한다.
4. 이후 인증이 필요한 API 호출은 `ApiService`가 저장된 Access Token을 자동으로 Authorization 헤더에 담아 보낸다.
5. 로그아웃/회원탈퇴 시 서버에 요청을 보낸 뒤 로컬에 저장된 토큰을 삭제한다.
