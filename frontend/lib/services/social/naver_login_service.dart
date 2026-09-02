import 'package:flutter_naver_login/flutter_naver_login.dart';

/// 네이버 SDK를 이용한 간편로그인 처리 클래스.
/// main.dart에서 FlutterNaverLogin.initSdk(...)로 초기화되어 있어야 정상 동작한다.
class NaverLoginService {
  /// 네이버 로그인 화면을 띄우고 Access Token을 반환한다.
  /// 로그인을 취소하거나 실패하면 null을 반환한다.
  Future<String?> signIn() async {
    try {
      final result = await FlutterNaverLogin.logIn();

      if (result.status != NaverLoginStatus.loggedIn) {
        return null;
      }

      final tokenResult = await FlutterNaverLogin.currentAccessToken;
      return tokenResult.accessToken;
    } catch (error) {
      // TODO: 실제 서비스에서는 에러 종류(사용자 취소 등)에 따라 세분화된 처리 필요
      return null;
    }
  }
}
