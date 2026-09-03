import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../models/user_model.dart';
import '../../services/api_service.dart';
import '../../services/social_account_service.dart';
import '../../services/user_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_button.dart';

/// 마이페이지 화면.
/// - 프로필 관리: 이미지 등록/변경/삭제
/// - 회원정보: 닉네임 수정
/// - 간편로그인: 카카오/네이버/구글 연결 및 해지
class MyPageScreen extends StatefulWidget {
  const MyPageScreen({super.key});

  @override
  State<MyPageScreen> createState() => _MyPageScreenState();
}

class _MyPageScreenState extends State<MyPageScreen> {
  final UserService _userService = UserService();
  final SocialAccountService _socialAccountService = SocialAccountService();
  final ImagePicker _imagePicker = ImagePicker();
  final TextEditingController _nicknameController = TextEditingController();

  UserModel? _user;
  bool _isLoading = true;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadMyPage();
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    super.dispose();
  }

  /// 마이페이지 정보를 서버에서 불러와 화면 상태에 반영한다.
  Future<void> _loadMyPage() async {
    setState(() => _isLoading = true);
    try {
      final user = await _userService.fetchMe();
      if (!mounted) return;
      setState(() {
        _user = user;
        _nicknameController.text = user.nickname ?? '';
      });
    } on ApiException catch (error) {
      _showMessage(error.message);
    } catch (error) {
      _showMessage(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// 서버 요청 공통 처리 - 로딩 상태를 관리하고 성공 시 최신 회원정보로 갱신한다.
  Future<void> _runAction(Future<UserModel?> Function() action, String successMessage) async {
    setState(() => _isSubmitting = true);
    try {
      final updated = await action();
      if (!mounted) return;

      // 갱신된 회원정보를 돌려받지 못한 경우(연결/해지 등)에는 다시 조회한다.
      final user = updated ?? await _userService.fetchMe();
      if (!mounted) return;

      setState(() {
        _user = user;
        _nicknameController.text = user.nickname ?? '';
      });
      _showMessage(successMessage);
    } on ApiException catch (error) {
      _showMessage(error.message);
    } catch (error) {
      _showMessage(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  /// 갤러리에서 이미지를 선택해 프로필 이미지로 등록한다.
  Future<void> _pickAndUploadImage() async {
    final picked = await _imagePicker.pickImage(
      source: ImageSource.gallery,
      // 업로드 용량(서버 기본 5MB)을 넘지 않도록 미리 크기를 줄인다.
      maxWidth: 1024,
      imageQuality: 85,
    );
    if (picked == null) return; // 사용자가 선택을 취소한 경우

    await _runAction(
      () => _userService.uploadProfileImage(File(picked.path)),
      '프로필 이미지가 변경되었습니다.',
    );
  }

  /// 등록된 프로필 이미지를 삭제한다.
  Future<void> _deleteImage() async {
    await _runAction(() => _userService.deleteProfileImage(), '프로필 이미지가 삭제되었습니다.');
  }

  /// 닉네임을 저장한다.
  Future<void> _saveNickname() async {
    final nickname = _nicknameController.text.trim();
    await _runAction(
      () => _userService.updateMyInfo(nickname: nickname),
      '회원정보가 저장되었습니다.',
    );
  }

  /// 간편로그인을 연결한다.
  Future<void> _linkSocial(AuthProvider provider) async {
    await _runAction(() async {
      final linked = await _socialAccountService.link(provider);
      // 사용자가 SNS 로그인을 취소하면 서버 요청 없이 종료된다.
      if (!linked) return _user;
      return null; // 최신 정보를 다시 조회하도록 null 반환
    }, '${authProviderLabel(provider)} 계정이 연결되었습니다.');
  }

  /// 간편로그인 연결을 해지한다. (확인 다이얼로그 표시)
  Future<void> _unlinkSocial(AuthProvider provider) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${authProviderLabel(provider)} ${AppStrings.unlinkButton}'),
        content: const Text(AppStrings.unlinkConfirmMessage),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('취소')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(AppStrings.unlinkButton),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    await _runAction(() async {
      await _socialAccountService.unlink(provider);
      return null;
    }, '${authProviderLabel(provider)} 연결이 해지되었습니다.');
  }

  /// 안내/에러 메시지를 스낵바로 보여준다.
  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.myPageTitle)),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _user == null
              ? const Center(child: Text(AppStrings.errorMessage))
              : RefreshIndicator(
                  onRefresh: _loadMyPage,
                  child: ListView(
                    padding: const EdgeInsets.all(AppSizes.paddingLarge),
                    children: [
                      _buildProfileSection(),
                      const SizedBox(height: AppSizes.paddingLarge),
                      _buildMyInfoSection(),
                      const SizedBox(height: AppSizes.paddingLarge),
                      _buildSocialSection(),
                    ],
                  ),
                ),
    );
  }

  /// 프로필 관리 영역 (이미지 등록/변경/삭제)
  Widget _buildProfileSection() {
    final user = _user!;
    final imageUrl = user.profileImageFullUrl;

    return Column(
      children: [
        CircleAvatar(
          radius: 48,
          backgroundImage: imageUrl != null ? NetworkImage(imageUrl) : null,
          child: imageUrl == null ? const Icon(Icons.person, size: 48) : null,
        ),
        const SizedBox(height: AppSizes.paddingSmall),
        Text(user.displayName, style: Theme.of(context).textTheme.titleMedium),
        Text(user.email, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: AppSizes.paddingSmall),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextButton.icon(
              onPressed: _isSubmitting ? null : _pickAndUploadImage,
              icon: const Icon(Icons.photo_camera),
              label: const Text(AppStrings.changeImageButton),
            ),
            if (imageUrl != null)
              TextButton.icon(
                onPressed: _isSubmitting ? null : _deleteImage,
                icon: const Icon(Icons.delete_outline),
                label: const Text(AppStrings.deleteImageButton),
              ),
          ],
        ),
      ],
    );
  }

  /// 회원정보 영역 (닉네임 수정)
  Widget _buildMyInfoSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(AppStrings.myInfoSectionTitle, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSizes.paddingSmall),
        TextField(
          controller: _nicknameController,
          decoration: const InputDecoration(
            labelText: AppStrings.nicknameLabel,
            helperText: '2자 이상 30자 이하',
          ),
          maxLength: 30,
        ),
        CustomButton(
          label: AppStrings.saveButton,
          isLoading: _isSubmitting,
          onPressed: _saveNickname,
        ),
      ],
    );
  }

  /// 간편로그인 연결/해지 영역
  Widget _buildSocialSection() {
    final user = _user!;

    // 해지 후 로그인 수단이 없어지는 상황을 미리 막기 위한 조건.
    // (서버에서도 동일하게 검증하며, 여기서는 버튼을 비활성화해 안내한다)
    final isLastLoginMethod = !user.hasPassword && user.socialAccounts.length <= 1;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(AppStrings.socialSectionTitle, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: AppSizes.paddingSmall),
        for (final provider in [AuthProvider.kakao, AuthProvider.naver, AuthProvider.google])
          _buildSocialTile(provider, user.isLinked(provider), isLastLoginMethod),
        if (isLastLoginMethod)
          const Padding(
            padding: EdgeInsets.only(top: AppSizes.paddingSmall),
            child: Text(
              '연결된 간편로그인이 하나뿐이라 해지할 수 없습니다.\n다른 간편로그인을 먼저 연결해 주세요.',
              style: TextStyle(fontSize: 12, color: AppColors.inkMuted),
            ),
          ),
      ],
    );
  }

  /// 간편로그인 1개 항목 (연결 상태에 따라 연결/해지 버튼 표시)
  Widget _buildSocialTile(AuthProvider provider, bool isLinked, bool isLastLoginMethod) {
    // 마지막 로그인 수단이면 해지 버튼을 비활성화한다.
    final canUnlink = isLinked && !isLastLoginMethod;

    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(
        isLinked ? Icons.link : Icons.link_off,
        color: isLinked ? AppColors.accent : AppColors.inkDisabled,
      ),
      title: Text(authProviderLabel(provider)),
      subtitle: Text(isLinked ? '연결됨' : '연결 안 됨'),
      trailing: isLinked
          ? TextButton(
              onPressed: (_isSubmitting || !canUnlink) ? null : () => _unlinkSocial(provider),
              child: const Text(AppStrings.unlinkButton),
            )
          : TextButton(
              onPressed: _isSubmitting ? null : () => _linkSocial(provider),
              child: const Text(AppStrings.linkButton),
            ),
    );
  }
}
