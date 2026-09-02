import '../models/festival_calendar_model.dart';
import '../models/festival_model.dart';
import '../models/sido_model.dart';
import 'api_service.dart';

/// 축제 조회(캘린더/상세)와 지역 목록을 담당하는 서비스.
class FestivalService {
  final ApiService _apiService;

  FestivalService({ApiService? apiService}) : _apiService = apiService ?? ApiService();

  /// 특정 연/월의 축제를 캘린더 형태로 조회한다.
  /// [sidoCode]를 주면 해당 지역 축제만 조회한다.
  /// 로그인 여부와 무관하게 조회할 수 있다.
  Future<FestivalCalendarModel> fetchCalendar({
    required int year,
    required int month,
    String? sidoCode,
    String? keyword,
  }) async {
    final query = <String, String>{'year': '$year', 'month': '$month'};
    if (sidoCode != null && sidoCode.isNotEmpty) query['sidoCode'] = sidoCode;
    if (keyword != null && keyword.isNotEmpty) query['keyword'] = keyword;

    final queryString = query.entries
        .map((e) => '${e.key}=${Uri.encodeQueryComponent(e.value)}')
        .join('&');

    final data = await _apiService.get('/festivals/calendar?$queryString');
    return FestivalCalendarModel.fromJson(data as Map<String, dynamic>);
  }

  /// 축제 상세 정보를 조회한다.
  /// 로그인 상태로 호출하면 위시리스트 담김 여부(isWishlisted)가 함께 내려온다.
  Future<FestivalModel> fetchDetail(int festivalId) async {
    final data = await _apiService.get('/festivals/$festivalId', authorized: true);
    return FestivalModel.fromJson(data as Map<String, dynamic>);
  }

  /// 지역 필터에 사용할 광역시도 목록을 조회한다.
  Future<List<SidoModel>> fetchSidos() async {
    final data = await _apiService.get('/sidos');
    return (data as List<dynamic>)
        .map((item) => SidoModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }
}
