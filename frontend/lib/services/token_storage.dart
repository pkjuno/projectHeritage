import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// JWT Access/Refresh Token을 기기의 보안 저장소(Keychain/Keystore)에 저장/조회/삭제하는 클래스.
/// SharedPreferences 대신 flutter_secure_storage를 사용해 평문 노출 위험을 줄인다.
class TokenStorage {
  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';

  final FlutterSecureStorage _storage;

  TokenStorage({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  /// Access Token과 Refresh Token을 함께 저장한다. (로그인/토큰 재발급 성공 시 호출)
  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  /// 저장된 Access Token을 조회한다. 없으면 null.
  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  /// 저장된 Refresh Token을 조회한다. 없으면 null.
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  /// Access Token만 갱신한다. (토큰 재발급 성공 시 호출)
  Future<void> updateAccessToken(String accessToken) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
  }

  /// 저장된 모든 토큰을 삭제한다. (로그아웃/회원탈퇴 시 호출)
  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
