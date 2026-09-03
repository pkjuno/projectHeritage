import 'package:flutter/material.dart';
import '../models/post_model.dart';
import '../utils/constants.dart';
import '../utils/date_format.dart';
import '../utils/reaction_types.dart';

/// 목록에서 게시글 한 건을 보여주는 공통 카드.
///
/// 게시판 목록, 대시보드, 내 활동에서 모두 쓰므로 한 곳에 둔다.
class PostCard extends StatelessWidget {
  final PostModel post;
  final VoidCallback? onTap;

  /// 게시판 이름을 함께 보여줄지 여부.
  /// 특정 게시판 안에서는 모든 글이 같은 게시판이라 이름이 반복될 뿐이다.
  final bool showCategory;

  const PostCard({super.key, required this.post, this.onTap, this.showCategory = true});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListTile(
      onTap: onTap,
      title: Row(
        children: [
          // 운영자가 고정한 글은 목록 어디에 있든 바로 알아볼 수 있어야 한다.
          if (post.isPinned) ...[
            Icon(Icons.push_pin, size: 14, color: theme.colorScheme.primary),
            const SizedBox(width: 4),
          ],
          Expanded(
            child: Text(
              post.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleSmall,
            ),
          ),
        ],
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 연결된 축제가 있으면 어떤 축제 이야기인지 먼저 보여준다.
            if (post.festival != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    const Icon(Icons.festival, size: 13),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        post.festival!.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
              ),
            Wrap(
              spacing: AppSizes.paddingSmall,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (showCategory && post.category != null)
                  Text(post.category!.name, style: theme.textTheme.bodySmall),
                Text(post.authorLabel, style: theme.textTheme.bodySmall),
                Text(toDisplayDate(post.createdAt), style: theme.textTheme.bodySmall),
                _Counter(icon: Icons.visibility_outlined, count: post.viewCount),
                _Counter(icon: Icons.chat_bubble_outline, count: post.commentCount),
                _ReactionCounter(post: post),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// 아이콘 + 숫자 한 쌍.
class _Counter extends StatelessWidget {
  final IconData icon;
  final int count;

  const _Counter({required this.icon, required this.count});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13),
        const SizedBox(width: 2),
        Text('$count', style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

/// 반응 수 표시.
///
/// 내가 남긴 반응이 있으면 그 이모지를, 없으면 기본 하트를 보여준다.
/// 목록에서도 "내가 이미 눌렀는지"가 바로 보여야 한다.
class _ReactionCounter extends StatelessWidget {
  final PostModel post;

  const _ReactionCounter({required this.post});

  @override
  Widget build(BuildContext context) {
    final mine = post.currentReaction;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (mine != null)
          Text(emojiOf(mine), style: const TextStyle(fontSize: 12))
        else
          const Icon(Icons.favorite_border, size: 13),
        const SizedBox(width: 2),
        Text('${post.reactionCount}', style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
