import '../utils/date_format.dart';
import 'sido_model.dart';

/// 지역축제 정보를 표현하는 데이터 모델.
class FestivalModel {
  final int id;
  final String name;
  final SidoModel? sido;
  final String? sigungu;
  final String? location;
  final DateTime startDate;
  final DateTime endDate;
  final String? hostOrganization;
  final String? manageOrganization;
  final String? grade;
  final String? homepageUrl;
  final double? latitude;
  final double? longitude;
  final String? description;

  /// 내가 위시리스트에 담았는지 여부. 상세 조회 응답에만 담긴다.
  final bool isWishlisted;

  const FestivalModel({
    required this.id,
    required this.name,
    required this.startDate,
    required this.endDate,
    this.sido,
    this.sigungu,
    this.location,
    this.hostOrganization,
    this.manageOrganization,
    this.grade,
    this.homepageUrl,
    this.latitude,
    this.longitude,
    this.description,
    this.isWishlisted = false,
  });

  /// "2026.11.05 ~ 2026.11.07" 형태의 개최 기간 문자열.
  String get periodLabel => startDate == endDate
      ? toDisplayDate(startDate)
      : '${toDisplayDate(startDate)} ~ ${toDisplayDate(endDate)}';

  /// "서울특별시 종로구" 형태의 지역 표시 문자열.
  String get regionLabel => [sido?.name, sigungu]
      .whereType<String>()
      .where((value) => value.isNotEmpty)
      .join(' ');

  /// 백엔드 응답(JSON)을 [FestivalModel]로 변환한다.
  factory FestivalModel.fromJson(Map<String, dynamic> json) {
    return FestivalModel(
      id: json['id'] as int,
      name: json['name'] as String,
      sido: json['sido'] != null ? SidoModel.fromJson(json['sido'] as Map<String, dynamic>) : null,
      sigungu: json['sigungu'] as String?,
      location: json['location'] as String?,
      startDate: DateTime.parse(json['startDate'] as String),
      endDate: DateTime.parse(json['endDate'] as String),
      hostOrganization: json['hostOrganization'] as String?,
      manageOrganization: json['manageOrganization'] as String?,
      grade: json['grade'] as String?,
      homepageUrl: json['homepageUrl'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      description: json['description'] as String?,
      isWishlisted: json['isWishlisted'] as bool? ?? false,
    );
  }
}
