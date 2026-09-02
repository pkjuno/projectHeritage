import 'package:flutter/material.dart';
import '../../models/user_model.dart';
import '../../services/auth_service.dart';
import '../../services/user_service.dart';
import '../../utils/constants.dart';
import '../auth/login_screen.dart';

/// 앱의 메인(홈/마이페이지) 화면.
/// 로그인된 사용자의 정보를 보여주고, 로그아웃/회원탈퇴 기능을 제공한다.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final UserService _userService = UserService();
  final AuthService _authService = AuthService();

  // 내 정보 조회 결과를 담는 Future. FutureBuilder에서 상태(로딩/성공/실패)를 관리한다.
  late Future<UserModel> _meFuture;

  @override
  void initState() {
    super.initState();
    _meFuture = _userService.fetchMe();
  }

  /// 로그아웃 처리 후 로그인 화면으로 이동하는 함수.
  Future<void> _handleLogout() async {
    await _authService.logout();
    _goToLoginScreen();
  }

  /// 회원 탈퇴 확인 다이얼로그를 띄우고, 확인 시 탈퇴를 진행하는 함수.
  Future<void> _handleWithdraw() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(AppStrings.withdrawButton),
        content: const Text(AppStrings.withdrawConfirmMessage),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('취소')),
          TextButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('탈퇴')),
        ],
      ),
    );

    if (confirmed != true) return;

    await _authService.withdraw();
    if (!mounted) return;
    _goToLoginScreen();
  }

  /// 로그인 화면으로 전환(뒤로가기 불가)하는 공통 함수.
  void _goToLoginScreen() {
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.homeTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: AppStrings.logoutButton,
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: FutureBuilder<UserModel>(
        future: _meFuture,
        builder: (context, snapshot) {
          // 데이터 로딩 중
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          // 에러 발생 시 (토큰 만료 등)
          if (snapshot.hasError) {
            return Center(child: Text(AppStrings.errorMessage));
          }

          final user = snapshot.data!;

          return Padding(
            padding: const EdgeInsets.all(AppSizes.paddingLarge),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('이름: ${user.name}', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: AppSizes.paddingSmall),
                Text('이메일: ${user.email}'),
                const SizedBox(height: AppSizes.paddingSmall),
                Text('가입 경로: ${user.provider.name}'),
                const Spacer(),
                TextButton(
                  onPressed: _handleWithdraw,
                  child: const Text(AppStrings.withdrawButton, style: TextStyle(color: Colors.red)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
