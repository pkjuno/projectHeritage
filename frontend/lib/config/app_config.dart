/// 애플리케이션 전역 설정 값을 모아둔 클래스.
/// 실제 배포 시에는 --dart-define 또는 환경별 설정 파일로 분리하는 것을 권장한다.
class AppConfig {
  AppConfig._(); // 인스턴스 생성을 막기 위한 private 생성자

  /// 백엔드 API 서버의 기본 주소
  static const String baseUrl = 'http://localhost:3000/api';

  /// API 요청 타임아웃 시간(초)
  static const int requestTimeoutSeconds = 10;
}
