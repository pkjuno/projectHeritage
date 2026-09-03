import '../config/app_config.dart';

/// 게시글/댓글 작성자의 공개 프로필.
///
/// [UserModel]과 일부러 분리했다. UserModel은 **로그인한 나 자신**을 표현하는 모델이라
/// 이메일과 간편로그인 연결 목록을 필수로 가진다.
///
/// 반면 게시판의 작성자는 남에게 보이는 정보라 서버가 id/이름/닉네임/프로필 이미지만 내려준다.
/// 게시판에 회원 이메일을 노출할 이유가 없기 때문이다.
///
/// 둘을 같은 모델로 쓰면 목록을 여는 순간 이메일이 없어서 앱이 죽는다.
/// (실제로 백엔드 응답을 그대로 넣어보는 계약 테스트에서 이 문제가 잡혔다)
class AuthorModel {
  final int id;
  final String name;
  final String? nickname;
  final String? profileImageUrl;

  const AuthorModel({
    required this.id,
    required this.name,
    this.nickname,
    this.profileImageUrl,
  });

  /// 화면에 표시할 이름. 닉네임이 있으면 닉네임을, 없으면 이름을 쓴다.
  String get displayName =>
      (nickname != null && nickname!.isNotEmpty) ? nickname! : name;

  /// 프로필 이미지의 전체 URL.
  /// 서버는 '/uploads/...' 같은 상대 경로를 주므로 서버 주소를 붙여준다.
  String? get profileImageFullUrl {
    if (profileImageUrl == null || profileImageUrl!.isEmpty) return null;
    if (profileImageUrl!.startsWith('http')) return profileImageUrl;
    return '${AppConfig.serverBaseUrl}$profileImageUrl';
  }

  factory AuthorModel.fromJson(Map<String, dynamic> json) {
    return AuthorModel(
      id: json['id'] as int,
      name: json['name'] as String,
      nickname: json['nickname'] as String?,
      profileImageUrl: json['profileImageUrl'] as String?,
    );
  }
}

/// 다른 화면에서 참조하는 "게시글 요약".
///
/// 내 댓글 목록의 원글처럼 id/제목/게시판만 담겨 오는 응답을 위한 모델이다.
/// [PostModel]은 작성일과 각종 카운터를 필수로 가지는데, 이런 응답에는 그 값이 없다.
class PostRefModel {
  final int id;
  final String title;

  /// 게시판 이름. 응답에 따라 없을 수 있다.
  final String? categoryName;

  const PostRefModel({required this.id, required this.title, this.categoryName});

  factory PostRefModel.fromJson(Map<String, dynamic> json) {
    final category = json['category'] as Map<String, dynamic>?;

    return PostRefModel(
      id: json['id'] as int,
      title: json['title'] as String,
      categoryName: category?['name'] as String?,
    );
  }
}
