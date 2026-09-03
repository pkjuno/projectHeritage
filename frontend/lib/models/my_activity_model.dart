import 'author_model.dart';
import 'post_model.dart';

/// 내가 쓴 댓글 한 건. (내 활동 화면)
///
/// 일반 [CommentModel]과 구조가 다르다. 댓글만 보여주면 "무슨 글에 단 댓글인지"를
/// 알 수 없으므로 서버가 원글 정보를 함께 내려주기 때문이다.
class MyCommentModel {
  final int id;
  final int postId;
  final int? parentId;
  final String content;
  final int likeCount;
  final DateTime createdAt;

  /// 이 댓글이 달린 원글. 원글이 삭제된 댓글은 애초에 목록에 오지 않는다.
  ///
  /// 서버는 여기에 id/제목/게시판만 담아 보낸다. 작성일이나 조회수는 오지 않으므로
  /// PostModel이 아니라 가벼운 참조 모델을 쓴다.
  final PostRefModel post;

  const MyCommentModel({
    required this.id,
    required this.postId,
    required this.content,
    required this.createdAt,
    required this.post,
    this.parentId,
    this.likeCount = 0,
  });

  /// 대댓글인지 여부.
  bool get isReply => parentId != null;

  factory MyCommentModel.fromJson(Map<String, dynamic> json) {
    return MyCommentModel(
      id: json['id'] as int,
      postId: json['postId'] as int,
      parentId: json['parentId'] as int?,
      content: json['content'] as String,
      likeCount: json['likeCount'] as int? ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      post: PostRefModel.fromJson(json['post'] as Map<String, dynamic>),
    );
  }
}

/// 내가 반응을 남긴 글 한 건. (내 활동 화면)
class MyReactionModel {
  final int id;

  /// 내가 남긴 반응 종류. 화면에서 이모지를 그리는 데 쓴다.
  final String type;

  final DateTime createdAt;
  final PostModel post;

  const MyReactionModel({
    required this.id,
    required this.type,
    required this.createdAt,
    required this.post,
  });

  factory MyReactionModel.fromJson(Map<String, dynamic> json) {
    return MyReactionModel(
      id: json['id'] as int,
      type: json['type'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      post: PostModel.fromJson(json['post'] as Map<String, dynamic>),
    );
  }
}
