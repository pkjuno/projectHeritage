import 'package:flutter/material.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/signup_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/splash/splash_screen.dart';

/// 앱의 라우트(화면 경로) 이름을 상수로 관리한다.
class AppRoutes {
  AppRoutes._();

  static const String splash = '/';
  static const String login = '/login';
  static const String signup = '/signup';
  static const String home = '/home';
}

/// 라우트 이름과 실제 화면 위젯을 매핑한다.
/// MaterialApp의 routes 속성에 그대로 전달해서 사용한다.
final Map<String, WidgetBuilder> appRoutes = {
  AppRoutes.splash: (context) => const SplashScreen(),
  AppRoutes.login: (context) => const LoginScreen(),
  AppRoutes.signup: (context) => const SignupScreen(),
  AppRoutes.home: (context) => const HomeScreen(),
};
