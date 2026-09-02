import '../models/user_model.dart';
import 'api_service.dart';

/// User 도메인 관련 API 통신을 담당하는 서비스.
class UserService {
  final ApiService _apiService;

  UserService({ApiService? apiService}) : _apiService = apiService ?? ApiService();

  /// 현재 로그인된 사용자(내 정보)를 조회한다. 인증 토큰이 필요하다.
  Future<UserModel> fetchMe() async {
    final data = await _apiService.get('/users/me', authorized: true);
    return UserModel.fromJson(data as Map<String, dynamic>);
  }
}
