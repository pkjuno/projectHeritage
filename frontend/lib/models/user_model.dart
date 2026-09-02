/// 사용자 정보를 표현하는 데이터 모델 클래스.
class UserModel {
  final String id;
  final String name;
  final String email;

  const UserModel({
    required this.id,
    required this.name,
    required this.email,
  });

  /// 백엔드 API 응답(JSON)을 [UserModel] 객체로 변환한다.
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'].toString(),
      name: json['name'] as String,
      email: json['email'] as String,
    );
  }

  /// [UserModel] 객체를 JSON(Map) 형태로 변환한다. (요청 body 생성 등에 사용)
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
    };
  }
}
