import 'author_model.dart';

/// 게시글 댓글.
///
/// 대댓글은 [replies]에 담겨 부모 댓글 안에 묶여 온다.
/// 깊이는 1단계까지만 존재한다. (서버가 답글의 답글도 최상위 댓글에 붙인다)
class CommentModel {
  final int id;
  final int postId;

  /// 최상위 댓글이면 null.
  final int? parentId;

  /// 본문. 삭제된 댓글이면 서버가 "삭제된 댓글입니다."로 바꿔서 내려준다.
  final String content;

  /// published / deleted
  final String status;

  final int likeCount;

  /// 작성자. 삭제된 댓글은 서버가 null로 가려서 내려준다.
  /// (내용만 가리고 이름을 남기면 누가 무엇을 지웠는지가 드러나기 때문)
  final AuthorModel? author;

  final bool isMine;
  final bool isLiked;
  final DateTime createdAt;

  /// 이 댓글에 달린 답글 목록. 답글 자신은 항상 빈 목록이다.
  final List<CommentModel> replies;

  const CommentModel({
    required this.id,
    required this.postId,
    required this.content,
    required this.createdAt,
    this.parentId,
    this.status = 'published',
    this.likeCount = 0,
    this.author,
    this.isMine = false,
    this.isLiked = false,
    this.replies = const [],
  });

  /// 삭제되어 자리만 남은 댓글인지 여부.
  /// 이 경우 수정/삭제/좋아요 버튼을 모두 숨겨야 한다.
  bool get isDeleted => status == 'deleted';

  /// 대댓글인지 여부. (화면에서 들여쓰기 판단에 쓴다)
  bool get isReply => parentId != null;

  /// 작성자 표시 이름.
  String get authorLabel => author?.displayName ?? '알 수 없음';

  factory CommentModel.fromJson(Map<String, dynamic> json) {
    final rawReplies = json['replies'] as List<dynamic>? ?? [];

    return CommentModel(
      id: json['id'] as int,
      postId: json['postId'] as int,
      parentId: json['parentId'] as int?,
      content: json['content'] as String,
      status: json['status'] as String? ?? 'published',
      likeCount: json['likeCount'] as int? ?? 0,
      author: json['author'] != null
          ? AuthorModel.fromJson(json['author'] as Map<String, dynamic>)
          : null,
      isMine: json['isMine'] as bool? ?? false,
      isLiked: json['isLiked'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      replies: rawReplies
          .map((reply) => CommentModel.fromJson(reply as Map<String, dynamic>))
          .toList(),
    );
  }
}
