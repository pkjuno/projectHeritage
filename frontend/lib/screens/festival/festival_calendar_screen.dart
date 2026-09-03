import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../models/festival_calendar_model.dart';
import '../../models/festival_model.dart';
import '../../models/sido_model.dart';
import '../../services/api_service.dart';
import '../../services/festival_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/constants.dart';
import 'festival_detail_screen.dart';

/// 지역별 축제를 월 단위 캘린더로 보여주는 화면.
/// 날짜를 선택하면 그날 진행되는 축제 목록이 아래에 표시되고, 항목을 누르면 상세로 이동한다.
class FestivalCalendarScreen extends StatefulWidget {
  const FestivalCalendarScreen({super.key});

  @override
  State<FestivalCalendarScreen> createState() => _FestivalCalendarScreenState();
}

class _FestivalCalendarScreenState extends State<FestivalCalendarScreen> {
  final FestivalService _festivalService = FestivalService();

  // 현재 캘린더가 보여주는 달과 선택된 날짜
  DateTime _focusedMonth = DateTime.now();
  DateTime? _selectedDay;

  FestivalCalendarModel? _calendar;
  List<SidoModel> _sidos = [];

  /// 선택된 지역 시도코드. null이면 전국.
  String? _selectedSidoCode;

  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _selectedDay = DateTime.now();
    _initialize();
  }

  /// 지역 목록과 이번 달 캘린더를 함께 불러온다.
  Future<void> _initialize() async {
    try {
      _sidos = await _festivalService.fetchSidos();
    } catch (_) {
      // 지역 목록 조회에 실패해도 캘린더는 전국 기준으로 계속 보여준다.
      _sidos = [];
    }
    await _loadCalendar();
  }

  /// 현재 보고 있는 달의 축제 캘린더를 불러온다.
  Future<void> _loadCalendar() async {
    setState(() => _isLoading = true);
    try {
      final calendar = await _festivalService.fetchCalendar(
        year: _focusedMonth.year,
        month: _focusedMonth.month,
        sidoCode: _selectedSidoCode,
      );
      if (!mounted) return;
      setState(() => _calendar = calendar);

      if (calendar.truncated) {
        _showMessage('이 달의 축제가 많아 일부만 표시됩니다. 지역을 선택해 좁혀 보세요.');
      }
    } on ApiException catch (error) {
      _showMessage(error.message);
    } catch (_) {
      _showMessage(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// 달을 이동했을 때 해당 월 데이터를 새로 조회한다.
  Future<void> _onPageChanged(DateTime focusedMonth) async {
    setState(() {
      _focusedMonth = focusedMonth;

      // 선택된 날짜가 이전 달에 남아 있으면 목록이 항상 비어 보이므로,
      // 새 달로 넘어갈 때 선택 날짜도 그 달 안으로 옮긴다.
      // (오늘이 포함된 달이면 오늘을, 아니면 그 달의 1일을 선택한다)
      final now = DateTime.now();
      final isCurrentMonth = focusedMonth.year == now.year && focusedMonth.month == now.month;
      _selectedDay = isCurrentMonth
          ? DateTime(now.year, now.month, now.day)
          : DateTime(focusedMonth.year, focusedMonth.month, 1);
    });

    await _loadCalendar();
  }

  /// 지역 필터를 변경하면 같은 달을 다시 조회한다.
  Future<void> _onSidoChanged(String? sidoCode) async {
    setState(() => _selectedSidoCode = sidoCode);
    await _loadCalendar();
  }

  /// 축제 상세 화면으로 이동한다. 돌아오면 위시리스트 상태 변경이 반영되도록 갱신한다.
  Future<void> _goToDetail(FestivalModel festival) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => FestivalDetailScreen(festivalId: festival.id)),
    );
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  /// 선택된 날짜에 진행 중인 축제 목록
  List<FestivalModel> get _festivalsOfSelectedDay {
    if (_calendar == null || _selectedDay == null) return [];
    return _calendar!.festivalsOn(_selectedDay!);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.festivalCalendarTitle)),
      body: Column(
        children: [
          _buildSidoFilter(),
          _buildCalendar(),
          const Divider(height: 1),
          Expanded(child: _buildSelectedDayList()),
        ],
      ),
    );
  }

  /// 지역(시도) 선택 드롭다운
  Widget _buildSidoFilter() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSizes.paddingMedium,
        vertical: AppSizes.paddingSmall,
      ),
      child: Row(
        children: [
          const Icon(Icons.place_outlined, size: 20),
          const SizedBox(width: AppSizes.paddingSmall),
          Expanded(
            child: DropdownButton<String?>(
              value: _selectedSidoCode,
              isExpanded: true,
              hint: const Text(AppStrings.allRegions),
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text(AppStrings.allRegions)),
                ..._sidos.map(
                  (sido) => DropdownMenuItem<String?>(value: sido.code, child: Text(sido.name)),
                ),
              ],
              onChanged: _isLoading ? null : _onSidoChanged,
            ),
          ),
        ],
      ),
    );
  }

  /// 월 단위 캘린더. 축제가 있는 날에는 마커가 표시된다.
  Widget _buildCalendar() {
    return TableCalendar<FestivalModel>(
      locale: 'ko_KR',
      firstDay: DateTime.utc(2000, 1, 1),
      lastDay: DateTime.utc(2100, 12, 31),
      focusedDay: _focusedMonth,
      selectedDayPredicate: (day) => _selectedDay != null && isSameDay(_selectedDay, day),
      // 날짜별 축제 목록을 넘겨주면 캘린더가 자동으로 마커를 그린다.
      eventLoader: (day) => _calendar?.festivalsOn(day) ?? [],
      calendarFormat: CalendarFormat.month,
      availableCalendarFormats: const {CalendarFormat.month: '월'},
      headerStyle: const HeaderStyle(formatButtonVisible: false, titleCentered: true),
      calendarStyle: const CalendarStyle(
        markerDecoration: BoxDecoration(color: AppColors.accent, shape: BoxShape.circle),
        // 한 날짜에 표시할 마커 최대 개수 (넘치면 마커가 겹쳐 보이는 것을 방지)
        markersMaxCount: 3,
      ),
      onDaySelected: (selectedDay, focusedDay) {
        setState(() {
          _selectedDay = selectedDay;
          _focusedMonth = focusedDay;
        });
      },
      onPageChanged: _onPageChanged,
    );
  }

  /// 선택한 날짜에 진행되는 축제 목록
  Widget _buildSelectedDayList() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    final festivals = _festivalsOfSelectedDay;

    if (festivals.isEmpty) {
      return const Center(child: Text(AppStrings.noFestivalOnDay));
    }

    return ListView.separated(
      itemCount: festivals.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final festival = festivals[index];
        return ListTile(
          title: Text(festival.name),
          subtitle: Text(
            [festival.regionLabel, festival.location, festival.periodLabel]
                .whereType<String>()
                .where((value) => value.isNotEmpty)
                .join(' · '),
          ),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => _goToDetail(festival),
        );
      },
    );
  }
}
