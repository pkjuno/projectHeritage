/// 로그인 제공자(가입 경로) 종류.
enum AuthProvider { local, naver, kakao, google }

/// 문자열(백엔드 응답)을 [AuthProvider]로 변환한다.
AuthProvider authProviderFromString(String value) {
  return AuthProvider.values.firstWhere(
    (provider) => provider.name == value,
    orElse: () => AuthProvider.local,
  );
}

/// 사용자 정보를 표현하는 데이터 모델 클래스.
class UserModel {
  final String id;
  final String email;
  final String name;
  final AuthProvider provider;

  const UserModel({
    required this.id,
    required this.email,
    required this.name,
    required this.provider,
  });

  /// 백엔드 API 응답(JSON)을 [UserModel] 객체로 변환한다.
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'].toString(),
      email: json['email'] as String,
      name: json['name'] as String,
      provider: authProviderFromString(json['provider'] as String),
    );
  }
}
