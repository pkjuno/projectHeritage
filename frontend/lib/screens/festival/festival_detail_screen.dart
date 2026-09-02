import 'package:flutter/material.dart';

import '../../models/festival_model.dart';
import '../../services/api_service.dart';
import '../../services/festival_service.dart';
import '../../services/schedule_service.dart';
import '../../services/wishlist_service.dart';
import '../../utils/constants.dart';

/// 축제 상세 화면.
/// 상세 정보를 보여주고, 위시리스트에 담거나 방문 일정을 추가할 수 있다.
class FestivalDetailScreen extends StatefulWidget {
  final int festivalId;

  const FestivalDetailScreen({super.key, required this.festivalId});

  @override
  State<FestivalDetailScreen> createState() => _FestivalDetailScreenState();
}

class _FestivalDetailScreenState extends State<FestivalDetailScreen> {
  final FestivalService _festivalService = FestivalService();
  final WishlistService _wishlistService = WishlistService();
  final ScheduleService _scheduleService = ScheduleService();

  FestivalModel? _festival;
  bool _isLoading = true;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  /// 축제 상세 정보를 불러온다. (로그인 상태면 위시리스트 담김 여부도 함께 내려온다)
  Future<void> _loadDetail() async {
    setState(() => _isLoading = true);
    try {
      final festival = await _festivalService.fetchDetail(widget.festivalId);
      if (!mounted) return;
      setState(() => _festival = festival);
    } on ApiException catch (error) {
      _showMessage(error.message);
    } catch (_) {
      _showMessage(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// 위시리스트 담기/빼기를 토글한다.
  Future<void> _toggleWishlist() async {
    final festival = _festival;
    if (festival == null) return;

    setState(() => _isSubmitting = true);
    try {
      await _wishlistService.toggle(festival.id, festival.isWishlisted);
      if (!mounted) return;

      _showMessage(festival.isWishlisted ? '위시리스트에서 삭제했습니다.' : '위시리스트에 담았습니다.');
      await _loadDetail();
    } on ApiException catch (error) {
      // 로그인이 필요한 경우 서버가 401을 내려준다.
      _showMessage(error.statusCode == 401 ? AppStrings.loginRequired : error.message);
    } catch (_) {
      _showMessage(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// 방문 일정을 추가한다. 날짜 선택 범위를 축제 기간으로 제한한다.
  Future<void> _addSchedule() async {
    final festival = _festival;
    if (festival == null) return;

    // 축제가 이미 시작했다면 오늘 이후 날짜만 고르도록 초기값을 조정한다.
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final initialDate = today.isAfter(festival.startDate) && !today.isAfter(festival.endDate)
        ? today
        : festival.startDate;

    final visitDate = await showDatePicker(
      context: context,
      initialDate: initialDate,
      // 축제 기간 밖의 날짜는 아예 선택할 수 없게 한다. (서버에서도 동일하게 검증)
      firstDate: festival.startDate,
      lastDate: festival.endDate,
      helpText: AppStrings.pickVisitDate,
    );

    if (visitDate == null || !mounted) return;

    final memo = await _askMemo();
    if (!mounted) return;

    setState(() => _isSubmitting = true);
    try {
      await _scheduleService.create(
        festivalId: festival.id,
        visitDate: visitDate,
        memo: memo,
      );
      _showMessage('내 일정에 추가했습니다.');
    } on ApiException catch (error) {
      _showMessage(error.statusCode == 401 ? AppStrings.loginRequired : error.message);
    } catch (_) {
      _showMessage(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// 일정 메모를 입력받는 다이얼로그. 입력하지 않아도 등록할 수 있다.
  Future<String?> _askMemo() async {
    final controller = TextEditingController();

    final memo = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(AppStrings.scheduleMemoTitle),
        content: TextField(
          controller: controller,
          maxLength: 500,
          decoration: const InputDecoration(hintText: '예) 가족과 함께, 주차 확인 필요'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(''), child: const Text('건너뛰기')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text(AppStrings.saveButton),
          ),
        ],
      ),
    );

    controller.dispose();
    return memo;
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final festival = _festival;

    return Scaffold(
      appBar: AppBar(
        title: Text(festival?.name ?? AppStrings.festivalDetailTitle),
        actions: [
          if (festival != null)
            IconButton(
              icon: Icon(festival.isWishlisted ? Icons.favorite : Icons.favorite_border),
              color: festival.isWishlisted ? Colors.red : null,
              tooltip: AppStrings.wishlistTitle,
              onPressed: _isSubmitting ? null : _toggleWishlist,
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : festival == null
              ? Center(child: Text(AppStrings.errorMessage))
              : ListView(
                  padding: const EdgeInsets.all(AppSizes.paddingLarge),
                  children: [
                    Text(festival.name, style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: AppSizes.paddingMedium),
                    _buildInfoRow(Icons.calendar_today, '개최 기간', festival.periodLabel),
                    _buildInfoRow(Icons.place, '지역', festival.regionLabel),
                    _buildInfoRow(Icons.location_on_outlined, '개최 장소', festival.location),
                    _buildInfoRow(Icons.business, '주최', festival.hostOrganization),
                    _buildInfoRow(Icons.groups_outlined, '주관', festival.manageOrganization),
                    _buildInfoRow(Icons.star_outline, '축제 등급', festival.grade),
                    _buildInfoRow(Icons.link, '홈페이지', festival.homepageUrl),
                    if (festival.description != null && festival.description!.isNotEmpty) ...[
                      const Divider(height: AppSizes.paddingLarge * 2),
                      Text('축제 소개', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: AppSizes.paddingSmall),
                      Text(festival.description!),
                    ],
                  ],
                ),
      bottomNavigationBar: festival == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppSizes.paddingMedium),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _isSubmitting ? null : _toggleWishlist,
                        icon: Icon(festival.isWishlisted ? Icons.favorite : Icons.favorite_border),
                        label: Text(
                          festival.isWishlisted ? AppStrings.removeWishlist : AppStrings.addWishlist,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSizes.paddingSmall),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _isSubmitting ? null : _addSchedule,
                        icon: const Icon(Icons.event_available),
                        label: const Text(AppStrings.addSchedule),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  /// 아이콘 + 라벨 + 값 형태의 정보 한 줄. 값이 없으면 렌더링하지 않는다.
  Widget _buildInfoRow(IconData icon, String label, String? value) {
    if (value == null || value.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.paddingSmall),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: Colors.grey),
          const SizedBox(width: AppSizes.paddingSmall),
          SizedBox(width: 72, child: Text(label, style: const TextStyle(color: Colors.grey))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
