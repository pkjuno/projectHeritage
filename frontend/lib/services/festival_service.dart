import '../models/festival_calendar_model.dart';
import '../models/festival_model.dart';
import '../models/nearby_model.dart';
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

  /// 축제 목록을 조회한다.
  ///
  /// 커뮤니티 후기 작성 화면에서 "어떤 축제 후기인지" 고르는 데 쓴다.
  /// 목록 API는 페이지네이션 응답이므로 items만 꺼내 돌려준다.
  Future<List<FestivalModel>> fetchFestivals({
    String? sidoCode,
    String? keyword,
    int page = 1,
    int limit = 20,
  }) async {
    final query = <String, String>{
      'page': '$page',
      'limit': '$limit',
      if (sidoCode != null && sidoCode.isNotEmpty) 'sidoCode': sidoCode,
      if (keyword != null && keyword.trim().isNotEmpty) 'keyword': keyword.trim(),
    };

    final data = await _apiService.get('/festivals?${Uri(queryParameters: query).query}');
    final items = (data as Map<String, dynamic>)['items'] as List<dynamic>;
    return items
        .map((item) => FestivalModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  /// 축제 상세 정보를 조회한다.
  /// 로그인 상태로 호출하면 위시리스트 담김 여부(isWishlisted)가 함께 내려온다.
  Future<FestivalModel> fetchDetail(int festivalId) async {
    final data = await _apiService.get('/festivals/$festivalId', authorized: true);
    return FestivalModel.fromJson(data as Map<String, dynamic>);
  }

  /// 홈 화면용 큐레이션(진행 중 / 이번 주말 / 곧 시작)을 조회한다.
  /// [sidoCode]를 주면 해당 지역으로 좁힌다.
  Future<CuratedFestivalsModel> fetchCurated({String? sidoCode, int limit = 10}) async {
    final query = <String>['limit=$limit'];
    if (sidoCode != null && sidoCode.isNotEmpty) query.add('sidoCode=$sidoCode');

    final data = await _apiService.get('/festivals/curated?${query.join('&')}');
    return CuratedFestivalsModel.fromJson(data as Map<String, dynamic>);
  }

  /// 좌표 기준 반경 안의 축제를 가까운 순으로 조회한다.
  /// [radiusKm]는 서버에서 최대 200km로 제한된다.
  Future<List<NearbyFestivalModel>> fetchNearby({
    required double latitude,
    required double longitude,
    int radiusKm = 20,
    int limit = 20,
  }) async {
    final data = await _apiService.get(
      '/festivals/nearby?lat=$latitude&lng=$longitude&radius=$radiusKm&limit=$limit',
    );

    final items = (data as Map<String, dynamic>)['items'] as List<dynamic>;
    return items
        .map((item) => NearbyFestivalModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  /// 특정 축제 주변의 문화재를 조회한다. (축제 갔다가 들를 곳 추천)
  Future<List<NearbyHeritageModel>> fetchNearbyHeritages(
    int festivalId, {
    int radiusKm = 10,
    int limit = 10,
  }) async {
    final data = await _apiService.get(
      '/festivals/$festivalId/nearby-heritages?radius=$radiusKm&limit=$limit',
    );

    final items = (data as Map<String, dynamic>)['items'] as List<dynamic>;
    return items
        .map((item) => NearbyHeritageModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  /// 지역 필터에 사용할 광역시도 목록을 조회한다.
  Future<List<SidoModel>> fetchSidos() async {
    final data = await _apiService.get('/sidos');
    return (data as List<dynamic>)
        .map((item) => SidoModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }
}
