import 'dart:io';

import '../models/user_model.dart';
import 'api_service.dart';

/// 마이페이지(회원정보/프로필) 관련 API 통신을 담당하는 서비스.
class UserService {
  final ApiService _apiService;

  UserService({ApiService? apiService}) : _apiService = apiService ?? ApiService();

  /// 현재 로그인된 회원의 정보(연결된 간편로그인 포함)를 조회한다.
  Future<UserModel> fetchMe() async {
    final data = await _apiService.get('/users/me', authorized: true);
    return UserModel.fromJson(data as Map<String, dynamic>);
  }

  /// 회원정보(닉네임/이름)를 수정한다. 전달하지 않은 항목은 변경되지 않는다.
  Future<UserModel> updateMyInfo({String? nickname, String? name}) async {
    final body = <String, dynamic>{};
    if (nickname != null) body['nickname'] = nickname;
    if (name != null) body['name'] = name;

    final data = await _apiService.patch('/users/me', body, authorized: true);
    return UserModel.fromJson(data as Map<String, dynamic>);
  }

  /// 프로필 이미지를 등록하거나 교체한다.
  Future<UserModel> uploadProfileImage(File imageFile) async {
    final data = await _apiService.uploadFile('/users/me/profile-image', imageFile);
    return UserModel.fromJson(data as Map<String, dynamic>);
  }

  /// 등록된 프로필 이미지를 삭제한다.
  Future<UserModel> deleteProfileImage() async {
    final data = await _apiService.delete('/users/me/profile-image', authorized: true);
    return UserModel.fromJson(data as Map<String, dynamic>);
  }
}
