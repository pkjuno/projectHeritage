import 'festival_model.dart';
import 'author_model.dart';

/// 게시판(카테고리) 정보.
///
/// 서버가 게시판별 정책까지 함께 내려주므로, 앱은 글쓰기 버튼을 보여줄지와
/// 축제 선택 칸을 띄울지를 하드코딩 없이 판단할 수 있다.
class BoardCategoryModel {
  final int id;
  final String code;
  final String name;
  final String? description;

  /// 이 게시판에 글을 쓸 수 있는 권한. 'admin'이면 운영자 전용(공지사항).
  final String writeRole;

  /// true면 글 작성 시 축제를 반드시 선택해야 한다. (축제 후기 게시판)
  final bool requireFestival;

  const BoardCategoryModel({
    required this.id,
    required this.code,
    required this.name,
    this.description,
    this.writeRole = 'user',
    this.requireFestival = false,
  });

  /// 운영자만 쓸 수 있는 게시판인지 여부.
  bool get isAdminOnly => writeRole == 'admin';

  factory BoardCategoryModel.fromJson(Map<String, dynamic> json) {
    return BoardCategoryModel(
      id: json['id'] as int,
      code: json['code'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      writeRole: json['writeRole'] as String? ?? 'user',
      requireFestival: json['requireFestival'] as bool? ?? false,
    );
  }
}

/// 게시글에 달린 반응 집계. (좋아요 + 공감)
///
/// 서버는 총 개수와 종류별 개수를 함께 내려준다.
/// 종류별 개수는 반응이 없는 종류도 0으로 채워져 오므로 화면에서 방어할 필요가 없다.
class ReactionSummaryModel {
  final int total;
  final Map<String, int> byType;

  /// 내가 남긴 반응. 남기지 않았으면 null.
  final String? myReaction;

  const ReactionSummaryModel({
    this.total = 0,
    this.byType = const {},
    this.myReaction,
  });

  /// 내가 반응을 남겼는지 여부.
  bool get hasMine => myReaction != null;

  /// 특정 종류의 반응 개수.
  int countOf(String type) => byType[type] ?? 0;

  factory ReactionSummaryModel.fromJson(Map<String, dynamic> json) {
    final raw = json['byType'] as Map<String, dynamic>? ?? {};

    return ReactionSummaryModel(
      total: json['total'] as int? ?? 0,
      // JSON 숫자는 int로 오지만, 서버 구현이 바뀌어 double이 와도 깨지지 않게 num으로 받는다.
      byType: raw.map((key, value) => MapEntry(key, (value as num).toInt())),
      myReaction: json['myReaction'] as String?,
    );
  }
}

/// 커뮤니티 게시글.
///
/// 목록 응답과 상세 응답이 같은 모델을 쓴다.
/// 목록에는 본문(content)과 반응 분포(reactions)가 없으므로 둘 다 선택 필드다.
class PostModel {
  final int id;
  final String title;

  /// 본문. 목록 응답에는 없고 상세 응답에만 있다.
  final String? content;

  /// 본문 앞부분만 잘라낸 미리보기. 목록 응답에만 있다.
  ///
  /// 목록에서 제목만 보이면 어떤 글인지 판단하려고 매번 들어가 봐야 한다.
  /// 그렇다고 본문 전체를 실으면 한 페이지가 수백 KB가 되므로 서버가 잘라서 준다.
  final String? preview;

  final AuthorModel? author;
  final BoardCategoryModel? category;

  /// 연결된 축제. 자유 글은 null이다.
  final FestivalModel? festival;

  /// published / hidden / deleted
  final String status;

  /// 운영자가 상단에 고정한 글인지 여부.
  final bool isPinned;

  final int viewCount;
  final int commentCount;
  final int reactionCount;
  final int shareCount;

  final DateTime createdAt;

  /// 내가 쓴 글인지 여부. 로그인 상태에서만 true가 될 수 있다.
  final bool isMine;

  /// 내가 남긴 반응 종류. 목록 응답에서 사용한다.
  final String? myReaction;

  /// 반응 분포. 상세 응답에만 담긴다.
  final ReactionSummaryModel? reactions;

  const PostModel({
    required this.id,
    required this.title,
    required this.createdAt,
    this.content,
    this.preview,
    this.author,
    this.category,
    this.festival,
    this.status = 'published',
    this.isPinned = false,
    this.viewCount = 0,
    this.commentCount = 0,
    this.reactionCount = 0,
    this.shareCount = 0,
    this.isMine = false,
    this.myReaction,
    this.reactions,
  });

  /// 운영자가 숨긴 글인지 여부. 작성자에게만 보이며 수정할 수 없다.
  bool get isHidden => status == 'hidden';

  /// 목록/상세 어느 쪽 응답이든 "내가 반응했는지"를 같은 방법으로 알 수 있게 한다.
  /// 상세 응답에는 reactions.myReaction이, 목록 응답에는 myReaction이 담긴다.
  String? get currentReaction => reactions?.myReaction ?? myReaction;

  /// 작성자 표시 이름. 탈퇴 등으로 작성자 정보가 없으면 대체 문구를 쓴다.
  String get authorLabel => author?.displayName ?? '알 수 없음';

  /// 목록에 보여줄 본문 요약.
  /// 목록 응답이면 preview가, 상세 응답이면 content가 들어 있다.
  String? get summaryText => preview ?? content;

  factory PostModel.fromJson(Map<String, dynamic> json) {
    return PostModel(
      id: json['id'] as int,
      title: json['title'] as String,
      content: json['content'] as String?,
      preview: json['preview'] as String?,
      author: json['author'] != null
          ? AuthorModel.fromJson(json['author'] as Map<String, dynamic>)
          : null,
      category: json['category'] != null
          ? BoardCategoryModel.fromJson(json['category'] as Map<String, dynamic>)
          : null,
      festival: json['festival'] != null
          ? FestivalModel.fromJson(json['festival'] as Map<String, dynamic>)
          : null,
      status: json['status'] as String? ?? 'published',
      isPinned: json['isPinned'] as bool? ?? false,
      viewCount: json['viewCount'] as int? ?? 0,
      commentCount: json['commentCount'] as int? ?? 0,
      reactionCount: json['reactionCount'] as int? ?? 0,
      shareCount: json['shareCount'] as int? ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isMine: json['isMine'] as bool? ?? false,
      myReaction: json['myReaction'] as String?,
      reactions: json['reactions'] != null
          ? ReactionSummaryModel.fromJson(json['reactions'] as Map<String, dynamic>)
          : null,
    );
  }
}
