import 'package:flutter/material.dart';
import '../models/moderation_model.dart';
import '../theme/app_colors.dart';
import '../utils/constants.dart';

/// 신고 사유를 고르는 바텀시트.
///
/// 게시글과 댓글이 같은 사유 목록을 쓰므로 한 위젯으로 둔다.
/// 선택 결과를 돌려주기만 하고, 실제 신고 요청은 호출한 쪽이 보낸다.
class ReportSheet extends StatefulWidget {
  /// 무엇을 신고하는지. ('게시글' 또는 '댓글')
  final String targetLabel;

  const ReportSheet({super.key, required this.targetLabel});

  /// 바텀시트를 띄우고 선택 결과를 받는다. 취소하면 null.
  static Future<({ReportReason reason, String? detail})?> show(
    BuildContext context, {
    required String targetLabel,
  }) {
    return showModalBottomSheet<({ReportReason reason, String? detail})>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      builder: (_) => ReportSheet(targetLabel: targetLabel),
    );
  }

  @override
  State<ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<ReportSheet> {
  final TextEditingController _detailController = TextEditingController();
  ReportReason? _selected;

  @override
  void dispose() {
    _detailController.dispose();
    super.dispose();
  }

  /// 제출 가능한 상태인지. '기타'는 설명이 있어야 한다.
  bool get _canSubmit {
    if (_selected == null) return false;
    if (_selected!.requiresDetail) return _detailController.text.trim().isNotEmpty;
    return true;
  }

  void _submit() {
    final detail = _detailController.text.trim();
    Navigator.of(context).pop((
      reason: _selected!,
      detail: detail.isEmpty ? null : detail,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      // 키보드가 올라와도 입력칸이 가려지지 않게 한다.
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSizes.paddingLarge, AppSizes.paddingLarge,
                AppSizes.paddingLarge, AppSizes.paddingSmall,
              ),
              child: Text('${widget.targetLabel} 신고', style: theme.textTheme.titleMedium),
            ),

            // 신고가 곧 삭제가 아니라는 점을 미리 알린다.
            // 이 안내가 없으면 "신고했는데 왜 그대로냐"는 오해가 생긴다.
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSizes.paddingLarge),
              child: Text(
                '접수된 신고는 운영자가 확인합니다. 신고만으로 바로 삭제되지는 않습니다.',
                style: theme.textTheme.bodySmall,
              ),
            ),
            const SizedBox(height: AppSizes.paddingMedium),

            RadioGroup<ReportReason>(
              groupValue: _selected,
              onChanged: (value) => setState(() => _selected = value),
              child: Column(
                children: [
                  for (final reason in ReportReason.values)
                    RadioListTile<ReportReason>(
                      value: reason,
                      title: Text(reason.label, style: theme.textTheme.bodyMedium),
                      activeColor: AppColors.accent,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: AppSizes.paddingMedium,
                      ),
                      dense: true,
                    ),
                ],
              ),
            ),

            // '기타'를 골랐을 때만 설명 칸을 보여준다.
            if (_selected?.requiresDetail == true)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSizes.paddingLarge, AppSizes.paddingSmall,
                  AppSizes.paddingLarge, 0,
                ),
                child: TextField(
                  controller: _detailController,
                  maxLines: 3,
                  maxLength: 500,
                  onChanged: (_) => setState(() {}),
                  style: theme.textTheme.bodyMedium,
                  decoration: const InputDecoration(
                    hintText: '어떤 점이 문제인지 알려주세요.',
                    counterText: '',
                  ),
                ),
              ),

            Padding(
              padding: const EdgeInsets.all(AppSizes.paddingLarge),
              child: ElevatedButton(
                onPressed: _canSubmit ? _submit : null,
                child: const Text('신고하기'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
