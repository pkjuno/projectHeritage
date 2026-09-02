import '../models/notification_model.dart';
import 'api_service.dart';

/// 알림함과 푸시 설정 API 통신을 담당하는 서비스.
class NotificationService {
  final ApiService _apiService;

  NotificationService({ApiService? apiService}) : _apiService = apiService ?? ApiService();

  /// 내 알림 목록과 안 읽은 개수를 조회한다.
  Future<({List<NotificationModel> items, int unreadCount})> fetchMyNotifications({
    int page = 1,
    int limit = 20,
  }) async {
    final data = await _apiService.get(
      '/users/me/notifications?page=$page&limit=$limit',
      authorized: true,
    );

    final map = data as Map<String, dynamic>;
    final items = (map['items'] as List<dynamic>)
        .map((item) => NotificationModel.fromJson(item as Map<String, dynamic>))
        .toList();

    return (items: items, unreadCount: map['unreadCount'] as int? ?? 0);
  }

  /// 알림 1건을 읽음 처리한다.
  Future<void> markAsRead(int notificationId) async {
    await _apiService.patch('/users/me/notifications/$notificationId/read', {}, authorized: true);
  }

  /// 안 읽은 알림을 모두 읽음 처리한다.
  Future<void> markAllAsRead() async {
    await _apiService.patch('/users/me/notifications/read-all', {}, authorized: true);
  }

  /// 푸시 수신 설정과 기기 토큰을 저장한다.
  /// 로그아웃 시에는 [pushToken]에 null을 보내 기기 토큰을 지운다.
  Future<void> updatePushSettings({bool? pushEnabled, String? pushToken, bool clearToken = false}) async {
    final body = <String, dynamic>{};
    if (pushEnabled != null) body['pushEnabled'] = pushEnabled;
    if (clearToken) {
      body['pushToken'] = null;
    } else if (pushToken != null) {
      body['pushToken'] = pushToken;
    }

    await _apiService.put('/users/me/push-settings', body, authorized: true);
  }
}
