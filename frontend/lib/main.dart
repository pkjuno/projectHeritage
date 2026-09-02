import 'package:flutter/material.dart';
import 'package:flutter_naver_login/flutter_naver_login.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';
import 'app.dart';
import 'config/app_config.dart';

/// Flutter 애플리케이션의 진입점(entry point).
Future<void> main() async {
  // 위젯 바인딩을 먼저 초기화해야 SDK 초기화(비동기/플랫폼 채널 접근)가 안전하게 동작한다.
  WidgetsFlutterBinding.ensureInitialized();

  // 축제 캘린더에서 한국어 날짜 표기를 쓰려면 로케일 데이터를 먼저 로드해야 한다.
  await initializeDateFormatting('ko_KR', null);

  // 카카오 SDK 초기화 (네이티브 앱 키는 AppConfig에서 관리)
  KakaoSdk.init(nativeAppKey: AppConfig.kakaoNativeAppKey);

  // 네이버 SDK 초기화 (클라이언트 ID/시크릿은 AppConfig에서 관리)
  FlutterNaverLogin.initSdk(
    clientId: AppConfig.naverClientId,
    clientSecret: AppConfig.naverClientSecret,
    clientName: AppConfig.naverClientName,
  );

  runApp(const App());
}
