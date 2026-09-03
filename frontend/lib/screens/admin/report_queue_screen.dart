import 'package:flutter/material.dart';
import '../../models/moderation_model.dart';
import '../../services/api_service.dart';
import '../../services/community_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/constants.dart';
import '../../utils/date_format.dart';
import '../community/post_detail_screen.dart';

/// 운영자 신고 처리 화면.
///
/// 게시글 신고와 댓글 신고를 **한 목록**에 보여준다.
/// 두 화면으로 나누면 한쪽을 안 보게 되고, 안 보는 쪽의 신고가 쌓인다.
class ReportQueueScreen extends StatefulWidget {
  const ReportQueueScreen({super.key});

  @override
  State<ReportQueueScreen> createState() => _ReportQueueScreenState();
}

class _ReportQueueScreenState extends State<ReportQueueScreen> {
  final CommunityService _service = CommunityService();

  List<ReportModel> _reports = [];
  String _status = 'pending';
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);

    try {
      final result = await _service.fetchReports(status: _status);
      if (!mounted) return;
      setState(() {
        _reports = result.items;
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

  void _changeStatus(String status) {
    if (_status == status) return;
    setState(() => _status = status);
    _load();
  }

  /// 신고를 처리한다.
  ///
  /// 숨김은 별도 선택지로 둔다. 처리와 숨김을 한 버튼으로 묶으면
  /// "확인만 하고 싶은데 글이 사라지는" 실수가 생긴다.
  Future<void> _handle(ReportModel report, {required String status, bool hide = false}) async {
    try {
      await _service.handleReport(report, status: status, hide: hide);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(hide ? '처리하고 숨겼습니다.' : '처리했습니다.')),
      );
      await _load();
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  /// 처리 방식을 고르는 시트를 띄운다.
  Future<void> _openActions(ReportModel report) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: AppSizes.paddingSmall),
            ListTile(
              leading: const Icon(Icons.visibility_off_outlined, color: AppColors.danger),
              title: const Text('조치함 + 숨김'),
              subtitle: const Text('신고를 처리하고 대상을 가립니다.'),
              onTap: () => Navigator.of(context).pop('hide'),
            ),
            ListTile(
              leading: const Icon(Icons.check),
              title: const Text('조치함'),
              subtitle: const Text('처리 완료로 표시만 합니다. 대상은 그대로 둡니다.'),
              onTap: () => Navigator.of(context).pop('resolved'),
            ),
            ListTile(
              leading: const Icon(Icons.close),
              title: const Text('문제 없음'),
              subtitle: const Text('신고를 반려합니다.'),
              onTap: () => Navigator.of(context).pop('rejected'),
            ),
            const SizedBox(height: AppSizes.paddingSmall),
          ],
        ),
      ),
    );

    if (action == null) return;
    if (action == 'hide') {
      await _handle(report, status: 'resolved', hide: true);
    } else {
      await _handle(report, status: action);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text(AppStrings.reportQueueTitle),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSizes.paddingLarge, 0, AppSizes.paddingLarge, AppSizes.paddingSmall,
            ),
            child: Row(
              children: [
                _StatusChip(
                  label: '대기',
                  selected: _status == 'pending',
                  onTap: () => _changeStatus('pending'),
                ),
                const SizedBox(width: 6),
                _StatusChip(
                  label: '조치함',
                  selected: _status == 'resolved',
                  onTap: () => _changeStatus('resolved'),
                ),
                const SizedBox(width: 6),
                _StatusChip(
                  label: '반려',
                  selected: _status == 'rejected',
                  onTap: () => _changeStatus('rejected'),
                ),
              ],
            ),
          ),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!));

    if (_reports.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            const SizedBox(height: 120),
            Center(
              child: Column(
                children: [
                  const Icon(Icons.inbox_outlined, size: 26, color: AppColors.inkDisabled),
                  const SizedBox(height: AppSizes.paddingSmall),
                  Text(
                    _status == 'pending'
                        ? '처리할 신고가 없습니다.'
                        : '해당 상태의 신고가 없습니다.',
                    style: Theme.of(context).textTheme.labelMedium,
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        itemCount: _reports.length,
        separatorBuilder: (_, __) => const Divider(color: AppColors.lineSubtle),
        itemBuilder: (context, index) => _ReportTile(
          report: _reports[index],
          // 대기 중인 신고만 처리할 수 있다.
          onAction: _status == 'pending' ? () => _openActions(_reports[index]) : null,
          onOpen: () => _openTarget(_reports[index]),
        ),
      ),
    );
  }

  /// 신고 대상을 열어 실제 내용을 확인한다.
  ///
  /// 목록의 한 줄 요약만 보고 판단하게 두면 오판이 나온다.
  Future<void> _openTarget(ReportModel report) async {
    final postId = report.isPost ? report.post?.id : report.comment?.postId;
    if (postId == null) return;

    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PostDetailScreen(postId: postId)),
    );
    if (mounted) _load();
  }
}

/// 처리 상태 필터 칩.
class _StatusChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _StatusChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? AppColors.accentSurface : Colors.transparent,
          border: Border.all(color: selected ? AppColors.accent : AppColors.line),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: selected ? AppColors.accent : AppColors.inkSecondary,
            fontWeight: selected ? FontWeight.w500 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

/// 신고 1건.
class _ReportTile extends StatelessWidget {
  final ReportModel report;
  final VoidCallback? onAction;
  final VoidCallback onOpen;

  const _ReportTile({required this.report, required this.onAction, required this.onOpen});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final alreadyHidden =
        report.isPost ? report.post?.isHidden == true : report.comment?.isDeleted == true;

    return InkWell(
      onTap: onOpen,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSizes.paddingLarge,
          vertical: AppSizes.paddingMedium,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _Tag(label: report.isPost ? '게시글' : '댓글'),
                const SizedBox(width: 6),
                _Tag(label: report.reasonLabel, accent: true),
                // 이미 가려진 대상은 표시해 운영자가 중복 조치하지 않게 한다.
                if (alreadyHidden) ...[
                  const SizedBox(width: 6),
                  const _Tag(label: '가려짐'),
                ],
                const Spacer(),
                Text(toDisplayDate(report.createdAt), style: theme.textTheme.bodySmall),
              ],
            ),
            const SizedBox(height: AppSizes.paddingSmall),
            Text(
              report.targetSummary,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodyMedium?.copyWith(color: AppColors.ink),
            ),
            if (report.detail != null) ...[
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceTag,
                  borderRadius: BorderRadius.circular(3),
                ),
                child: Text(report.detail!, style: theme.textTheme.bodySmall),
              ),
            ],
            const SizedBox(height: AppSizes.paddingSmall),
            Row(
              children: [
                Expanded(
                  child: Text(
                    '신고자 ${report.reporter?.displayName ?? '(탈퇴)'}',
                    style: theme.textTheme.bodySmall,
                  ),
                ),
                if (onAction != null)
                  OutlinedButton(
                    onPressed: onAction,
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 34),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                    ),
                    child: const Text('처리'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// 작은 분류 태그.
class _Tag extends StatelessWidget {
  final String label;
  final bool accent;

  const _Tag({required this.label, this.accent = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: accent ? AppColors.accentSurface : AppColors.surfaceTag,
        borderRadius: BorderRadius.circular(2),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          fontSize: 10,
          color: accent ? AppColors.accent : AppColors.inkSecondary,
        ),
      ),
    );
  }
}
