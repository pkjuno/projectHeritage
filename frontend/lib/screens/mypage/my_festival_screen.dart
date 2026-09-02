import 'package:flutter/material.dart';

import '../../models/schedule_model.dart';
import '../../services/api_service.dart';
import '../../services/schedule_service.dart';
import '../../services/wishlist_service.dart';
import '../../utils/constants.dart';
import '../../utils/date_format.dart';
import '../festival/festival_detail_screen.dart';

/// 내가 찜한 축제(위시리스트)와 방문 일정을 탭으로 나눠 보여주는 화면.
class MyFestivalScreen extends StatefulWidget {
  /// 처음 보여줄 탭 (0: 위시리스트, 1: 내 일정)
  final int initialTabIndex;

  const MyFestivalScreen({super.key, this.initialTabIndex = 0});

  @override
  State<MyFestivalScreen> createState() => _MyFestivalScreenState();
}

class _MyFestivalScreenState extends State<MyFestivalScreen> {
  final WishlistService _wishlistService = WishlistService();
  final ScheduleService _scheduleService = ScheduleService();

  List<WishlistModel> _wishlists = [];
  List<ScheduleModel> _schedules = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  /// 위시리스트와 일정을 함께 불러온다.
  Future<void> _loadAll() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _wishlistService.fetchMyWishlists(),
        _scheduleService.fetchMySchedules(),
      ]);

      if (!mounted) return;
      setState(() {
        _wishlists = results[0] as List<WishlistModel>;
        _schedules = results[1] as List<ScheduleModel>;
      });
    } on ApiException catch (error) {
      _showMessage(error.statusCode == 401 ? AppStrings.loginRequired : error.message);
    } catch (_) {
      _showMessage(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// 위시리스트에서 축제를 제거한다.
  Future<void> _removeWishlist(int festivalId) async {
    try {
      await _wishlistService.remove(festivalId);
      _showMessage('위시리스트에서 삭제했습니다.');
      await _loadAll();
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 일정을 삭제한다. (확인 다이얼로그 표시)
  Future<void> _deleteSchedule(ScheduleModel schedule) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(AppStrings.deleteScheduleTitle),
        content: Text('${schedule.festival?.name ?? '이 축제'} 일정을 삭제하시겠습니까?'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('취소')),
          TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('삭제')),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _scheduleService.delete(schedule.id);
      _showMessage('일정을 삭제했습니다.');
      await _loadAll();
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 축제 상세로 이동한 뒤 돌아오면 목록을 갱신한다.
  Future<void> _goToDetail(int festivalId) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => FestivalDetailScreen(festivalId: festivalId)),
    );
    await _loadAll();
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      initialIndex: widget.initialTabIndex,
      child: Scaffold(
        appBar: AppBar(
          title: const Text(AppStrings.myFestivalTitle),
          bottom: const TabBar(
            tabs: [
              Tab(text: AppStrings.wishlistTitle),
              Tab(text: AppStrings.scheduleTitle),
            ],
          ),
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [_buildWishlistTab(), _buildScheduleTab()],
              ),
      ),
    );
  }

  /// 위시리스트 탭
  Widget _buildWishlistTab() {
    if (_wishlists.isEmpty) {
      return _buildEmpty(AppStrings.emptyWishlist);
    }

    return RefreshIndicator(
      onRefresh: _loadAll,
      child: ListView.separated(
        itemCount: _wishlists.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final festival = _wishlists[index].festival;
          final festivalId = _wishlists[index].festivalId;

          return ListTile(
            title: Text(festival?.name ?? '삭제된 축제'),
            subtitle: festival == null
                ? null
                : Text('${festival.regionLabel} · ${festival.periodLabel}'),
            trailing: IconButton(
              icon: const Icon(Icons.favorite, color: Colors.red),
              tooltip: AppStrings.removeWishlist,
              onPressed: () => _removeWishlist(festivalId),
            ),
            onTap: () => _goToDetail(festivalId),
          );
        },
      ),
    );
  }

  /// 내 일정 탭 (방문일 오름차순)
  Widget _buildScheduleTab() {
    if (_schedules.isEmpty) {
      return _buildEmpty(AppStrings.emptySchedule);
    }

    return RefreshIndicator(
      onRefresh: _loadAll,
      child: ListView.separated(
        itemCount: _schedules.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final schedule = _schedules[index];
          final dateLabel = toDisplayDate(schedule.visitDate);

          return ListTile(
            leading: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.event, size: 20),
                Text(dateLabel, style: const TextStyle(fontSize: 11)),
              ],
            ),
            title: Text(schedule.festival?.name ?? '삭제된 축제'),
            subtitle: Text(
              [schedule.festival?.location, schedule.memo]
                  .whereType<String>()
                  .where((value) => value.isNotEmpty)
                  .join(' · '),
            ),
            trailing: IconButton(
              icon: const Icon(Icons.delete_outline),
              tooltip: AppStrings.deleteScheduleTitle,
              onPressed: () => _deleteSchedule(schedule),
            ),
            onTap: () => _goToDetail(schedule.festivalId),
          );
        },
      ),
    );
  }

  /// 목록이 비어 있을 때 보여줄 안내. (당겨서 새로고침이 되도록 스크롤 가능하게 구성)
  Widget _buildEmpty(String message) {
    return RefreshIndicator(
      onRefresh: _loadAll,
      child: ListView(
        children: [
          const SizedBox(height: 120),
          Center(child: Text(message, style: const TextStyle(color: Colors.grey))),
        ],
      ),
    );
  }
}
