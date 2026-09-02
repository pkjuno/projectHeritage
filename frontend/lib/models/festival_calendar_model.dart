import '../utils/date_format.dart';
import 'festival_model.dart';

/// 월 단위 축제 캘린더 응답 모델.
///
/// 서버는 축제 목록을 한 번만 내려주고, 날짜별로는 축제 ID만 담은 인덱스(days)를 준다.
/// 한 달 내내 열리는 축제가 날짜마다 중복되어 내려오는 것을 막기 위한 구조다.
class FestivalCalendarModel {
  final int year;
  final int month;

  /// 축제 ID -> 축제 정보
  final Map<int, FestivalModel> festivalsById;

  /// 'YYYY-MM-DD' -> 그날 진행되는 축제 ID 목록
  final Map<String, List<int>> days;

  /// 해당 월의 축제가 너무 많아 일부만 내려온 경우 true. (지역/키워드 필터 유도)
  final bool truncated;

  const FestivalCalendarModel({
    required this.year,
    required this.month,
    required this.festivalsById,
    required this.days,
    this.truncated = false,
  });

  /// 비어 있는 캘린더. (조회 실패/초기 상태에서 사용)
  factory FestivalCalendarModel.empty(int year, int month) {
    return FestivalCalendarModel(year: year, month: month, festivalsById: const {}, days: const {});
  }

  /// 특정 날짜에 진행되는 축제 목록을 반환한다.
  /// table_calendar의 eventLoader에 그대로 연결해 날짜별 마커를 표시할 수 있다.
  List<FestivalModel> festivalsOn(DateTime date) {
    final ids = days[toDateKey(date)] ?? const [];
    return ids.map((id) => festivalsById[id]).whereType<FestivalModel>().toList();
  }

  /// 전체 축제 수
  int get totalCount => festivalsById.length;

  /// 백엔드 응답(JSON)을 [FestivalCalendarModel]로 변환한다.
  factory FestivalCalendarModel.fromJson(Map<String, dynamic> json) {
    final festivals = (json['festivals'] as List<dynamic>? ?? [])
        .map((item) => FestivalModel.fromJson(item as Map<String, dynamic>))
        .toList();

    final rawDays = json['days'] as Map<String, dynamic>? ?? {};

    return FestivalCalendarModel(
      year: json['year'] as int,
      month: json['month'] as int,
      festivalsById: {for (final festival in festivals) festival.id: festival},
      days: rawDays.map(
        (date, ids) => MapEntry(date, (ids as List<dynamic>).map((id) => id as int).toList()),
      ),
      truncated: json['truncated'] as bool? ?? false,
    );
  }
}
