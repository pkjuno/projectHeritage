import 'user_model.dart';

/// 회원 계정에 연결된 간편로그인(SNS) 1건을 표현하는 모델.
class SocialAccountModel {
  final int id;
  final AuthProvider provider;

  /// SNS가 제공한 이메일 (동의하지 않았으면 null)
  final String? providerEmail;

  /// 연결한 시각
  final DateTime? linkedAt;

  const SocialAccountModel({
    required this.id,
    required this.provider,
    this.providerEmail,
    this.linkedAt,
  });

  /// 백엔드 응답(JSON)을 [SocialAccountModel]로 변환한다.
  factory SocialAccountModel.fromJson(Map<String, dynamic> json) {
    return SocialAccountModel(
      id: json['id'] as int,
      provider: authProviderFromString(json['provider'] as String),
      providerEmail: json['providerEmail'] as String?,
      linkedAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) : null,
    );
  }
}
