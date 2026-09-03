import 'package:flutter/material.dart';
import '../../models/community_dashboard_model.dart';
import '../../models/user_model.dart';
import '../../services/user_service.dart';
import '../admin/report_queue_screen.dart';
import '../mypage/blocked_users_screen.dart';
import '../../models/post_model.dart';
import '../../services/api_service.dart';
import '../../services/community_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_theme.dart';
import '../../utils/constants.dart';
import '../../widgets/post_card.dart';
import '../festival/festival_detail_screen.dart';
import 'my_activity_screen.dart';
import 'post_detail_screen.dart';
import 'post_editor_screen.dart';
import 'post_list_screen.dart';

/// 커뮤니티 홈(대시보드) 화면.
///
/// 인기글 / 최신글 / 게시판 / 축제 이야기 / 내 활동을 한 화면에 담는다.
/// 서버가 이 모두를 한 번의 요청으로 내려주므로 화면 조각마다 API를 부르지 않는다.
class CommunityHomeScreen extends StatefulWidget {
  const CommunityHomeScreen({super.key});

  @override
  State<CommunityHomeScreen> createState() => _CommunityHomeScreenState();
}

class _CommunityHomeScreenState extends State<CommunityHomeScreen> {
  final CommunityService _service = CommunityService();
  final UserService _userService = UserService();

  /// 로그인한 회원. 운영자 진입점을 보여줄지 판단한다.
  UserModel? _me;

  CommunityDashboardModel? _dashboard;
  List<BoardCategoryModel> _categories = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _loadMe();
  }

  /// 내 정보를 불러온다. 실패해도 화면은 그대로 동작한다.
  Future<void> _loadMe() async {
    try {
      final me = await _userService.fetchMe();
      if (mounted) setState(() => _me = me);
    } on ApiException {
      // 비로그인 상태다. 운영자/차단 메뉴가 보이지 않을 뿐이다.
    }
  }

  /// 대시보드와 게시판 목록을 불러온다.
  ///
  /// 게시판 목록을 따로 부르는 이유: 대시보드의 카테고리는 글 수 요약이라
  /// 작성 권한/축제 필수 여부 같은 정책 값이 없다. 글쓰기 화면에는 그 값이 필요하다.
  Future<void> _load() async {
    setState(() => _isLoading = true);

    try {
      final results = await Future.wait([
        _service.fetchDashboard(),
        _service.fetchCategories(),
      ]);

      if (!mounted) return;
      setState(() {
        _dashboard = results[0] as CommunityDashboardModel;
        _categories = results[1] as List<BoardCategoryModel>;
        _error = null;
        _isLoading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _isLoading = false;
      });
    }
  }

  /// 게시판 코드로 정책이 담긴 카테고리를 찾는다.
  BoardCategoryModel? _findCategory(String code) {
    for (final category in _categories) {
      if (category.code == code) return category;
    }
    return null;
  }

  Future<void> _goToList({BoardCategoryModel? category}) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PostListScreen(category: category)),
    );
    if (mounted) _load();
  }

  Future<void> _goToDetail(PostModel post) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PostDetailScreen(postId: post.id)),
    );
    if (mounted) _load();
  }

  Future<void> _goToEditor() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const PostEditorScreen()),
    );
    if (created == true && mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.communityTitle),
        actions: [
          // 운영자에게만 신고 처리 진입점을 보여준다.
          // (서버가 403으로 막지만, 보이면 눌러보게 되고 눌러보면 거절당한다)
          if (_me?.isAdmin == true)
            IconButton(
              icon: const Icon(Icons.flag_outlined),
              tooltip: AppStrings.reportQueueTitle,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ReportQueueScreen()),
              ),
            ),
          if (_me != null)
            IconButton(
              icon: const Icon(Icons.block),
              tooltip: AppStrings.blockedListTitle,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const BlockedUsersScreen()),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            tooltip: AppStrings.myActivityTitle,
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const MyActivityScreen()),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _goToEditor,
        icon: const Icon(Icons.edit),
        label: const Text(AppStrings.writePost),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!));

    final dashboard = _dashboard!;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.symmetric(vertical: AppSizes.paddingMedium),
        children: [
          if (dashboard.myActivity != null) _buildMyActivity(dashboard.myActivity!),
          _buildBoardSection(dashboard.categories),
          if (dashboard.festivalTalk.isNotEmpty) _buildFestivalTalk(dashboard.festivalTalk),
          if (dashboard.trending.isNotEmpty)
            _buildPostSection(AppStrings.trendingSection, dashboard.trending),
          if (dashboard.latest.isNotEmpty)
            _buildPostSection(AppStrings.latestSection, dashboard.latest),
          // 글이 하나도 없는 초기 상태에서 빈 화면만 보이면 고장난 것처럼 느껴진다.
          if (dashboard.isEmpty)
            const Padding(
              padding: EdgeInsets.all(AppSizes.paddingLarge),
              child: Center(child: Text(AppStrings.emptyPost)),
            ),
        ],
      ),
    );
  }

  /// 섹션 제목 줄.
  Widget _sectionHeader(String title, {VoidCallback? onMore}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSizes.paddingMedium,
        AppSizes.paddingMedium,
        AppSizes.paddingSmall,
        AppSizes.paddingSmall,
      ),
      child: Row(
        children: [
          // 섹션 제목은 본문보다 작고 굵게 둔다. 명조 제목이 화면마다 반복되면
          // 정작 글 제목이 눈에 띄지 않는다.
          Text(
            title,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: AppColors.inkSecondary,
            ),
          ),
          const Spacer(),
          if (onMore != null)
            TextButton(onPressed: onMore, child: const Text('더보기')),
        ],
      ),
    );
  }

  /// 내 활동 요약 카드.
  Widget _buildMyActivity(MyActivitySummaryModel activity) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: AppSizes.paddingLarge),
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const MyActivityScreen()),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSizes.paddingMedium),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _ActivityStat(label: '내 글', count: activity.postCount),
              _ActivityStat(label: '내 댓글', count: activity.commentCount, divided: true),
              // 내가 누른 반응이 아니라 내 글이 받은 반응이다.
              // 셋 중 이 값만 강조색을 쓴다 — 커뮤니티에서 의미 있는 숫자이기 때문이다.
              _ActivityStat(
                label: '받은 반응',
                count: activity.receivedReactionCount,
                highlighted: true,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// 게시판 목록.
  Widget _buildBoardSection(List<CategorySummaryModel> categories) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader(AppStrings.boardSection),
        Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border.symmetric(horizontal: BorderSide(color: AppColors.line)),
          ),
          child: Column(children: [
        for (final summary in categories)
          ListTile(
            dense: true,
            title: Row(
              children: [
                Text(summary.name),
                // 오늘 새 글이 올라온 게시판을 눈에 띄게 한다.
                if (summary.hasNewToday) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      // 채운 뱃지 대신 옅은 배경을 쓴다. 게시판마다 채운 뱃지가 붙으면
                      // 목록 전체가 시끄러워지고 강조의 의미가 사라진다.
                      color: AppColors.accentSurface,
                      borderRadius: BorderRadius.circular(2),
                    ),
                    child: Text(
                      '+${summary.todayCount}',
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: AppColors.accent,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            subtitle: summary.description != null ? Text(summary.description!) : null,
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('${summary.postCount}'),
                const Icon(Icons.chevron_right),
              ],
            ),
            onTap: () => _goToList(category: _findCategory(summary.code)),
          ),
          ]),
        ),
      ],
    );
  }

  /// 지금 이야기가 많은 축제.
  Widget _buildFestivalTalk(List<FestivalTalkModel> talks) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader(AppStrings.festivalTalkSection),
        SizedBox(
          height: 92,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSizes.paddingLarge),
            itemCount: talks.length,
            separatorBuilder: (_, __) => const SizedBox(width: AppSizes.paddingSmall),
            itemBuilder: (context, index) {
              final talk = talks[index];

              return SizedBox(
                width: 150,
                child: Card(
                  child: InkWell(
                    // 축제 상세로 보낸다. 거기서 그 축제의 후기 목록으로 다시 들어갈 수 있다.
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => FestivalDetailScreen(festivalId: talk.festival.id),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(AppSizes.paddingMedium),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            talk.festival.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              // 지금 열리는 중이라는 신호를 점 하나로만 준다.
                              Container(
                                width: 4,
                                height: 4,
                                decoration: const BoxDecoration(
                                  color: AppColors.accent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                '진행 중 · 글 ${talk.postCount}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  /// 인기글 / 최신글 섹션.
  Widget _buildPostSection(String title, List<PostModel> posts) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionHeader(title, onMore: () => _goToList()),
        for (final post in posts) PostCard(post: post, onTap: () => _goToDetail(post)),
      ],
    );
  }
}

/// 내 활동 요약의 숫자 한 칸.
class _ActivityStat extends StatelessWidget {
  final String label;
  final int count;

  /// 강조색으로 표시할지 여부.
  final bool highlighted;

  /// 좌우에 세로 구분선을 둘지 여부. (가운데 칸)
  final bool divided;

  const _ActivityStat({
    required this.label,
    required this.count,
    this.highlighted = false,
    this.divided = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: divided
          ? const BoxDecoration(
              border: Border.symmetric(
                vertical: BorderSide(color: AppColors.lineSubtle),
              ),
            )
          : null,
      child: Column(
        children: [
          Text(
            '$count',
            style: AppTheme.serif(
              fontSize: 21,
              fontWeight: FontWeight.w400,
              color: highlighted ? AppColors.accent : AppColors.ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
