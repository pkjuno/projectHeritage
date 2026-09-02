import '../models/user_model.dart';
import 'api_service.dart';

/// User 도메인 관련 API 통신을 담당하는 서비스.
class UserService {
  final ApiService _apiService;

  UserService({ApiService? apiService}) : _apiService = apiService ?? ApiService();

  /// 전체 사용자 목록을 조회한다.
  Future<List<UserModel>> fetchUsers() async {
    final data = await _apiService.get('/users');
    return (data as List)
        .map((json) => UserModel.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  /// 특정 사용자를 ID로 조회한다.
  Future<UserModel> fetchUserById(String id) async {
    final data = await _apiService.get('/users/$id');
    return UserModel.fromJson(data as Map<String, dynamic>);
  }

  /// 새로운 사용자를 생성한다.
  Future<UserModel> createUser({required String name, required String email}) async {
    final data = await _apiService.post('/users', {'name': name, 'email': email});
    return UserModel.fromJson(data as Map<String, dynamic>);
  }
}
