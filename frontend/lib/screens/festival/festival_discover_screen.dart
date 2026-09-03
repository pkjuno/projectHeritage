import 'package:flutter/material.dart';

import '../../models/festival_model.dart';
import '../../models/nearby_model.dart';
import '../../services/api_service.dart';
import '../../services/festival_service.dart';
import '../../services/location_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/constants.dart';
import 'festival_detail_screen.dart';

/// 축제 둘러보기 화면.
///
/// 캘린더가 "날짜를 알고 찾는" 화면이라면, 여기는 "지금/이번 주말에 갈 만한 것"을
/// 시간과 거리 기준으로 찾는 화면이다.
class FestivalDiscoverScreen extends StatefulWidget {
  const FestivalDiscoverScreen({super.key});

  @override
  State<FestivalDiscoverScreen> createState() => _FestivalDiscoverScreenState();
}

class _FestivalDiscoverScreenState extends State<FestivalDiscoverScreen> {
  final FestivalService _festivalService = FestivalService();
  final LocationService _locationService = LocationService();

  CuratedFestivalsModel? _curated;
  List<NearbyFestivalModel> _nearby = [];
  bool _isLoading = true;
  bool _isLoadingNearby = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// 큐레이션 목록을 불러온다.
  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final curated = await _festivalService.fetchCurated();
      if (!mounted) return;
      setState(() => _curated = curated);
    } on ApiException catch (error) {
      _showMessage(error.message);
    } catch (_) {
      _showMessage(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// 현재 위치를 받아 주변 축제를 불러온다.
  /// 위치 권한이 없거나 거부된 경우에는 그 이유를 안내한다.
  Future<void> _loadNearby() async {
    setState(() => _isLoadingNearby = true);
    try {
      final position = await _locationService.getCurrentPosition();

      final nearby = await _festivalService.fetchNearby(
        latitude: position.latitude,
        longitude: position.longitude,
      );

      if (!mounted) return;
      setState(() => _nearby = nearby);

      if (nearby.isEmpty) {
        _showMessage(AppStrings.emptyNearby);
      }
    } on LocationUnavailableException catch (error) {
      _showMessage(error.message);
    } on ApiException catch (error) {
      _showMessage(error.message);
    } catch (_) {
      _showMessage(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isLoadingNearby = false);
    }
  }

  /// 축제 상세로 이동한다.
  Future<void> _goToDetail(int festivalId) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => FestivalDetailScreen(festivalId: festivalId)),
    );
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final curated = _curated;

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.discoverTitle)),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: AppSizes.paddingMedium),
                children: [
                  if (curated == null || curated.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(AppSizes.paddingLarge),
                      child: Center(
                        child: Text(
                          AppStrings.emptyDiscover,
                          style: TextStyle(color: AppColors.inkMuted),
                        ),
                      ),
                    )
                  else ...[
                    _buildSection(AppStrings.ongoingSection, curated.ongoing),
                    _buildSection(AppStrings.weekendSection, curated.weekend),
                    _buildSection(AppStrings.upcomingSection, curated.upcoming),
                  ],
                  _buildNearbySection(),
                ],
              ),
            ),
    );
  }

  /// 큐레이션 한 묶음(가로 스크롤 카드 목록). 비어 있으면 렌더링하지 않는다.
  Widget _buildSection(String title, List<FestivalModel> festivals) {
    if (festivals.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.paddingLarge,
            AppSizes.paddingMedium,
            AppSizes.paddingLarge,
            AppSizes.paddingSmall,
          ),
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        SizedBox(
          height: 132,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSizes.paddingLarge),
            itemCount: festivals.length,
            separatorBuilder: (_, __) => const SizedBox(width: AppSizes.paddingSmall),
            itemBuilder: (context, index) => _buildCard(festivals[index]),
          ),
        ),
      ],
    );
  }

  /// 축제 카드 1장
  Widget _buildCard(FestivalModel festival) {
    return InkWell(
      onTap: () => _goToDetail(festival.id),
      child: Container(
        width: 200,
        padding: const EdgeInsets.all(AppSizes.paddingMedium),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.line),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              festival.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: AppSizes.paddingSmall),
            Text(festival.periodLabel, style: const TextStyle(fontSize: 12)),
            const Spacer(),
            Text(
              festival.regionLabel,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, color: AppColors.inkMuted),
            ),
          ],
        ),
      ),
    );
  }

  /// 내 주변 축제 목록 (거리 표시).
  /// 위치 권한이 필요하므로 사용자가 버튼을 눌렀을 때만 조회한다.
  Widget _buildNearbySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.paddingLarge,
            AppSizes.paddingLarge,
            AppSizes.paddingLarge,
            AppSizes.paddingSmall,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(AppStrings.nearbySection, style: Theme.of(context).textTheme.titleMedium),
              TextButton.icon(
                onPressed: _isLoadingNearby ? null : _loadNearby,
                icon: _isLoadingNearby
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location, size: 18),
                label: const Text(AppStrings.findNearby),
              ),
            ],
          ),
        ),
        ..._nearby.map(
          (nearby) => ListTile(
            leading: const Icon(Icons.place_outlined),
            title: Text(nearby.festival.name),
            subtitle: Text('${nearby.festival.regionLabel} · ${nearby.festival.periodLabel}'),
            trailing: Text(nearby.distanceLabel, style: const TextStyle(fontSize: 12)),
            onTap: () => _goToDetail(nearby.festival.id),
          ),
        ),
      ],
    );
  }
}
