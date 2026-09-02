/// 애플리케이션 전역 설정 값을 모아둔 클래스.
/// 실제 배포 시에는 --dart-define 또는 환경별 설정 파일로 분리하는 것을 권장한다.
class AppConfig {
  AppConfig._(); // 인스턴스 생성을 막기 위한 private 생성자

  /// 백엔드 API 서버의 기본 주소
  static const String baseUrl = 'http://localhost:3000/api';

  /// API 요청 타임아웃 시간(초)
  static const int requestTimeoutSeconds = 10;

  // ---------------------------------------------------------------------
  // SNS 간편로그인 앱 키
  // TODO: 아래 값들은 각 개발자 콘솔에서 발급받은 실제 키로 교체해야 한다.
  //       (네이버/카카오 개발자 콘솔, Google Cloud Console)
  // ---------------------------------------------------------------------

  /// 카카오 개발자 콘솔에서 발급받은 네이티브 앱 키
  static const String kakaoNativeAppKey = 'YOUR_KAKAO_NATIVE_APP_KEY';

  /// 네이버 개발자 센터에서 발급받은 클라이언트 ID
  static const String naverClientId = 'YOUR_NAVER_CLIENT_ID';

  /// 네이버 개발자 센터에서 발급받은 클라이언트 시크릿
  static const String naverClientSecret = 'YOUR_NAVER_CLIENT_SECRET';

  /// 앱 이름 (네이버 로그인 동의 화면 등에 표시됨)
  static const String naverClientName = 'Project Heritage';
}
