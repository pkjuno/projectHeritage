import '../models/user_model.dart';
import 'api_service.dart';
import 'social/google_login_service.dart';
import 'social/kakao_login_service.dart';
import 'social/naver_login_service.dart';
import 'token_storage.dart';

/// 회원(인증) 도메인 서비스.
/// 회원가입/로그인/로그아웃/회원탈퇴/SNS 간편로그인/토큰 재발급을 담당한다.
class AuthService {
  final ApiService _apiService;
  final TokenStorage _tokenStorage;
  final GoogleLoginService _googleLoginService;
  final KakaoLoginService _kakaoLoginService;
  final NaverLoginService _naverLoginService;

  AuthService({
    ApiService? apiService,
    TokenStorage? tokenStorage,
    GoogleLoginService? googleLoginService,
    KakaoLoginService? kakaoLoginService,
    NaverLoginService? naverLoginService,
  })  : _apiService = apiService ?? ApiService(),
        _tokenStorage = tokenStorage ?? TokenStorage(),
        _googleLoginService = googleLoginService ?? GoogleLoginService(),
        _kakaoLoginService = kakaoLoginService ?? KakaoLoginService(),
        _naverLoginService = naverLoginService ?? NaverLoginService();

  /// 일반 회원가입.
  Future<void> signup({required String email, required String password, required String name}) async {
    await _apiService.post('/auth/signup', {
      'email': email,
      'password': password,
      'name': name,
    });
  }

  /// 일반(이메일/비밀번호) 로그인. 성공 시 토큰을 보안 저장소에 저장한다.
  Future<UserModel> login({required String email, required String password}) async {
    final data = await _apiService.post('/auth/login', {'email': email, 'password': password});
    return _handleAuthResult(data as Map<String, dynamic>);
  }

  /// SNS 간편로그인. [provider]에 맞는 SDK로 먼저 로그인한 뒤,
  /// 발급받은 Access Token을 백엔드로 전달해 자체 로그인(JWT 발급)을 완료한다.
  /// 사용자가 SNS 로그인을 취소하면 null을 반환한다.
  Future<UserModel?> socialLogin(AuthProvider provider) async {
    final providerAccessToken = await _fetchSocialAccessToken(provider);
    if (providerAccessToken == null) return null;

    final data = await _apiService.post('/auth/social/${provider.name}', {
      'accessToken': providerAccessToken,
    });
    return _handleAuthResult(data as Map<String, dynamic>);
  }

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
        throw ArgumentError('local은 SNS 로그인 provider가 아닙니다.');
    }
  }

  /// 로그인/간편로그인 응답(JSON)에서 토큰을 저장하고 사용자 정보를 반환하는 공통 처리 함수.
  Future<UserModel> _handleAuthResult(Map<String, dynamic> data) async {
    final accessToken = data['accessToken'] as String;
    final refreshToken = data['refreshToken'] as String;
    await _tokenStorage.saveTokens(accessToken: accessToken, refreshToken: refreshToken);
    return UserModel.fromJson(data['user'] as Map<String, dynamic>);
  }

  /// 저장된 Refresh Token으로 Access Token을 재발급받아 갱신한다.
  Future<void> refreshAccessToken() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken == null) {
      throw StateError('저장된 refreshToken이 없습니다. 다시 로그인해야 합니다.');
    }

    final data = await _apiService.post('/auth/refresh', {'refreshToken': refreshToken});
    await _tokenStorage.updateAccessToken((data as Map<String, dynamic>)['accessToken'] as String);
  }

  /// 로그아웃 처리. 서버의 Refresh Token을 무효화하고 로컬 토큰을 삭제한다.
  Future<void> logout() async {
    await _apiService.post('/auth/logout', {}, authorized: true);
    await _tokenStorage.clear();
  }

  /// 회원 탈퇴 처리. 서버에 탈퇴를 요청하고 로컬 토큰을 삭제한다.
  Future<void> withdraw() async {
    await _apiService.delete('/auth/withdraw', authorized: true);
    await _tokenStorage.clear();
  }

  /// 로그인 여부(Access Token 보유 여부)를 확인한다. 스플래시 화면의 자동 로그인 분기에 사용한다.
  Future<bool> isLoggedIn() async {
    final accessToken = await _tokenStorage.readAccessToken();
    return accessToken != null;
  }
}
