import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../config/app_config.dart';
import '../../models/comment_model.dart';
import '../../models/post_model.dart';
import '../../services/api_service.dart';
import '../../services/community_service.dart';
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
  final TextEditingController _commentController = TextEditingController();

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

  @override
  Widget build(BuildContext context) {
    final post = _post;

    return Scaffold(
      appBar: AppBar(
        title: Text(post?.category?.name ?? AppStrings.communityTitle),
        actions: [
          IconButton(icon: const Icon(Icons.share_outlined), onPressed: _share),
          // 수정/삭제는 내 글일 때만 보여준다. (서버도 동일하게 막는다)
          if (post != null && post.isMine)
            PopupMenuButton<String>(
              onSelected: (value) => value == 'edit' ? _editPost() : _deletePost(),
              itemBuilder: (context) => [
                // 숨김 처리된 글은 수정할 수 없다. 수정이 곧 블라인드 해제 우회가 되기 때문이다.
                if (!post.isHidden)
                  const PopupMenuItem(value: 'edit', child: Text('수정')),
                const PopupMenuItem(value: 'delete', child: Text('삭제')),
              ],
            ),
        ],
      ),
      body: _buildBody(),
      bottomNavigationBar: post == null ? null : _buildCommentInput(),
    );
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
          const SizedBox(height: AppSizes.paddingSmall),
          _buildMeta(post),
          if (post.festival != null) _buildFestivalLink(post),
          const Divider(height: AppSizes.paddingLarge),
          Text(post.content ?? '', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: AppSizes.paddingLarge),
          _buildReactionBar(post),
          const Divider(height: AppSizes.paddingLarge),
          Text(
            '${AppStrings.commentSection} ${post.commentCount}',
            style: Theme.of(context).textTheme.titleSmall,
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
    final style = Theme.of(context).textTheme.bodySmall;

    return Row(
      children: [
        Text(post.authorLabel, style: style),
        const SizedBox(width: AppSizes.paddingSmall),
        Text(toDisplayDate(post.createdAt), style: style),
        const Spacer(),
        Icon(Icons.visibility_outlined, size: 14, color: style?.color),
        const SizedBox(width: 2),
        Text('${post.viewCount}', style: style),
      ],
    );
  }

  /// 연결된 축제로 이동하는 링크.
  Widget _buildFestivalLink(PostModel post) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSizes.paddingSmall),
      child: ActionChip(
        avatar: const Icon(Icons.festival, size: 16),
        label: Text(post.festival!.name),
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => FestivalDetailScreen(festivalId: post.festival!.id),
          ),
        ),
      ),
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
      spacing: AppSizes.paddingSmall,
      children: [
        for (final type in reactionTypes)
          FilterChip(
            selected: mine == type,
            onSelected: (_) => _setReaction(type),
            avatar: Text(emojiOf(type)),
            label: Text('${labelOf(type)} ${summary?.countOf(type) ?? 0}'),
            showCheckmark: false,
          ),
      ],
    );
  }

  /// 댓글 한 묶음(부모 댓글 + 답글들)을 위젯 목록으로 만든다.
  List<Widget> _buildCommentGroup(CommentModel comment) {
    return [
      _CommentTile(
        comment: comment,
        onReply: () => setState(() => _replyTarget = comment),
        onToggleLike: () => _toggleCommentLike(comment),
        onDelete: () => _deleteComment(comment),
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
          ),
        ),
    ];
  }

  /// 화면 하단의 댓글 입력창.
  Widget _buildCommentInput() {
    final target = _replyTarget;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSizes.paddingSmall),
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
                    icon: const Icon(Icons.close, size: 18),
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
                    decoration: InputDecoration(
                      hintText: target == null ? AppStrings.commentHint : AppStrings.replyHint,
                      isDense: true,
                      counterText: '',
                      border: const OutlineInputBorder(),
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
                      : const Icon(Icons.send),
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

/// 댓글 한 건을 그리는 위젯.
class _CommentTile extends StatelessWidget {
  final CommentModel comment;
  final VoidCallback onReply;
  final VoidCallback onToggleLike;
  final VoidCallback onDelete;

  const _CommentTile({
    required this.comment,
    required this.onReply,
    required this.onToggleLike,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDeleted = comment.isDeleted;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSizes.paddingSmall),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                // 삭제된 댓글은 서버가 작성자를 가려서 내려준다.
                isDeleted ? '' : comment.authorLabel,
                style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: AppSizes.paddingSmall),
              Text(toDisplayDate(comment.createdAt), style: theme.textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            comment.content,
            style: isDeleted
                // 삭제된 댓글은 자리만 남은 것이므로 흐리게 보여준다.
                ? theme.textTheme.bodyMedium?.copyWith(
                    color: theme.disabledColor,
                    fontStyle: FontStyle.italic,
                  )
                : theme.textTheme.bodyMedium,
          ),
          // 삭제된 댓글에는 어떤 동작 버튼도 두지 않는다.
          if (!isDeleted)
            Row(
              children: [
                TextButton.icon(
                  onPressed: onToggleLike,
                  icon: Icon(
                    comment.isLiked ? Icons.thumb_up : Icons.thumb_up_outlined,
                    size: 14,
                  ),
                  label: Text('${comment.likeCount}'),
                  style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                ),
                TextButton(
                  onPressed: onReply,
                  style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                  child: const Text('답글'),
                ),
                if (comment.isMine)
                  TextButton(
                    onPressed: onDelete,
                    style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                    child: const Text('삭제'),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}
