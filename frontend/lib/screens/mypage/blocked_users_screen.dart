import 'package:flutter/material.dart';
import '../../models/moderation_model.dart';
import '../../services/api_service.dart';
import '../../services/community_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/constants.dart';

/// 내가 차단한 회원 목록 화면.
///
/// 차단은 조용히 걸리는 설정이라, 해제할 수 있는 자리가 없으면
/// 왜 어떤 사람의 글이 안 보이는지 알 방법이 없어진다.
class BlockedUsersScreen extends StatefulWidget {
  const BlockedUsersScreen({super.key});

  @override
  State<BlockedUsersScreen> createState() => _BlockedUsersScreenState();
}

class _BlockedUsersScreenState extends State<BlockedUsersScreen> {
  final CommunityService _service = CommunityService();

  List<BlockedUserModel> _blocks = [];
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
      final result = await _service.fetchBlocks();
      if (!mounted) return;
      setState(() {
        _blocks = result.items;
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

  Future<void> _unblock(BlockedUserModel block) async {
    try {
      await _service.unblockUser(block.blockedUser.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${block.blockedUser.displayName}님의 차단을 해제했습니다.')),
      );
      await _load();
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(title: const Text(AppStrings.blockedListTitle)),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!));

    if (_blocks.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            const SizedBox(height: 120),
            Center(
              child: Text(
                AppStrings.emptyBlocked,
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        itemCount: _blocks.length,
        separatorBuilder: (_, __) => const Divider(color: AppColors.lineSubtle),
        itemBuilder: (context, index) {
          final block = _blocks[index];
          final image = block.blockedUser.profileImageFullUrl;

          return ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSizes.paddingLarge,
              vertical: 4,
            ),
            leading: CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.surfaceTag,
              backgroundImage: image != null ? NetworkImage(image) : null,
              child: image == null
                  ? Text(
                      block.blockedUser.displayName.characters.first,
                      style: Theme.of(context).textTheme.bodySmall,
                    )
                  : null,
            ),
            title: Text(
              block.blockedUser.displayName,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.ink),
            ),
            trailing: OutlinedButton(
              onPressed: () => _unblock(block),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 34),
                padding: const EdgeInsets.symmetric(horizontal: 14),
              ),
              child: const Text(AppStrings.unblockUser),
            ),
          );
        },
      ),
    );
  }
}
