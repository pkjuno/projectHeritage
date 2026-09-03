import 'package:flutter/material.dart';
import '../../models/my_activity_model.dart';
import '../../models/post_model.dart';
import '../../services/api_service.dart';
import '../../services/community_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/constants.dart';
import '../../utils/date_format.dart';
import '../../utils/reaction_types.dart';
import '../../widgets/post_card.dart';
import 'post_detail_screen.dart';

/// 내 커뮤니티 활동 화면. (내 글 / 내 댓글 / 내 반응)
class MyActivityScreen extends StatefulWidget {
  const MyActivityScreen({super.key});

  @override
  State<MyActivityScreen> createState() => _MyActivityScreenState();
}

class _MyActivityScreenState extends State<MyActivityScreen>
    with SingleTickerProviderStateMixin {
  final CommunityService _service = CommunityService();
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  /// 상세로 이동한 뒤 돌아오면 목록을 새로 그린다. (글이 삭제됐을 수 있다)
  Future<void> _goToDetail(int postId) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PostDetailScreen(postId: postId)),
    );
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.myActivityTitle),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: AppStrings.myPostsTab),
            Tab(text: AppStrings.myCommentsTab),
            Tab(text: AppStrings.myReactionsTab),
          ],
        ),
      ),
      backgroundColor: AppColors.surface,
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildMyPosts(),
          _buildMyComments(),
          _buildMyReactions(),
        ],
      ),
    );
  }

  /// 내가 쓴 글 탭.
  Widget _buildMyPosts() {
    return _ActivityTab<PostModel>(
      // 화면에 들어올 때마다 새로 부른다. 다른 탭에서 글을 지우고 돌아올 수 있다.
      load: () async => (await _service.fetchMyPosts()).items,
      itemBuilder: (post) => PostCard(
        post: post,
        onTap: () => _goToDetail(post.id),
      ),
    );
  }

  /// 내가 쓴 댓글 탭.
  ///
  /// 댓글 내용과 함께 어떤 글에 단 댓글인지를 보여준다.
  Widget _buildMyComments() {
    return _ActivityTab<MyCommentModel>(
      load: () async => (await _service.fetchMyComments()).items,
      itemBuilder: (comment) => ListTile(
        title: Text(comment.content, maxLines: 2, overflow: TextOverflow.ellipsis),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(
            children: [
              // 답글인지 표시해두면 목록에서 맥락을 잡기 쉽다.
              if (comment.isReply) ...[
                const Icon(Icons.subdirectory_arrow_right, size: 13),
                const SizedBox(width: 2),
              ],
              Expanded(
                child: Text(
                  comment.post.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: AppSizes.paddingSmall),
              Text(toDisplayDate(comment.createdAt)),
            ],
          ),
        ),
        onTap: () => _goToDetail(comment.postId),
      ),
    );
  }

  /// 내가 반응한 글 탭.
  Widget _buildMyReactions() {
    return _ActivityTab<MyReactionModel>(
      load: () async => (await _service.fetchMyReactions()).items,
      itemBuilder: (reaction) => ListTile(
        // 어떤 반응을 남겼는지 이모지로 보여준다.
        leading: Text(emojiOf(reaction.type), style: const TextStyle(fontSize: 22)),
        title: Text(
          reaction.post.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          '${labelOf(reaction.type)} · ${toDisplayDate(reaction.createdAt)}',
        ),
        onTap: () => _goToDetail(reaction.post.id),
      ),
    );
  }
}

/// 내 활동 탭 하나를 그리는 공통 위젯.
///
/// 세 탭이 로딩/에러/빈 목록 처리가 같아서 한 곳에 모은다.
class _ActivityTab<T> extends StatefulWidget {
  final Future<List<T>> Function() load;
  final Widget Function(T item) itemBuilder;

  const _ActivityTab({required this.load, required this.itemBuilder});

  @override
  State<_ActivityTab<T>> createState() => _ActivityTabState<T>();
}

class _ActivityTabState<T> extends State<_ActivityTab<T>>
    with AutomaticKeepAliveClientMixin {
  late Future<List<T>> _future;

  // 탭을 오갈 때마다 다시 요청하지 않도록 상태를 유지한다.
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _future = widget.load();
  }

  Future<void> _refresh() async {
    setState(() => _future = widget.load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return FutureBuilder<List<T>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          final error = snapshot.error;
          return Center(
            child: Text(error is ApiException ? error.message : AppStrings.errorMessage),
          );
        }

        final items = snapshot.data ?? [];

        if (items.isEmpty) {
          // RefreshIndicator가 동작하려면 스크롤 가능한 자식이 필요하므로
          // 빈 상태에서도 ListView를 쓴다.
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              children: [
                const SizedBox(height: 100),
                // 빈 화면에 문구만 있으면 고장난 것처럼 보인다. 다음에 할 일을 알려준다.
                Center(
                  child: Column(
                    children: [
                      const Icon(Icons.forum_outlined, size: 26, color: AppColors.inkDisabled),
                      const SizedBox(height: AppSizes.paddingSmall),
                      Text(
                        AppStrings.emptyMyActivity,
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '다녀온 축제의 후기를 남겨보세요.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.separated(
            itemCount: items.length,
            separatorBuilder: (_, __) => const Divider(color: AppColors.lineSubtle),
            itemBuilder: (context, index) => widget.itemBuilder(items[index]),
          ),
        );
      },
    );
  }
}
