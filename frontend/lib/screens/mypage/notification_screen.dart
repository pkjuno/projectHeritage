import 'package:flutter/material.dart';

import '../../models/notification_model.dart';
import '../../services/api_service.dart';
import '../../services/notification_service.dart';
import '../../utils/constants.dart';
import '../festival/festival_detail_screen.dart';

/// 알림함 화면.
/// 방문 하루 전 알림 등을 모아 보여주고, 누르면 해당 축제 상세로 이동한다.
class NotificationScreen extends StatefulWidget {
  const NotificationScreen({super.key});

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  final NotificationService _notificationService = NotificationService();

  List<NotificationModel> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// 알림 목록과 안 읽은 개수를 불러온다.
  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final result = await _notificationService.fetchMyNotifications();
      if (!mounted) return;
      setState(() {
        _notifications = result.items;
        _unreadCount = result.unreadCount;
      });
    } on ApiException catch (error) {
      _showMessage(error.statusCode == 401 ? AppStrings.loginRequired : error.message);
    } catch (_) {
      _showMessage(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// 전체 읽음 처리 후 목록을 갱신한다.
  Future<void> _markAllAsRead() async {
    try {
      await _notificationService.markAllAsRead();
      await _load();
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 알림을 눌렀을 때: 읽음 처리하고 연결된 축제가 있으면 상세로 이동한다.
  Future<void> _openNotification(NotificationModel notification) async {
    if (notification.isUnread) {
      try {
        await _notificationService.markAsRead(notification.id);
      } on ApiException {
        // 읽음 처리에 실패해도 화면 이동은 막지 않는다.
      }
    }

    if (!mounted) return;

    if (notification.festivalId != null) {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => FestivalDetailScreen(festivalId: notification.festivalId!),
        ),
      );
    }

    await _load();
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _unreadCount > 0
              ? '${AppStrings.notificationTitle} ($_unreadCount)'
              : AppStrings.notificationTitle,
        ),
        actions: [
          if (_unreadCount > 0)
            TextButton(
              onPressed: _markAllAsRead,
              child: const Text(AppStrings.markAllRead),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _notifications.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 120),
                        Center(
                          child: Text(
                            AppStrings.emptyNotification,
                            style: TextStyle(color: Colors.grey),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      itemCount: _notifications.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final notification = _notifications[index];

                        return ListTile(
                          // 안 읽은 알림은 점으로 구분한다.
                          leading: Icon(
                            notification.isUnread
                                ? Icons.notifications_active
                                : Icons.notifications_none,
                            color: notification.isUnread ? Colors.deepOrange : Colors.grey,
                          ),
                          title: Text(
                            notification.title,
                            style: TextStyle(
                              fontWeight:
                                  notification.isUnread ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                          subtitle: Text(notification.body),
                          trailing: notification.festivalId != null
                              ? const Icon(Icons.chevron_right)
                              : null,
                          onTap: () => _openNotification(notification),
                        );
                      },
                    ),
            ),
    );
  }
}
