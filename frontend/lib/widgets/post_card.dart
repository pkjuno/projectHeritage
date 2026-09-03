import 'package:flutter/material.dart';
import '../models/post_model.dart';
import '../theme/app_colors.dart';
import '../utils/constants.dart';
import '../utils/date_format.dart';
import '../utils/reaction_types.dart';
import 'meta_counter.dart';

/// 목록에서 게시글 한 건을 보여주는 공통 카드.
///
/// 게시판 목록, 대시보드, 내 활동에서 모두 쓰므로 한 곳에 둔다.
class PostCard extends StatelessWidget {
  final PostModel post;
  final VoidCallback? onTap;

  /// 게시판 이름을 함께 보여줄지 여부.
  /// 특정 게시판 안에서는 모든 글이 같은 게시판이라 이름이 반복될 뿐이다.
  final bool showCategory;

  /// 본문 미리보기를 보여줄지 여부. (게시판 목록에서만 켠다)
  final bool showPreview;

  const PostCard({
    super.key,
    required this.post,
    this.onTap,
    this.showCategory = true,
    this.showPreview = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final preview = post.summaryText?.trim();

    return InkWell(
      onTap: onTap,
      child: Container(
        // 고정된 글은 목록 어디에 있든 바로 알아볼 수 있게 바탕을 달리한다.
        color: post.isPinned ? AppColors.surfaceMuted : Colors.transparent,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSizes.paddingLarge,
          vertical: AppSizes.paddingMedium,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildTitle(theme),

            if (showPreview && preview != null && preview.isNotEmpty) ...[
              const SizedBox(height: AppSizes.paddingSmall),
              Text(
                preview,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelMedium?.copyWith(height: 1.6),
              ),
            ],

            // 연결된 축제가 있으면 어떤 축제 이야기인지 태그로 보여준다.
            if (post.festival != null) ...[
              const SizedBox(height: AppSizes.paddingSmall),
              _FestivalTag(name: post.festival!.name),
            ],

            const SizedBox(height: AppSizes.paddingSmall),
            _buildMeta(theme),
          ],
        ),
      ),
    );
  }

  /// 고정 아이콘 + 제목.
  Widget _buildTitle(ThemeData theme) {
    final titleStyle = theme.textTheme.titleSmall?.copyWith(
      // 숨김 처리된 글은 제목부터 흐리게 보여 상태를 먼저 알린다.
      color: post.isHidden ? AppColors.inkMuted : AppColors.ink,
    );

    if (!post.isPinned) {
      return Text(post.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: titleStyle);
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 3, right: 6),
          child: Icon(Icons.push_pin_outlined, size: 14, color: AppColors.accent),
        ),
        Expanded(
          child: Text(post.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: titleStyle),
        ),
      ],
    );
  }

  /// 게시판 · 작성자 · 시각 + 카운터.
  Widget _buildMeta(ThemeData theme) {
    return Row(
      children: [
        Expanded(
          child: Wrap(
            spacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              if (showCategory && post.category != null)
                Text(
                  post.category!.name,
                  style: theme.textTheme.bodySmall?.copyWith(color: AppColors.accent),
                ),
              Text(post.authorLabel, style: theme.textTheme.bodySmall),
              Text(toDisplayDate(post.createdAt), style: theme.textTheme.bodySmall),
            ],
          ),
        ),
        MetaCounter(icon: Icons.visibility_outlined, count: post.viewCount),
        const SizedBox(width: 12),
        MetaCounter(icon: Icons.chat_bubble_outline, count: post.commentCount),
        const SizedBox(width: 12),
        // 내가 남긴 반응이 있으면 그 이모지를 대신 보여준다.
        // 목록에서도 "내가 이미 눌렀는지"가 바로 보여야 한다.
        MetaCounter(
          icon: Icons.favorite_border,
          emoji: post.currentReaction != null ? emojiOf(post.currentReaction) : null,
          count: post.reactionCount,
          highlighted: post.currentReaction != null,
        ),
      ],
    );
  }
}

/// 연결된 축제를 나타내는 작은 태그.
class _FestivalTag extends StatelessWidget {
  final String name;

  const _FestivalTag({required this.name});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.surfaceTag,
        borderRadius: BorderRadius.circular(3),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.festival_outlined, size: 12, color: AppColors.inkSecondary),
          const SizedBox(width: 4),
          Text(name, style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppColors.inkSecondary,
          )),
        ],
      ),
    );
  }
}
