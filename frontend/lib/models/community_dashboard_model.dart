import 'festival_model.dart';
import 'post_model.dart';

/// 게시판별 글 수 요약. (대시보드의 게시판 목록)
class CategorySummaryModel {
  final int id;
  final String code;
  final String name;
  final String? description;
  final int postCount;
  final int todayCount;

  const CategorySummaryModel({
    required this.id,
    required this.code,
    required this.name,
    this.description,
    this.postCount = 0,
    this.todayCount = 0,
  });

  /// 오늘 새 글이 올라온 게시판인지 여부. (목록에 NEW 뱃지를 붙이는 데 쓴다)
  bool get hasNewToday => todayCount > 0;

  factory CategorySummaryModel.fromJson(Map<String, dynamic> json) {
    return CategorySummaryModel(
      id: json['id'] as int,
      code: json['code'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      postCount: json['postCount'] as int? ?? 0,
      todayCount: json['todayCount'] as int? ?? 0,
    );
  }
}

/// 지금 진행 중인 축제 가운데 이야기가 많은 축제.
class FestivalTalkModel {
  final FestivalModel festival;
  final int postCount;

  const FestivalTalkModel({required this.festival, required this.postCount});

  factory FestivalTalkModel.fromJson(Map<String, dynamic> json) {
    return FestivalTalkModel(
      festival: FestivalModel.fromJson(json['festival'] as Map<String, dynamic>),
      postCount: json['postCount'] as int? ?? 0,
    );
  }
}

/// 내 커뮤니티 활동 요약.
///
/// [receivedReactionCount]는 내가 누른 반응이 아니라 **내 글이 받은** 반응이다.
class MyActivitySummaryModel {
  final int postCount;
  final int commentCount;
  final int receivedReactionCount;

  const MyActivitySummaryModel({
    this.postCount = 0,
    this.commentCount = 0,
    this.receivedReactionCount = 0,
  });

  factory MyActivitySummaryModel.fromJson(Map<String, dynamic> json) {
    return MyActivitySummaryModel(
      postCount: json['postCount'] as int? ?? 0,
      commentCount: json['commentCount'] as int? ?? 0,
      receivedReactionCount: json['receivedReactionCount'] as int? ?? 0,
    );
  }
}

/// 커뮤니티 홈 대시보드.
///
/// 홈 화면 전체를 한 번의 요청으로 그리기 위해 서버가 묶어서 내려주는 응답이다.
class CommunityDashboardModel {
  final List<PostModel> trending;
  final List<PostModel> latest;
  final List<CategorySummaryModel> categories;
  final List<FestivalTalkModel> festivalTalk;

  /// 비로그인 상태면 null이다.
  final MyActivitySummaryModel? myActivity;

  const CommunityDashboardModel({
    this.trending = const [],
    this.latest = const [],
    this.categories = const [],
    this.festivalTalk = const [],
    this.myActivity,
  });

  /// 아직 글이 하나도 없는 상태인지 여부. (첫 화면 안내 문구 판단용)
  bool get isEmpty => trending.isEmpty && latest.isEmpty;

  factory CommunityDashboardModel.fromJson(Map<String, dynamic> json) {
    List<T> parseList<T>(String key, T Function(Map<String, dynamic>) parse) {
      final raw = json[key] as List<dynamic>? ?? [];
      return raw.map((item) => parse(item as Map<String, dynamic>)).toList();
    }

    return CommunityDashboardModel(
      trending: parseList('trending', PostModel.fromJson),
      latest: parseList('latest', PostModel.fromJson),
      categories: parseList('categories', CategorySummaryModel.fromJson),
      festivalTalk: parseList('festivalTalk', FestivalTalkModel.fromJson),
      myActivity: json['myActivity'] != null
          ? MyActivitySummaryModel.fromJson(json['myActivity'] as Map<String, dynamic>)
          : null,
    );
  }
}
