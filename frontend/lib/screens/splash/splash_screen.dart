import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../auth/login_screen.dart';
import '../home/home_screen.dart';

/// 앱 실행 시 가장 먼저 보여지는 스플래시(로딩) 화면.
/// 저장된 로그인 토큰이 있는지 확인해 홈 또는 로그인 화면으로 자동 이동시킨다.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  final AuthService _authService = AuthService();

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  /// 저장된 Access Token 존재 여부를 확인해 다음 화면을 결정하는 함수.
  Future<void> _checkLoginStatus() async {
    final isLoggedIn = await _authService.isLoggedIn();

    // 최소 노출 시간을 두어 스플래시가 순간적으로 깜빡이지 않도록 한다.
    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => isLoggedIn ? const HomeScreen() : const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}
