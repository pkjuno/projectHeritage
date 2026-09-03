import '../models/comment_model.dart';
import '../models/community_dashboard_model.dart';
import '../models/my_activity_model.dart';
import '../models/post_model.dart';
import 'api_service.dart';

/// 목록 응답을 페이지 정보와 함께 담는 그릇.
///
/// 무한 스크롤에서 "더 불러올 게 남았는지" 판단하려면 total과 page가 필요하다.
/// 항목만 반환하면 화면이 매번 그 계산을 다시 해야 한다.
class PagedResult<T> {
  final List<T> items;
  final int total;
  final int page;
  final int totalPages;

  const PagedResult({
    required this.items,
    required this.total,
    required this.page,
    required this.totalPages,
  });

  /// 다음 페이지가 남아 있는지 여부.
  bool get hasMore => page < totalPages;

  /// 서버의 공통 페이지네이션 응답을 파싱한다.
  factory PagedResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) parse,
  ) {
    final items = json['items'] as List<dynamic>? ?? [];

    return PagedResult(
      items: items.map((item) => parse(item as Map<String, dynamic>)).toList(),
      total: json['total'] as int? ?? 0,
      page: json['page'] as int? ?? 1,
      totalPages: json['totalPages'] as int? ?? 0,
    );
  }
}

/// 커뮤니티(게시판) API 통신을 담당하는 서비스.
class CommunityService {
  final ApiService _apiService;

  CommunityService({ApiService? apiService}) : _apiService = apiService ?? ApiService();

  // --- 대시보드 / 게시판 ---

  /// 커뮤니티 홈 대시보드를 조회한다.
  ///
  /// 로그인 상태면 내 활동 요약이 함께 오므로 항상 인증 헤더를 붙인다.
  /// (비로그인이면 서버가 myActivity를 null로 내려준다)
  Future<CommunityDashboardModel> fetchDashboard() async {
    final data = await _apiService.get('/community/dashboard', authorized: true);
    return CommunityDashboardModel.fromJson(data as Map<String, dynamic>);
  }

  /// 게시판 목록을 조회한다.
  Future<List<BoardCategoryModel>> fetchCategories() async {
    final data = await _apiService.get('/community/categories');
    return (data as List<dynamic>)
        .map((item) => BoardCategoryModel.fromJson(item as Map<String, dynamic>))
        .toList();
  }

  // --- 게시글 ---

  /// 게시글 목록을 조회한다.
  ///
  /// [categoryCode]가 null이면 전체 게시판을 대상으로 한다.
  /// [sort]는 'latest'(기본) 또는 'popular'.
  Future<PagedResult<PostModel>> fetchPosts({
    String? categoryCode,
    int? festivalId,
    String? keyword,
    String sort = 'latest',
    int page = 1,
    int limit = 20,
  }) async {
    // 값이 있는 조건만 쿼리스트링에 담는다. 빈 값을 보내면 서버가 빈 문자열로 필터링한다.
    final params = <String, String>{
      'sort': sort,
      'page': '$page',
      'limit': '$limit',
      if (categoryCode != null) 'category': categoryCode,
      if (festivalId != null) 'festivalId': '$festivalId',
      if (keyword != null && keyword.trim().isNotEmpty) 'keyword': keyword.trim(),
    };

    final query = Uri(queryParameters: params).query;
    final data = await _apiService.get('/community/posts?$query', authorized: true);
    return PagedResult.fromJson(data as Map<String, dynamic>, PostModel.fromJson);
  }

  /// 게시글 상세를 조회한다. (서버가 조회수도 함께 집계한다)
  Future<PostModel> fetchPost(int postId) async {
    final data = await _apiService.get('/community/posts/$postId', authorized: true);
    return PostModel.fromJson(data as Map<String, dynamic>);
  }

  /// 게시글을 작성한다.
  Future<PostModel> createPost({
    required String categoryCode,
    required String title,
    required String content,
    int? festivalId,
  }) async {
    final data = await _apiService.post(
      '/community/posts',
      {
        'category': categoryCode,
        'title': title,
        'content': content,
        if (festivalId != null) 'festivalId': festivalId,
      },
      authorized: true,
    );
    return PostModel.fromJson(data as Map<String, dynamic>);
  }

  /// 게시글을 수정한다. 게시판(카테고리) 이동은 지원하지 않는다.
  Future<PostModel> updatePost(
    int postId, {
    required String title,
    required String content,
  }) async {
    final data = await _apiService.put(
      '/community/posts/$postId',
      {'title': title, 'content': content},
      authorized: true,
    );
    return PostModel.fromJson(data as Map<String, dynamic>);
  }

  /// 게시글을 삭제한다.
  Future<void> deletePost(int postId) async {
    await _apiService.delete('/community/posts/$postId', authorized: true);
  }

  // --- 댓글 ---

  /// 게시글의 댓글 목록을 조회한다. (대댓글은 각 댓글의 replies에 담겨 온다)
  Future<PagedResult<CommentModel>> fetchComments(
    int postId, {
    int page = 1,
    int limit = 20,
  }) async {
    final data = await _apiService.get(
      '/community/posts/$postId/comments?page=$page&limit=$limit',
      authorized: true,
    );
    return PagedResult.fromJson(data as Map<String, dynamic>, CommentModel.fromJson);
  }

  /// 댓글 또는 대댓글을 작성한다. [parentId]를 주면 답글이 된다.
  Future<CommentModel> createComment(int postId, String content, {int? parentId}) async {
    final data = await _apiService.post(
      '/community/posts/$postId/comments',
      {'content': content, if (parentId != null) 'parentId': parentId},
      authorized: true,
    );
    return CommentModel.fromJson(data as Map<String, dynamic>);
  }

  /// 댓글을 수정한다.
  Future<CommentModel> updateComment(int commentId, String content) async {
    final data = await _apiService.put(
      '/community/comments/$commentId',
      {'content': content},
      authorized: true,
    );
    return CommentModel.fromJson(data as Map<String, dynamic>);
  }

  /// 댓글을 삭제한다.
  Future<void> deleteComment(int commentId) async {
    await _apiService.delete('/community/comments/$commentId', authorized: true);
  }

  /// 댓글 좋아요를 토글한다.
  /// @returns 토글 후의 좋아요 상태와 개수
  Future<({bool liked, int likeCount})> toggleCommentLike(int commentId) async {
    final data = await _apiService.post(
      '/community/comments/$commentId/like',
      {},
      authorized: true,
    );
    final map = data as Map<String, dynamic>;
    return (liked: map['liked'] as bool, likeCount: map['likeCount'] as int);
  }

  // --- 반응 / 공유 ---

  /// 반응을 남기거나 종류를 바꾼다.
  ///
  /// 토글이 아니라 PUT인 이유는 '좋아요 → 슬퍼요' 변경이 토글로 표현되지 않기 때문이다.
  Future<ReactionSummaryModel> setReaction(int postId, String type) async {
    final data = await _apiService.put(
      '/community/posts/$postId/reaction',
      {'type': type},
      authorized: true,
    );
    return ReactionSummaryModel.fromJson(data as Map<String, dynamic>);
  }

  /// 반응을 취소한다.
  Future<ReactionSummaryModel> removeReaction(int postId) async {
    final data = await _apiService.delete(
      '/community/posts/$postId/reaction',
      authorized: true,
    );
    return ReactionSummaryModel.fromJson(data as Map<String, dynamic>);
  }

  /// 하트 버튼처럼 좋아요 하나만 쓰는 화면을 위한 토글.
  ///
  /// 이미 어떤 반응이든 남겼으면 취소하고, 없으면 'like'를 남긴다.
  Future<ReactionSummaryModel> toggleLike(int postId, {required bool hasReaction}) async {
    return hasReaction ? removeReaction(postId) : setReaction(postId, 'like');
  }

  /// 공유를 기록한다.
  ///
  /// 이 값은 "공유 버튼을 눌렀다"는 기록일 뿐 실제 전송 여부는 알 수 없다.
  Future<int> share(int postId, {String channel = 'link'}) async {
    final data = await _apiService.post(
      '/community/posts/$postId/share',
      {'channel': channel},
      authorized: true,
    );
    return (data as Map<String, dynamic>)['shareCount'] as int;
  }

  // --- 내 활동 ---

  /// 내가 쓴 글 목록.
  Future<PagedResult<PostModel>> fetchMyPosts({int page = 1, int limit = 20}) async {
    final data = await _apiService.get(
      '/community/me/posts?page=$page&limit=$limit',
      authorized: true,
    );
    return PagedResult.fromJson(data as Map<String, dynamic>, PostModel.fromJson);
  }

  /// 내가 쓴 댓글 목록.
  ///
  /// 게시글 상세의 댓글과 달리 원글 정보를 품고 있어 모델이 다르다.
  /// (댓글만 보여주면 무슨 글에 단 댓글인지 알 수 없다)
  Future<PagedResult<MyCommentModel>> fetchMyComments({int page = 1, int limit = 20}) async {
    final data = await _apiService.get(
      '/community/me/comments?page=$page&limit=$limit',
      authorized: true,
    );
    return PagedResult.fromJson(data as Map<String, dynamic>, MyCommentModel.fromJson);
  }

  /// 내가 반응한 글 목록.
  Future<PagedResult<MyReactionModel>> fetchMyReactions({int page = 1, int limit = 20}) async {
    final data = await _apiService.get(
      '/community/me/reactions?page=$page&limit=$limit',
      authorized: true,
    );
    return PagedResult.fromJson(data as Map<String, dynamic>, MyReactionModel.fromJson);
  }
}
