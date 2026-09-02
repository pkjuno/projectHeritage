import 'package:google_sign_in/google_sign_in.dart';

/// 구글 SDK를 이용한 간편로그인 처리 클래스.
class GoogleLoginService {
  final GoogleSignIn _googleSignIn = GoogleSignIn(scopes: ['email']);

  /// 구글 로그인 화면을 띄우고 Access Token을 반환한다.
  /// 로그인을 취소하거나 실패하면 null을 반환한다.
  Future<String?> signIn() async {
    try {
      final account = await _googleSignIn.signIn();
      if (account == null) return null; // 사용자가 로그인을 취소한 경우

      final authentication = await account.authentication;
      return authentication.accessToken;
    } catch (error) {
      // TODO: 실제 서비스에서는 에러 종류(네트워크 오류 등)에 따라 세분화된 처리 필요
      return null;
    }
  }
}
