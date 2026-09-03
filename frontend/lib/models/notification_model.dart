/// 알림 1건을 표현하는 모델.
class NotificationModel {
  final int id;

  /// 알림 종류.
  ///
  /// 축제: schedule_reminder(방문 하루 전), festival_start, notice
  /// 커뮤니티: post_comment(내 글에 댓글), comment_reply(내 댓글에 답글),
  ///          post_reaction(내 글이 받은 반응, 하루 한 번으로 묶임)
  final String type;

  final String title;
  final String body;

  /// 알림을 누르면 이동할 축제 ID (없을 수 있음)
  final int? festivalId;

  /// 알림을 누르면 이동할 게시글 ID. 커뮤니티 알림에만 담긴다.
  final int? postId;

  /// 확인 시각. null이면 안 읽은 알림이다.
  final DateTime? readAt;

  final DateTime? createdAt;

  const NotificationModel({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.festivalId,
    this.postId,
    this.readAt,
    this.createdAt,
  });

  /// 안 읽은 알림인지 여부
  bool get isUnread => readAt == null;

  /// 커뮤니티 활동 알림인지 여부.
  /// 이 값으로 축제 상세로 갈지 게시글 상세로 갈지 판단한다.
  bool get isCommunity => postId != null;

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] as int,
      type: json['type'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      festivalId: json['festivalId'] as int?,
      postId: json['postId'] as int?,
      readAt: json['readAt'] != null ? DateTime.tryParse(json['readAt'] as String) : null,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) : null,
    );
  }
}
