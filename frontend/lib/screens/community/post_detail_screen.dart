import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../config/app_config.dart';
import '../../models/comment_model.dart';
import '../../models/post_model.dart';
import '../../models/user_model.dart';
import '../../services/user_service.dart';
import '../../widgets/report_sheet.dart';
import '../../services/api_service.dart';
import '../../services/community_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/constants.dart';
import '../../utils/date_format.dart';
import '../../utils/reaction_types.dart';
import '../festival/festival_detail_screen.dart';
import 'post_editor_screen.dart';

/// 게시글 상세 화면.
///
/// 본문 + 반응 바 + 댓글 목록을 한 화면에 담는다.
class PostDetailScreen extends StatefulWidget {
  final int postId;

  const PostDetailScreen({super.key, required this.postId});

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  final CommunityService _service = CommunityService();
  final UserService _userService = UserService();
  final TextEditingController _commentController = TextEditingController();

  /// 로그인한 회원. 운영자 메뉴를 보여줄지 판단하는 데 쓴다.
  UserModel? _me;

  PostModel? _post;
  List<CommentModel> _comments = [];

  /// 답글을 달 대상 댓글. null이면 새 댓글을 쓰는 중이다.
  CommentModel? _replyTarget;

  bool _isLoading = true;
  bool _isSubmittingComment = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _loadMe();
  }

  /// 내 정보를 불러온다. 실패해도 화면은 그대로 동작해야 하므로 조용히 넘어간다.
  Future<void> _loadMe() async {
    try {
      final me = await _userService.fetchMe();
      if (mounted) setState(() => _me = me);
    } on ApiException {
      // 비로그인 상태다. 신고/차단/운영자 메뉴가 보이지 않을 뿐이다.
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  /// 글과 댓글을 함께 불러온다.
  Future<void> _load() async {
    setState(() => _isLoading = true);

    try {
      // 둘은 서로를 기다릴 이유가 없으므로 동시에 요청한다.
      final results = await Future.wait([
        _service.fetchPost(widget.postId),
        _service.fetchComments(widget.postId),
      ]);

      if (!mounted) return;
      setState(() {
        _post = results[0] as PostModel;
        _comments = (results[1] as PagedResult<CommentModel>).items;
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

  /// 댓글만 다시 불러온다. (댓글 작성/삭제 후)
  ///
  /// 댓글 수가 바뀌면 본문 위의 숫자도 같이 바뀌어야 하므로 글도 함께 갱신한다.
  Future<void> _reloadComments() async {
    try {
      final results = await Future.wait([
        _service.fetchPost(widget.postId),
        _service.fetchComments(widget.postId),
      ]);

      if (!mounted) return;
      setState(() {
        _post = results[0] as PostModel;
        _comments = (results[1] as PagedResult<CommentModel>).items;
      });
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 반응을 남기거나 바꾼다.
  Future<void> _setReaction(String type) async {
    final post = _post;
    if (post == null) return;

    try {
      // 이미 같은 종류를 눌러둔 상태에서 다시 누르면 취소로 동작한다.
      final summary = post.currentReaction == type
          ? await _service.removeReaction(post.id)
          : await _service.setReaction(post.id, type);

      if (!mounted) return;
      setState(() {
        // 서버가 돌려준 집계를 그대로 반영한다. 화면에서 숫자를 직접 계산하면
        // 반응 종류 변경(총합 불변) 같은 규칙을 앱에서 또 구현하게 된다.
        _post = _rebuildWithReactions(post, summary);
      });
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 서버가 준 반응 집계를 글 모델에 반영한 새 인스턴스를 만든다.
  PostModel _rebuildWithReactions(PostModel post, ReactionSummaryModel summary) {
    return PostModel(
      id: post.id,
      title: post.title,
      content: post.content,
      author: post.author,
      category: post.category,
      festival: post.festival,
      status: post.status,
      isPinned: post.isPinned,
      viewCount: post.viewCount,
      commentCount: post.commentCount,
      reactionCount: summary.total,
      shareCount: post.shareCount,
      createdAt: post.createdAt,
      isMine: post.isMine,
      myReaction: summary.myReaction,
      reactions: summary,
    );
  }

  /// 공유한다.
  ///
  /// 링크를 클립보드에 복사하고 서버에 공유 기록을 남긴다.
  /// 서버 기록은 "공유 버튼을 눌렀다"는 뜻이지 실제 전송을 보장하지는 않는다.
  Future<void> _share() async {
    final post = _post;
    if (post == null) return;

    final link = '${AppConfig.baseUrl}/community/posts/${post.id}';
    await Clipboard.setData(ClipboardData(text: link));

    try {
      await _service.share(post.id, channel: 'link');
    } on ApiException {
      // 공유 기록은 부가 지표다. 실패해도 사용자가 링크를 복사한 사실은 변하지 않으므로
      // 오류를 띄워 흐름을 끊지 않는다.
    }

    _showMessage(AppStrings.linkCopied);
  }

  /// 댓글 또는 답글을 등록한다.
  Future<void> _submitComment() async {
    final content = _commentController.text.trim();
    if (content.isEmpty || _isSubmittingComment) return;

    setState(() => _isSubmittingComment = true);

    try {
      await _service.createComment(widget.postId, content, parentId: _replyTarget?.id);

      if (!mounted) return;
      _commentController.clear();
      setState(() => _replyTarget = null);
      await _reloadComments();
    } on ApiException catch (error) {
      _showMessage(error.message);
    } finally {
      if (mounted) setState(() => _isSubmittingComment = false);
    }
  }

  /// 댓글 좋아요를 토글한다.
  Future<void> _toggleCommentLike(CommentModel comment) async {
    try {
      await _service.toggleCommentLike(comment.id);
      if (!mounted) return;
      await _reloadComments();
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 댓글을 삭제한다.
  Future<void> _deleteComment(CommentModel comment) async {
    final confirmed = await _confirm(AppStrings.deleteCommentConfirm);
    if (confirmed != true) return;

    try {
      await _service.deleteComment(comment.id);
      if (!mounted) return;
      await _reloadComments();
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 글을 수정 화면으로 보낸다.
  Future<void> _editPost() async {
    final updated = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => PostEditorScreen(post: _post)),
    );
    if (updated == true) _load();
  }

  /// 글을 삭제하고 이전 화면으로 돌아간다.
  Future<void> _deletePost() async {
    final confirmed = await _confirm(AppStrings.deletePostConfirm);
    if (confirmed != true) return;

    try {
      await _service.deletePost(widget.postId);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  Future<bool?> _confirm(String message) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('취소')),
          TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('삭제')),
        ],
      ),
    );
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  /// 댓글 입력창 전용 둥근 테두리.
  static OutlineInputBorder _roundedBorder(Color color) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(22),
      borderSide: BorderSide(color: color),
    );
  }

  @override
  Widget build(BuildContext context) {
    final post = _post;

    return Scaffold(
      appBar: AppBar(
        title: Text(post?.category?.name ?? AppStrings.communityTitle),
        actions: [
          IconButton(icon: const Icon(Icons.share_outlined), onPressed: _share),
          if (post != null) _buildMenu(post),
        ],
      ),
      body: _buildBody(),
      bottomNavigationBar: post == null ? null : _buildCommentInput(),
    );
  }

  /// 우상단 메뉴.
  ///
  /// 내 글이면 수정/삭제, 남의 글이면 신고/차단, 운영자면 고정/숨김이 붙는다.
  /// 셋을 한 메뉴에 모으는 이유: 버튼을 나누면 헤더가 아이콘으로 가득 찬다.
  Widget _buildMenu(PostModel post) {
    final isAdmin = _me?.isAdmin == true;
    final canModerate = !post.isMine && _me != null;

    return PopupMenuButton<String>(
      onSelected: _onMenuSelected,
      itemBuilder: (context) => [
        if (post.isMine) ...[
          // 숨김 처리된 글은 수정할 수 없다. 수정이 곧 블라인드 해제 우회가 되기 때문이다.
          if (!post.isHidden) const PopupMenuItem(value: 'edit', child: Text('수정')),
          const PopupMenuItem(value: 'delete', child: Text('삭제')),
        ],
        if (canModerate) ...[
          const PopupMenuItem(value: 'report', child: Text(AppStrings.reportPost)),
          const PopupMenuItem(value: 'block', child: Text(AppStrings.blockUser)),
        ],
        if (isAdmin) ...[
          const PopupMenuDivider(),
          PopupMenuItem(
            value: 'pin',
            child: Text(post.isPinned ? AppStrings.adminUnpin : AppStrings.adminPin),
          ),
          PopupMenuItem(
            value: 'hide',
            child: Text(post.isHidden ? AppStrings.adminUnhide : AppStrings.adminHide),
          ),
        ],
      ],
    );
  }

  void _onMenuSelected(String value) {
    switch (value) {
      case 'edit':
        _editPost();
      case 'delete':
        _deletePost();
      case 'report':
        _reportPost();
      case 'block':
        _blockAuthor();
      case 'pin':
        _togglePinned();
      case 'hide':
        _toggleHidden();
    }
  }

  /// 글을 신고한다.
  Future<void> _reportPost() async {
    final result = await ReportSheet.show(context, targetLabel: '게시글');
    if (result == null) return;

    try {
      await _service.reportPost(widget.postId, result.reason, detail: result.detail);
      _showMessage('신고가 접수되었습니다. 운영자가 확인합니다.');
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 댓글을 신고한다.
  Future<void> _reportComment(CommentModel comment) async {
    final result = await ReportSheet.show(context, targetLabel: '댓글');
    if (result == null) return;

    try {
      await _service.reportComment(comment.id, result.reason, detail: result.detail);
      _showMessage('신고가 접수되었습니다.');
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 작성자를 차단한다.
  ///
  /// 차단하면 이 글도 목록에서 사라지므로 확인을 받는다.
  Future<void> _blockAuthor() async {
    final author = _post?.author;
    if (author == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${author.displayName}님을 차단할까요?'),
        content: const Text(
          '이 회원의 글과 댓글이 내 화면에서 보이지 않게 됩니다.\n'
          '상대방에게는 알려지지 않습니다.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('취소')),
          TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('차단')),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _service.blockUser(author.id);
      if (!mounted) return;
      // 차단한 사람의 글에 머물러 있을 이유가 없다.
      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 상단 고정을 토글한다. (운영자)
  Future<void> _togglePinned() async {
    final post = _post;
    if (post == null) return;

    try {
      await _service.setPinned(post.id, !post.isPinned);
      _showMessage(post.isPinned ? '고정을 해제했습니다.' : '상단에 고정했습니다.');
      await _load();
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  /// 숨김을 토글한다. (운영자)
  Future<void> _toggleHidden() async {
    final post = _post;
    if (post == null) return;

    try {
      await _service.setHidden(post.id, !post.isHidden);
      _showMessage(post.isHidden ? '숨김을 해제했습니다.' : '숨김 처리했습니다.');
      await _load();
    } on ApiException catch (error) {
      _showMessage(error.message);
    }
  }

  Widget _buildBody() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!));

    final post = _post!;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppSizes.paddingMedium),
        children: [
          if (post.isHidden) _buildHiddenNotice(),
          Text(post.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSizes.paddingMedium),
          _buildMeta(post),
          if (post.festival != null) ...[
            const SizedBox(height: AppSizes.paddingMedium),
            _buildFestivalLink(post),
          ],
          const SizedBox(height: AppSizes.paddingLarge),
          Text(post.content ?? '', style: Theme.of(context).textTheme.bodyLarge),
          if (post.images.isNotEmpty) ...[
            const SizedBox(height: AppSizes.paddingLarge),
            _buildImages(post),
          ],
          const SizedBox(height: AppSizes.paddingLarge),
          _buildReactionBar(post),
          const SizedBox(height: AppSizes.paddingLarge),
          const Divider(color: AppColors.line),
          const SizedBox(height: AppSizes.paddingMedium),
          Row(
            children: [
              Text(
                AppStrings.commentSection,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                '${post.commentCount}',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.accent,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSizes.paddingSmall),
          if (_comments.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSizes.paddingLarge),
              child: Center(child: Text(AppStrings.emptyComment)),
            ),
          for (final comment in _comments) ..._buildCommentGroup(comment),
          // 댓글 입력창에 가려지지 않도록 아래 여백을 준다.
          const SizedBox(height: AppSizes.paddingLarge),
        ],
      ),
    );
  }

  /// 숨김 처리된 글임을 작성자에게 알리는 안내.
  Widget _buildHiddenNotice() {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSizes.paddingMedium),
      padding: const EdgeInsets.all(AppSizes.paddingMedium),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Row(
        children: [
          Icon(Icons.visibility_off_outlined, size: 18),
          SizedBox(width: AppSizes.paddingSmall),
          Expanded(child: Text(AppStrings.hiddenPostNotice)),
        ],
      ),
    );
  }

  /// 작성자 / 날짜 / 조회수 줄.
  Widget _buildMeta(PostModel post) {
    final theme = Theme.of(context);
    final label = post.authorLabel;

    return Row(
      children: [
        // 프로필 이미지가 없는 회원이 대부분이라, 빈 원 대신 이름 첫 글자를 쓴다.
        CircleAvatar(
          radius: 16,
          backgroundColor: AppColors.accentSurface,
          child: Text(
            label.isNotEmpty ? label.characters.first : '?',
            style: theme.textTheme.bodySmall?.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.accent,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AppColors.ink,
                ),
              ),
              Text(
                '${toDisplayDate(post.createdAt)} · 조회 ${post.viewCount}',
                style: theme.textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// 연결된 축제로 이동하는 링크.
  Widget _buildFestivalLink(PostModel post) {
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => FestivalDetailScreen(festivalId: post.festival!.id),
        ),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: AppColors.surfaceTag,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Row(
          children: [
            const Icon(Icons.festival_outlined, size: 15, color: AppColors.inkSecondary),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                post.festival!.name,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: AppColors.ink,
                ),
              ),
            ),
            const Icon(Icons.chevron_right, size: 15, color: AppColors.inkMuted),
          ],
        ),
      ),
    );
  }

  /// 첨부 이미지.
  ///
  /// 세로로 이어 붙인다. 가로 스크롤로 두면 사진이 몇 장인지 알기 어렵고
  /// 본문을 읽으며 자연스럽게 넘기는 흐름이 끊긴다.
  Widget _buildImages(PostModel post) {
    return Column(
      children: [
        for (final image in post.images)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSizes.paddingSmall),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Image.network(
                image.fullUrl,
                width: double.infinity,
                fit: BoxFit.fitWidth,
                // 로딩 중 높이가 0이면 아래 내용이 위로 튀어 올랐다가 밀린다.
                loadingBuilder: (context, child, progress) => progress == null
                    ? child
                    : Container(
                        height: 200,
                        color: AppColors.surfaceTag,
                        alignment: Alignment.center,
                        child: const CircularProgressIndicator(strokeWidth: 2),
                      ),
                // 파일이 사라졌거나 저장소를 옮긴 뒤 경로가 틀어질 수 있다.
                errorBuilder: (context, error, stack) => Container(
                  height: 120,
                  color: AppColors.surfaceTag,
                  alignment: Alignment.center,
                  child: Text(
                    '사진을 불러올 수 없습니다.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  /// 반응 이모지 줄.
  ///
  /// 다섯 종류를 모두 보여주고, 내가 고른 것만 강조한다.
  /// 이미 고른 것을 다시 누르면 취소된다.
  Widget _buildReactionBar(PostModel post) {
    final mine = post.currentReaction;
    final summary = post.reactions;

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final type in reactionTypes)
          _ReactionChip(
            emoji: emojiOf(type),
            label: labelOf(type),
            count: summary?.countOf(type) ?? 0,
            selected: mine == type,
            onTap: () => _setReaction(type),
          ),
      ],
    );
  }

  /// 댓글 한 묶음(부모 댓글 + 답글들)을 위젯 목록으로 만든다.
  List<Widget> _buildCommentGroup(CommentModel comment) {
    return [
      const Divider(color: AppColors.lineSubtle),
      _CommentTile(
        comment: comment,
        onReply: () => setState(() => _replyTarget = comment),
        onToggleLike: () => _toggleCommentLike(comment),
        onDelete: () => _deleteComment(comment),
        onReport: () => _reportComment(comment),
      ),
      for (final reply in comment.replies)
        Padding(
          // 답글은 한 단계만 들여쓴다. 깊이가 1단계로 고정돼 있어 계산이 필요 없다.
          padding: const EdgeInsets.only(left: AppSizes.paddingLarge),
          child: _CommentTile(
            comment: reply,
            // 답글에 다는 답글도 부모 댓글에 붙으므로 대상은 최상위 댓글이다.
            onReply: () => setState(() => _replyTarget = comment),
            onToggleLike: () => _toggleCommentLike(reply),
            onDelete: () => _deleteComment(reply),
            onReport: () => _reportComment(reply),
          ),
        ),
    ];
  }

  /// 화면 하단의 댓글 입력창.
  Widget _buildCommentInput() {
    final target = _replyTarget;

    return SafeArea(
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.background,
          border: Border(top: BorderSide(color: AppColors.line)),
        ),
        padding: const EdgeInsets.fromLTRB(
          AppSizes.paddingLarge, AppSizes.paddingSmall,
          AppSizes.paddingMedium, AppSizes.paddingSmall,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 답글을 다는 중이면 대상을 보여주고 취소할 수 있게 한다.
            // 이게 없으면 사용자가 자기가 어디에 쓰고 있는지 알 수 없다.
            if (target != null)
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${target.authorLabel}님에게 답글 남기는 중',
                      style: Theme.of(context).textTheme.bodySmall,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 16),
                    color: AppColors.inkMuted,
                    onPressed: () => setState(() => _replyTarget = null),
                  ),
                ],
              ),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    maxLength: 1000,
                    style: Theme.of(context).textTheme.bodyMedium,
                    decoration: InputDecoration(
                      hintText: target == null ? AppStrings.commentHint : AppStrings.replyHint,
                      counterText: '',
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      // 입력창만 둥글게 둔다. 손으로 쓰는 자리라는 신호다.
                      border: _roundedBorder(AppColors.line),
                      enabledBorder: _roundedBorder(AppColors.line),
                      focusedBorder: _roundedBorder(AppColors.accent),
                    ),
                  ),
                ),
                IconButton(
                  icon: _isSubmittingComment
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send, size: 20),
                  color: AppColors.accent,
                  onPressed: _isSubmittingComment ? null : _submitComment,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// 반응 하나를 나타내는 칩.
///
/// 다섯 종류를 항상 모두 보여주고 내가 고른 것만 강조한다.
/// 선택된 것만 보여주면 "다른 반응도 남길 수 있다"는 사실이 드러나지 않는다.
class _ReactionChip extends StatelessWidget {
  final String emoji;
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  const _ReactionChip({
    required this.emoji,
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: selected ? AppColors.accentSurface : Colors.transparent,
          border: Border.all(color: selected ? AppColors.accent : AppColors.line),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 14)),
            const SizedBox(width: 6),
            Text(
              '$count',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: selected ? FontWeight.w500 : FontWeight.w400,
                // 0인 반응까지 진하게 두면 목록이 균일해져 실제 반응이 묻힌다.
                color: selected
                    ? AppColors.accent
                    : (count > 0 ? AppColors.inkSecondary : AppColors.inkMuted),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 댓글 한 건을 그리는 위젯.
class _CommentTile extends StatelessWidget {
  final CommentModel comment;
  final VoidCallback onReply;
  final VoidCallback onToggleLike;
  final VoidCallback onDelete;
  final VoidCallback onReport;

  const _CommentTile({
    required this.comment,
    required this.onReply,
    required this.onToggleLike,
    required this.onDelete,
    required this.onReport,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDeleted = comment.isDeleted;
    final label = comment.authorLabel;

    return Container(
      // 대댓글은 부모와 같은 묶음임을 바탕색으로 알린다. 들여쓰기는 화면에서 처리한다.
      color: comment.isReply ? AppColors.surfaceMuted : Colors.transparent,
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: isDeleted
                ? AppColors.lineSubtle
                : (comment.isMine ? AppColors.accentSurface : AppColors.surfaceTag),
            child: isDeleted
                ? null
                : Text(
                    label.isNotEmpty ? label.characters.first : '?',
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontSize: 11,
                      color: comment.isMine ? AppColors.accent : AppColors.inkSecondary,
                    ),
                  ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: isDeleted ? _buildDeleted(theme) : _buildContent(context, theme, label),
          ),
        ],
      ),
    );
  }

  /// 삭제된 댓글: 자리만 남기고 내용과 작성자를 모두 가린다.
  /// 어떤 동작 버튼도 두지 않는다.
  Widget _buildDeleted(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text(
        comment.content,
        style: theme.textTheme.bodyMedium?.copyWith(
          color: AppColors.inkDisabled,
          fontStyle: FontStyle.italic,
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, ThemeData theme, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AppColors.ink,
              ),
            ),
            if (comment.isMine) ...[
              const SizedBox(width: 5),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.accentBorder),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: Text(
                  '내 댓글',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: 10,
                    color: AppColors.accent,
                  ),
                ),
              ),
            ],
            const SizedBox(width: 6),
            Text(toDisplayDate(comment.createdAt), style: theme.textTheme.bodySmall),
          ],
        ),
        const SizedBox(height: 4),
        Text(comment.content, style: theme.textTheme.bodyMedium),
        const SizedBox(height: 2),
        Row(
          children: [
            _CommentAction(
              icon: comment.isLiked ? Icons.thumb_up : Icons.thumb_up_outlined,
              label: '${comment.likeCount}',
              highlighted: comment.isLiked,
              onTap: onToggleLike,
            ),
            const SizedBox(width: 16),
            _CommentAction(label: '답글', onTap: onReply),
            if (comment.isMine) ...[
              const SizedBox(width: 16),
              _CommentAction(label: '삭제', onTap: onDelete),
            ] else ...[
              const SizedBox(width: 16),
              _CommentAction(label: '신고', onTap: onReport),
            ],
          ],
        ),
      ],
    );
  }
}

/// 댓글 아래 줄의 작은 동작 버튼.
class _CommentAction extends StatelessWidget {
  final IconData? icon;
  final String label;
  final bool highlighted;
  final VoidCallback onTap;

  const _CommentAction({
    required this.label,
    required this.onTap,
    this.icon,
    this.highlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = highlighted ? AppColors.accent : AppColors.inkMuted;

    return InkWell(
      onTap: onTap,
      child: Padding(
        // 글자만 놓으면 터치 영역이 너무 작아진다. 위아래로 여백을 준다.
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 13, color: color),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: color),
            ),
          ],
        ),
      ),
    );
  }
}
