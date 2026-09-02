import 'package:flutter/material.dart';
import '../home/home_screen.dart';

/// 앱 실행 시 가장 먼저 보여지는 스플래시(로딩) 화면.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    // 화면 진입 후 초기화 로직(자동 로그인, 설정 로드 등)을 수행하고 홈으로 이동한다.
    _navigateToHome();
  }

  /// 일정 시간 대기 후 홈 화면으로 전환하는 함수.
  Future<void> _navigateToHome() async {
    await Future.delayed(const Duration(seconds: 1));
    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
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
