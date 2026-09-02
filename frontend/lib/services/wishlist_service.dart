import '../models/schedule_model.dart';
import 'api_service.dart';

/// 위시리스트(찜한 축제) API 통신을 담당하는 서비스.
class WishlistService {
  final ApiService _apiService;

  WishlistService({ApiService? apiService}) : _apiService = apiService ?? ApiService();

  /// 내가 찜한 축제 목록을 조회한다.
  Future<List<WishlistModel>> fetchMyWishlists({int page = 1, int limit = 20}) async {
    final data = await _apiService.get('/users/me/wishlists?page=$page&limit=$limit', authorized: true);
    final items = (data as Map<String, dynamic>)['items'] as List<dynamic>;
    return items.map((item) => WishlistModel.fromJson(item as Map<String, dynamic>)).toList();
  }

  /// 축제를 위시리스트에 담는다.
  Future<void> add(int festivalId) async {
    await _apiService.post('/users/me/wishlists/$festivalId', {}, authorized: true);
  }

  /// 위시리스트에서 축제를 제거한다.
  Future<void> remove(int festivalId) async {
    await _apiService.delete('/users/me/wishlists/$festivalId', authorized: true);
  }

  /// 찜 상태를 토글한다. [isCurrentlyWishlisted]가 true면 제거, false면 추가한다.
  /// @returns 토글 후의 찜 상태
  Future<bool> toggle(int festivalId, bool isCurrentlyWishlisted) async {
    if (isCurrentlyWishlisted) {
      await remove(festivalId);
      return false;
    }
    await add(festivalId);
    return true;
  }
}
