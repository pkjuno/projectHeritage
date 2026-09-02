/// 광역시도 마스터 정보를 표현하는 모델.
/// 축제 캘린더의 지역 필터에서 사용한다.
class SidoModel {
  final int id;

  /// 국가유산청 Open API 시도코드 (예: 서울 '11')
  final String code;

  /// 시도명 (예: '서울특별시')
  final String name;

  const SidoModel({required this.id, required this.code, required this.name});

  factory SidoModel.fromJson(Map<String, dynamic> json) {
    return SidoModel(
      id: json['id'] as int,
      code: json['code'] as String,
      name: json['name'] as String,
    );
  }
}
