import '../models/user_model.dart';
import 'api_service.dart';
import 'social/google_login_service.dart';
import 'social/kakao_login_service.dart';
import 'social/naver_login_service.dart';

/// 마이페이지의 간편로그인 연결/해지를 담당하는 서비스.
/// 연결 시에는 각 SNS SDK로 먼저 로그인해 Access Token을 받고, 그 토큰을 백엔드에 전달한다.
class SocialAccountService {
  final ApiService _apiService;
  final GoogleLoginService _googleLoginService;
  final KakaoLoginService _kakaoLoginService;
  final NaverLoginService _naverLoginService;

  SocialAccountService({
    ApiService? apiService,
    GoogleLoginService? googleLoginService,
    KakaoLoginService? kakaoLoginService,
    NaverLoginService? naverLoginService,
  })  : _apiService = apiService ?? ApiService(),
        _googleLoginService = googleLoginService ?? GoogleLoginService(),
        _kakaoLoginService = kakaoLoginService ?? KakaoLoginService(),
        _naverLoginService = naverLoginService ?? NaverLoginService();

  /// provider별 SDK를 호출해 Access Token을 가져오는 내부 함수.
  Future<String?> _fetchSocialAccessToken(AuthProvider provider) {
    switch (provider) {
      case AuthProvider.kakao:
        return _kakaoLoginService.signIn();
      case AuthProvider.naver:
        return _naverLoginService.signIn();
      case AuthProvider.google:
        return _googleLoginService.signIn();
      case AuthProvider.local:
        throw ArgumentError('local은 간편로그인 제공자가 아닙니다.');
    }
  }

  /// 간편로그인을 현재 계정에 연결한다.
  /// 사용자가 SNS 로그인을 취소하면 false를 반환한다.
  Future<bool> link(AuthProvider provider) async {
    final accessToken = await _fetchSocialAccessToken(provider);
    if (accessToken == null) return false;

    await _apiService.post(
      '/users/me/social-accounts/${provider.name}',
      {'accessToken': accessToken},
      authorized: true,
    );
    return true;
  }

  /// 간편로그인 연결을 해지한다.
  Future<void> unlink(AuthProvider provider) async {
    await _apiService.delete('/users/me/social-accounts/${provider.name}', authorized: true);
  }
}
