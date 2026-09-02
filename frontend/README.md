# Project Heritage - Frontend (Flutter)

Flutter 기반 프론트엔드 애플리케이션입니다.

## 폴더 구조

```
frontend/
├── lib/
│   ├── config/       # 앱 설정 값 (API 주소 등)
│   ├── routes/       # 라우트 이름 및 화면 매핑
│   ├── screens/       # 화면(페이지) 단위 위젯
│   ├── services/      # 백엔드 API 통신 로직
│   ├── models/        # 데이터 모델 (DTO)
│   ├── widgets/        # 재사용 가능한 공통 위젯
│   ├── utils/          # 공통 상수/유틸리티
│   ├── app.dart         # MaterialApp 설정
│   └── main.dart        # 앱 진입점
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
