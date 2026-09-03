import 'author_model.dart';

/// 신고 사유. 서버의 ENUM과 값·순서가 같아야 한다.
enum ReportReason {
  spam('spam', '광고 / 스팸'),
  abuse('abuse', '욕설 / 비방'),
  adult('adult', '음란물'),
  commercial('commercial', '상업적 홍보'),
  etc('etc', '기타');

  const ReportReason(this.code, this.label);

  /// 서버에 보내는 값
  final String code;

  /// 화면에 보여줄 이름
  final String label;

  /// '기타'는 설명을 반드시 받아야 한다.
  /// 설명 없는 '기타' 신고는 운영자가 무엇을 봐야 할지 알 수 없다.
  bool get requiresDetail => this == ReportReason.etc;
}

/// 신고 1건. (운영자 처리 화면)
class ReportModel {
  final int id;

  /// 'post' 또는 'comment'
  final String targetType;

  final String reason;
  final String? detail;
  final String status;
  final DateTime createdAt;

  /// 신고한 회원. 탈퇴했으면 null.
  final AuthorModel? reporter;

  /// 신고된 게시글 (targetType이 'post'일 때)
  final ReportedPostModel? post;

  /// 신고된 댓글 (targetType이 'comment'일 때)
  final ReportedCommentModel? comment;

  const ReportModel({
    required this.id,
    required this.targetType,
    required this.reason,
    required this.status,
    required this.createdAt,
    this.detail,
    this.reporter,
    this.post,
    this.comment,
  });

  /// 게시글 신고인지 여부.
  bool get isPost => targetType == 'post';

  /// 화면에 보여줄 사유 이름.
  String get reasonLabel {
    for (final value in ReportReason.values) {
      if (value.code == reason) return value.label;
    }
    return reason;
  }

  /// 신고 대상의 내용을 한 줄로. 운영자가 목록에서 바로 판단할 수 있어야 한다.
  String get targetSummary =>
      isPost ? (post?.title ?? '(삭제된 글)') : (comment?.content ?? '(삭제된 댓글)');

  factory ReportModel.fromJson(Map<String, dynamic> json) {
    return ReportModel(
      id: json['id'] as int,
      targetType: json['targetType'] as String,
      reason: json['reason'] as String,
      detail: json['detail'] as String?,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      reporter: json['reporter'] != null
          ? AuthorModel.fromJson(json['reporter'] as Map<String, dynamic>)
          : null,
      post: json['post'] != null
          ? ReportedPostModel.fromJson(json['post'] as Map<String, dynamic>)
          : null,
      comment: json['comment'] != null
          ? ReportedCommentModel.fromJson(json['comment'] as Map<String, dynamic>)
          : null,
    );
  }
}

/// 신고된 게시글의 최소 정보.
class ReportedPostModel {
  final int id;
  final String title;
  final String status;

  const ReportedPostModel({required this.id, required this.title, required this.status});

  /// 이미 숨김 처리된 글인지 여부. 운영자가 중복 조치하지 않도록 표시한다.
  bool get isHidden => status == 'hidden';

  factory ReportedPostModel.fromJson(Map<String, dynamic> json) {
    return ReportedPostModel(
      id: json['id'] as int,
      title: json['title'] as String,
      status: json['status'] as String? ?? 'published',
    );
  }
}

/// 신고된 댓글의 최소 정보.
class ReportedCommentModel {
  final int id;
  final int postId;
  final String content;
  final String status;

  const ReportedCommentModel({
    required this.id,
    required this.postId,
    required this.content,
    required this.status,
  });

  bool get isDeleted => status == 'deleted';

  factory ReportedCommentModel.fromJson(Map<String, dynamic> json) {
    return ReportedCommentModel(
      id: json['id'] as int,
      postId: json['postId'] as int,
      content: json['content'] as String,
      status: json['status'] as String? ?? 'published',
    );
  }
}

/// 내가 차단한 회원 1건.
class BlockedUserModel {
  final int id;
  final AuthorModel blockedUser;
  final DateTime createdAt;

  const BlockedUserModel({
    required this.id,
    required this.blockedUser,
    required this.createdAt,
  });

  factory BlockedUserModel.fromJson(Map<String, dynamic> json) {
    return BlockedUserModel(
      id: json['id'] as int,
      blockedUser: AuthorModel.fromJson(json['blockedUser'] as Map<String, dynamic>),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
