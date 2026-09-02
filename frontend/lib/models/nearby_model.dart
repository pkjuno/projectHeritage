import 'festival_model.dart';

/// 거리 정보가 붙은 축제. "내 주변" 목록에서 사용한다.
class NearbyFestivalModel {
  final FestivalModel festival;

  /// 기준 좌표로부터의 거리 (km)
  final double distanceKm;

  const NearbyFestivalModel({required this.festival, required this.distanceKm});

  /// 화면에 표시할 거리 문자열. 1km 미만은 m 단위로 보여준다.
  String get distanceLabel =>
      distanceKm < 1 ? '${(distanceKm * 1000).round()}m' : '${distanceKm.toStringAsFixed(1)}km';

  /// 서버 응답은 축제 필드와 distanceKm이 같은 객체에 담겨 온다.
  factory NearbyFestivalModel.fromJson(Map<String, dynamic> json) {
    return NearbyFestivalModel(
      festival: FestivalModel.fromJson(json),
      // DECIMAL 계산 결과라 문자열로 올 수 있으므로 안전하게 변환한다.
      distanceKm: double.tryParse('${json['distanceKm']}') ?? 0,
    );
  }
}

/// 거리 정보가 붙은 문화재.
class NearbyHeritageModel {
  final int id;
  final String name;
  final String? address;
  final String? imageUrl;
  final double distanceKm;

  const NearbyHeritageModel({
    required this.id,
    required this.name,
    required this.distanceKm,
    this.address,
    this.imageUrl,
  });

  String get distanceLabel =>
      distanceKm < 1 ? '${(distanceKm * 1000).round()}m' : '${distanceKm.toStringAsFixed(1)}km';

  factory NearbyHeritageModel.fromJson(Map<String, dynamic> json) {
    return NearbyHeritageModel(
      id: json['id'] as int,
      name: json['name'] as String,
      address: json['address'] as String?,
      imageUrl: json['imageUrl'] as String?,
      distanceKm: double.tryParse('${json['distanceKm']}') ?? 0,
    );
  }
}

/// 홈 화면 큐레이션 결과. 시간 기준으로 나뉜 세 묶음을 담는다.
class CuratedFestivalsModel {
  /// 지금 진행 중인 축제
  final List<FestivalModel> ongoing;

  /// 이번 주말(토~일)에 열리는 축제
  final List<FestivalModel> weekend;

  /// 아직 시작하지 않은, 곧 시작할 축제
  final List<FestivalModel> upcoming;

  const CuratedFestivalsModel({
    required this.ongoing,
    required this.weekend,
    required this.upcoming,
  });

  /// 세 묶음이 모두 비어 있는지 (보여줄 축제가 없는 상태)
  bool get isEmpty => ongoing.isEmpty && weekend.isEmpty && upcoming.isEmpty;

  factory CuratedFestivalsModel.fromJson(Map<String, dynamic> json) {
    List<FestivalModel> parse(String key) {
      return (json[key] as List<dynamic>? ?? [])
          .map((item) => FestivalModel.fromJson(item as Map<String, dynamic>))
          .toList();
    }

    return CuratedFestivalsModel(
      ongoing: parse('ongoing'),
      weekend: parse('weekendFestivals'),
      upcoming: parse('upcoming'),
    );
  }
}
