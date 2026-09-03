import 'package:flutter/material.dart';
import 'routes/app_routes.dart';
import 'theme/app_theme.dart';
import 'utils/constants.dart';

/// 앱의 최상위 위젯.
/// MaterialApp 설정(테마, 라우트 등)을 이곳에서 관리한다.
class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppStrings.appTitle,
      debugShowCheckedModeBanner: false,
      // 앱 전역 테마 설정 (색상/서체/컴포넌트 스타일은 theme/ 아래에 모여 있다)
      theme: AppTheme.light,
      // 앱 시작 시 첫 화면
      initialRoute: AppRoutes.splash,
      // 라우트 이름 -> 화면 매핑
      routes: appRoutes,
    );
  }
}
