import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// 아이콘(또는 이모지) + 숫자 한 쌍.
///
/// 조회수·댓글수·반응수처럼 목록과 상세 여러 곳에서 같은 모양으로 반복되므로
/// 한 위젯으로 모아 크기와 간격이 화면마다 어긋나지 않게 한다.
class MetaCounter extends StatelessWidget {
  final IconData icon;

  /// 아이콘 대신 보여줄 이모지. (내가 남긴 반응 표시)
  final String? emoji;

  final int count;

  /// 강조 여부. 내가 반응을 남긴 경우 등에 켠다.
  final bool highlighted;

  const MetaCounter({
    super.key,
    required this.icon,
    required this.count,
    this.emoji,
    this.highlighted = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = highlighted ? AppColors.accent : AppColors.inkMuted;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (emoji != null)
          Text(emoji!, style: const TextStyle(fontSize: 12))
        else
          Icon(icon, size: 13, color: color),
        const SizedBox(width: 3),
        Text(
          '$count',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: color),
        ),
      ],
    );
  }
}
