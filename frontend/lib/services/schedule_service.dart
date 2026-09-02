import '../models/schedule_model.dart';
import '../utils/date_format.dart';
import 'api_service.dart';

/// 내 축제 일정 API 통신을 담당하는 서비스.
class ScheduleService {
  final ApiService _apiService;

  ScheduleService({ApiService? apiService}) : _apiService = apiService ?? ApiService();

  /// 내 일정 목록을 조회한다. [from]~[to] 기간으로 좁힐 수 있다.
  Future<List<ScheduleModel>> fetchMySchedules({DateTime? from, DateTime? to}) async {
    final query = <String>[];
    if (from != null) query.add('from=${toDateKey(from)}');
    if (to != null) query.add('to=${toDateKey(to)}');

    final path = query.isEmpty ? '/users/me/schedules' : '/users/me/schedules?${query.join('&')}';
    final data = await _apiService.get(path, authorized: true);

    return (data as List<dynamic>)
        .map((item) => ScheduleModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  /// 축제 방문 일정을 등록한다.
  /// [visitDate]는 반드시 축제 개최 기간 안의 날짜여야 한다. (서버에서도 검증)
  Future<ScheduleModel> create({
    required int festivalId,
    required DateTime visitDate,
    String? memo,
  }) async {
    final data = await _apiService.post(
      '/users/me/schedules',
      {
        'festivalId': festivalId,
        'visitDate': toDateKey(visitDate),
        if (memo != null && memo.isNotEmpty) 'memo': memo,
      },
      authorized: true,
    );
    return ScheduleModel.fromJson(data as Map<String, dynamic>);
  }

  /// 일정의 방문일/메모를 수정한다.
  Future<ScheduleModel> update(int scheduleId, {DateTime? visitDate, String? memo}) async {
    final body = <String, dynamic>{};
    if (visitDate != null) body['visitDate'] = toDateKey(visitDate);
    if (memo != null) body['memo'] = memo;

    final data = await _apiService.patch('/users/me/schedules/$scheduleId', body, authorized: true);
    return ScheduleModel.fromJson(data as Map<String, dynamic>);
  }

  /// 일정을 삭제한다.
  Future<void> delete(int scheduleId) async {
    await _apiService.delete('/users/me/schedules/$scheduleId', authorized: true);
  }
}
