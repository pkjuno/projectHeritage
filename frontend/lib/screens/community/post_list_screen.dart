import 'package:flutter/material.dart';
import '../../models/post_model.dart';
import '../../services/api_service.dart';
import '../../services/community_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/constants.dart';
import '../../widgets/post_card.dart';
import 'post_detail_screen.dart';
import 'post_editor_screen.dart';

/// 게시판별 게시글 목록 화면.
///
/// [category]가 null이면 전체 게시판을 보여준다.
/// [festivalId]가 있으면 그 축제에 연결된 글만 보여준다. (축제 상세에서 진입)
class PostListScreen extends StatefulWidget {
  final BoardCategoryModel? category;
  final int? festivalId;
  final String? festivalName;

  const PostListScreen({super.key, this.category, this.festivalId, this.festivalName});

  @override
  State<PostListScreen> createState() => _PostListScreenState();
}

class _PostListScreenState extends State<PostListScreen> {
  final CommunityService _service = CommunityService();
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();

  final List<PostModel> _posts = [];

  String _sort = 'latest';
  String? _keyword;
  int _page = 1;
  bool _hasMore = true;
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadFirstPage();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  /// 목록 끝에 가까워지면 다음 페이지를 불러온다. (무한 스크롤)
  void _onScroll() {
    if (!_scrollController.hasClients) return;

    final position = _scrollController.position;
    // 바닥에 완전히 닿은 뒤 부르면 로딩 스피너를 보는 시간이 길어지므로 조금 미리 부른다.
    if (position.pixels >= position.maxScrollExtent - 300) {
      _loadNextPage();
    }
  }

  /// 첫 페이지를 불러온다. (검색/정렬이 바뀔 때도 여기서 다시 시작한다)
  Future<void> _loadFirstPage() async {
    setState(() {
      _posts.clear();
      _page = 1;
      _hasMore = true;
      _error = null;
    });
    await _loadNextPage();
  }

  /// 다음 페이지를 불러와 목록에 이어 붙인다.
  Future<void> _loadNextPage() async {
    // 이미 요청 중이거나 더 불러올 게 없으면 아무것도 하지 않는다.
    // (스크롤 이벤트는 초당 여러 번 발생하므로 이 가드가 없으면 같은 페이지를 중복 요청한다)
    if (_isLoading || !_hasMore) return;

    setState(() => _isLoading = true);

    try {
      final result = await _service.fetchPosts(
        categoryCode: widget.category?.code,
        festivalId: widget.festivalId,
        keyword: _keyword,
        sort: _sort,
        page: _page,
      );

      if (!mounted) return;
      setState(() {
        _posts.addAll(result.items);
        _hasMore = result.hasMore;
        _page += 1;
        _error = null;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// 정렬 방식을 바꾸고 목록을 처음부터 다시 불러온다.
  void _changeSort(String sort) {
    if (_sort == sort) return;
    setState(() => _sort = sort);
    _loadFirstPage();
  }

  /// 검색어를 적용한다.
  void _applyKeyword(String value) {
    setState(() => _keyword = value.trim().isEmpty ? null : value.trim());
    _loadFirstPage();
  }

  /// 글쓰기 화면으로 이동한다. 작성에 성공하면 목록을 새로 고친다.
  Future<void> _goToEditor() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PostEditorScreen(
          initialCategory: widget.category,
          fixedFestivalId: widget.festivalId,
          fixedFestivalName: widget.festivalName,
        ),
      ),
    );

    if (created == true) _loadFirstPage();
  }

  /// 상세 화면으로 이동한다.
  ///
  /// 상세에서 글이 수정/삭제될 수 있고 조회수도 올라가므로 돌아오면 목록을 갱신한다.
  Future<void> _goToDetail(PostModel post) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PostDetailScreen(postId: post.id)),
    );
    if (mounted) _loadFirstPage();
  }

  @override
  Widget build(BuildContext context) {
    // 축제에서 진입했으면 축제 이름을, 게시판에서 진입했으면 게시판 이름을 제목으로 쓴다.
    final title = widget.festivalName ?? widget.category?.name ?? AppStrings.communityTitle;

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _goToEditor,
        icon: const Icon(Icons.edit),
        label: const Text(AppStrings.writePost),
      ),
      body: Column(
        children: [
          _buildFilterBar(),
          Expanded(
            child: Container(
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.line)),
              ),
              child: _buildList(),
            ),
          ),
        ],
      ),
    );
  }

  /// 검색창과 정렬 선택을 담은 상단 영역.
  Widget _buildFilterBar() {
    return Padding(
      padding: const EdgeInsets.all(AppSizes.paddingMedium),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              onSubmitted: _applyKeyword,
              style: Theme.of(context).textTheme.bodyMedium,
              decoration: InputDecoration(
                hintText: AppStrings.searchHint,
                prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.inkMuted),
                prefixIconConstraints: const BoxConstraints(minWidth: 38),
                // 검색어가 있을 때만 지우기 버튼을 보여준다.
                suffixIcon: _keyword == null
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          _applyKeyword('');
                        },
                      ),
              ),
            ),
          ),
          const SizedBox(width: AppSizes.paddingSmall),
          _SortToggle(sort: _sort, onChanged: _changeSort),
        ],
      ),
    );
  }

  /// 게시글 목록 본문.
  Widget _buildList() {
    // 첫 로딩 중 (이미 불러온 항목이 없을 때만 전체 스피너를 보여준다)
    if (_isLoading && _posts.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _posts.isEmpty) {
      return Center(child: Text(_error!));
    }

    if (_posts.isEmpty) {
      return const Center(child: Text(AppStrings.emptyPost));
    }

    return RefreshIndicator(
      onRefresh: _loadFirstPage,
      child: ListView.separated(
        controller: _scrollController,
        // 마지막 칸은 다음 페이지 로딩 표시에 쓴다.
        itemCount: _posts.length + (_hasMore ? 1 : 0),
        separatorBuilder: (_, __) => const Divider(color: AppColors.lineSubtle),
        itemBuilder: (context, index) {
          if (index >= _posts.length) {
            return const Padding(
              padding: EdgeInsets.all(AppSizes.paddingMedium),
              child: Center(child: CircularProgressIndicator()),
            );
          }

          final post = _posts[index];
          return PostCard(post: post, onTap: () => _goToDetail(post));
        },
      ),
    );
  }
}

/// 최신순 / 인기순 토글.
///
/// Material의 SegmentedButton은 이 톤에 비해 형태가 무겁고 높이가 커서,
/// 검색창과 같은 높이로 맞춘 얇은 토글을 직접 만든다.
class _SortToggle extends StatelessWidget {
  final String sort;
  final ValueChanged<String> onChanged;

  const _SortToggle({required this.sort, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(4),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        children: [
          _segment(context, 'latest', AppStrings.sortLatest),
          const VerticalDivider(width: 1, color: AppColors.line),
          _segment(context, 'popular', AppStrings.sortPopular),
        ],
      ),
    );
  }

  Widget _segment(BuildContext context, String value, String label) {
    final selected = sort == value;

    return InkWell(
      onTap: () => onChanged(value),
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        color: selected ? AppColors.accent : Colors.transparent,
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            fontWeight: selected ? FontWeight.w500 : FontWeight.w400,
            color: selected ? AppColors.onAccent : AppColors.inkSecondary,
          ),
        ),
      ),
    );
  }
}
