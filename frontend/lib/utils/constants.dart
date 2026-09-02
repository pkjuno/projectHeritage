/// 앱 전역에서 재사용하는 문자열/상수 값 모음.
class AppStrings {
  AppStrings._();

  static const String appTitle = 'Project Heritage';
  static const String homeTitle = '홈';
  static const String loadingMessage = '불러오는 중입니다...';
  static const String errorMessage = '오류가 발생했습니다. 다시 시도해 주세요.';

  // 로그인/회원가입 화면
  static const String loginTitle = '로그인';
  static const String signupTitle = '회원가입';
  static const String emailLabel = '이메일';
  static const String passwordLabel = '비밀번호';
  static const String nameLabel = '이름';
  static const String loginButton = '로그인';
  static const String signupButton = '회원가입';
  static const String goToSignup = '아직 회원이 아니신가요? 회원가입';
  static const String goToLogin = '이미 계정이 있으신가요? 로그인';
  static const String kakaoLoginButton = '카카오로 시작하기';
  static const String naverLoginButton = '네이버로 시작하기';
  static const String googleLoginButton = '구글로 시작하기';

  // 홈/마이페이지 화면
  static const String logoutButton = '로그아웃';
  static const String withdrawButton = '회원 탈퇴';
  static const String withdrawConfirmMessage = '정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.';
}

/// 앱 전역에서 재사용하는 여백/크기 값 모음.
class AppSizes {
  AppSizes._();

  static const double paddingSmall = 8.0;
  static const double paddingMedium = 16.0;
  static const double paddingLarge = 24.0;
}
