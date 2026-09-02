import 'festival_model.dart';

/// 내 축제 방문 일정 모델.
/// 위시리스트(찜)와 달리 방문 날짜가 정해진 개인 계획이다.
class ScheduleModel {
  final int id;
  final int festivalId;

  /// 방문 예정일 (축제 개최 기간 안의 날짜)
  final DateTime visitDate;

  /// 개인 메모 (동행자, 준비물 등)
  final String? memo;

  /// 함께 조회된 축제 정보
  final FestivalModel? festival;

  const ScheduleModel({
    required this.id,
    required this.festivalId,
    required this.visitDate,
    this.memo,
    this.festival,
  });

  factory ScheduleModel.fromJson(Map<String, dynamic> json) {
    return ScheduleModel(
      id: json['id'] as int,
      festivalId: json['festivalId'] as int,
      visitDate: DateTime.parse(json['visitDate'] as String),
      memo: json['memo'] as String?,
      festival: json['festival'] != null
          ? FestivalModel.fromJson(json['festival'] as Map<String, dynamic>)
          : null,
    );
  }
}

/// 위시리스트 1건을 표현하는 모델.
class WishlistModel {
  final int id;
  final int festivalId;
  final FestivalModel? festival;

  const WishlistModel({required this.id, required this.festivalId, this.festival});

  factory WishlistModel.fromJson(Map<String, dynamic> json) {
    return WishlistModel(
      id: json['id'] as int,
      festivalId: json['festivalId'] as int,
      festival: json['festival'] != null
          ? FestivalModel.fromJson(json['festival'] as Map<String, dynamic>)
          : null,
    );
  }
}
