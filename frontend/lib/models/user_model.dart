import '../config/app_config.dart';
import 'social_account_model.dart';

/// 로그인 제공자 종류. local은 이메일/비밀번호 로그인을 의미한다.
enum AuthProvider { local, naver, kakao, google }

/// 문자열(백엔드 응답)을 [AuthProvider]로 변환한다.
AuthProvider authProviderFromString(String value) {
  return AuthProvider.values.firstWhere(
    (provider) => provider.name == value,
    orElse: () => AuthProvider.local,
  );
}

/// [AuthProvider]를 화면에 표시할 한글 이름으로 변환한다.
String authProviderLabel(AuthProvider provider) {
  switch (provider) {
    case AuthProvider.kakao:
      return '카카오';
    case AuthProvider.naver:
      return '네이버';
    case AuthProvider.google:
      return '구글';
    case AuthProvider.local:
      return '이메일';
  }
}

/// 회원 정보를 표현하는 데이터 모델 클래스.
class UserModel {
  final String id;
  final String email;
  final String name;

  /// 마이페이지에서 수정 가능한 닉네임
  final String? nickname;

  /// 프로필 이미지 경로 (예: /uploads/profiles/xxx.jpg). 미등록 시 null
  final String? profileImageUrl;

  /// 비밀번호 보유 여부. false면 간편로그인이 유일한 로그인 수단이다.
  final bool hasPassword;

  /// 회원 등급. 'user' 또는 'admin'.
  ///
  /// 이 값은 **화면에 운영자 메뉴를 보여줄지**만 판단한다.
  /// 실제 권한 검사는 서버가 매 요청마다 DB에서 다시 확인하므로,
  /// 이 값을 조작해도 운영자 기능이 실행되지는 않는다.
  final String role;

  /// 연결된 간편로그인 목록
  final List<SocialAccountModel> socialAccounts;

  const UserModel({
    required this.id,
    required this.email,
    required this.name,
    this.nickname,
    this.profileImageUrl,
    this.hasPassword = false,
    this.role = 'user',
    this.socialAccounts = const [],
  });

  /// 화면에 표시할 이름. 닉네임이 있으면 닉네임을, 없으면 이름을 사용한다.
  String get displayName => (nickname?.isNotEmpty ?? false) ? nickname! : name;

  /// 프로필 이미지의 전체 URL. 서버는 상대 경로만 내려주므로 서버 주소를 붙인다.
  String? get profileImageFullUrl {
    if (profileImageUrl == null || profileImageUrl!.isEmpty) return null;
    if (profileImageUrl!.startsWith('http')) return profileImageUrl;
    return '${AppConfig.serverBaseUrl}$profileImageUrl';
  }

  /// 운영자인지 여부.
  bool get isAdmin => role == 'admin';

  /// 해당 제공자가 이미 연결되어 있는지 확인한다.
  bool isLinked(AuthProvider provider) {
    return socialAccounts.any((account) => account.provider == provider);
  }

  /// 백엔드 API 응답(JSON)을 [UserModel] 객체로 변환한다.
  factory UserModel.fromJson(Map<String, dynamic> json) {
    final rawSocialAccounts = json['socialAccounts'] as List<dynamic>? ?? [];

    return UserModel(
      id: json['id'].toString(),
      email: json['email'] as String,
      name: json['name'] as String,
      nickname: json['nickname'] as String?,
      profileImageUrl: json['profileImageUrl'] as String?,
      hasPassword: json['hasPassword'] as bool? ?? false,
      role: json['role'] as String? ?? 'user',
      socialAccounts: rawSocialAccounts
          .map((item) => SocialAccountModel.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }
}
