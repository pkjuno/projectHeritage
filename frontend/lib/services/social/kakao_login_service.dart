import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';

/// 카카오 SDK를 이용한 간편로그인 처리 클래스.
/// main.dart에서 KakaoSdk.init(nativeAppKey: AppConfig.kakaoNativeAppKey)로
/// 초기화되어 있어야 정상 동작한다.
class KakaoLoginService {
  /// 카카오톡(설치되어 있으면 앱, 아니면 웹)으로 로그인하고 Access Token을 반환한다.
  /// 로그인을 취소하거나 실패하면 null을 반환한다.
  Future<String?> signIn() async {
    try {
      final isKakaoTalkInstalled = await isKakaoTalkInstalledCheck();

      final token = isKakaoTalkInstalled
          ? await UserApi.instance.loginWithKakaoTalk()
          : await UserApi.instance.loginWithKakaoAccount();

      return token.accessToken;
    } catch (error) {
      // TODO: 실제 서비스에서는 에러 종류(사용자 취소 등)에 따라 세분화된 처리 필요
      return null;
    }
  }

  /// 카카오톡 앱 설치 여부를 확인하는 내부 함수.
  Future<bool> isKakaoTalkInstalledCheck() async {
    return UserApi.instance.isKakaoTalkInstalled();
  }
}
