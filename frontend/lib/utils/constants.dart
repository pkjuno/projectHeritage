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

  // 마이페이지
  static const String myPageTitle = '마이페이지';
  static const String profileSectionTitle = '프로필';
  static const String myInfoSectionTitle = '회원정보';
  static const String socialSectionTitle = '간편로그인 연결';
  static const String nicknameLabel = '닉네임';
  static const String changeImageButton = '이미지 변경';
  static const String deleteImageButton = '이미지 삭제';
  static const String saveButton = '저장';
  static const String linkButton = '연결';
  static const String unlinkButton = '해지';
  static const String unlinkConfirmMessage = '간편로그인 연결을 해지하시겠습니까?';

  // 축제 캘린더 / 상세
  static const String festivalCalendarTitle = '축제 캘린더';
  static const String festivalDetailTitle = '축제 상세';
  static const String allRegions = '전국';
  static const String noFestivalOnDay = '선택한 날짜에 진행되는 축제가 없습니다.';
  static const String loginRequired = '로그인이 필요한 기능입니다.';

  // 위시리스트 / 내 일정
  static const String myFestivalTitle = '내 축제';
  static const String wishlistTitle = '위시리스트';
  static const String scheduleTitle = '내 일정';
  static const String addWishlist = '위시리스트 담기';
  static const String removeWishlist = '위시리스트 빼기';
  static const String addSchedule = '일정 추가';
  static const String pickVisitDate = '방문할 날짜를 선택하세요';
  static const String scheduleMemoTitle = '메모 (선택)';
  static const String deleteScheduleTitle = '일정 삭제';
  static const String emptyWishlist = '아직 찜한 축제가 없습니다.';
  static const String emptySchedule = '등록된 일정이 없습니다.';
}

/// 앱 전역에서 재사용하는 여백/크기 값 모음.
class AppSizes {
  AppSizes._();

  static const double paddingSmall = 8.0;
  static const double paddingMedium = 16.0;
  static const double paddingLarge = 24.0;
}
