/// 알림 1건을 표현하는 모델.
class NotificationModel {
  final int id;

  /// 알림 종류 (schedule_reminder: 방문 하루 전 알림)
  final String type;

  final String title;
  final String body;

  /// 알림을 누르면 이동할 축제 ID (없을 수 있음)
  final int? festivalId;

  /// 확인 시각. null이면 안 읽은 알림이다.
  final DateTime? readAt;

  final DateTime? createdAt;

  const NotificationModel({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.festivalId,
    this.readAt,
    this.createdAt,
  });

  /// 안 읽은 알림인지 여부
  bool get isUnread => readAt == null;

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] as int,
      type: json['type'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      festivalId: json['festivalId'] as int?,
      readAt: json['readAt'] != null ? DateTime.tryParse(json['readAt'] as String) : null,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) : null,
    );
  }
}
