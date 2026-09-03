import 'package:flutter/material.dart';

/// 앱 전역 색상 토큰.
///
/// 무채색 기반에 **포인트 컬러 하나**를 쓰는 차분한 미니멀 톤이다.
/// 색을 화면마다 직접 적어두면 톤을 바꿀 때 전부 찾아다녀야 하므로,
/// 색은 여기서만 정의하고 화면은 이 이름만 참조한다.
///
/// 순수한 흑백(#000/#FFF) 대신 따뜻한 쪽으로 아주 살짝 기울인 값을 쓴다.
/// 순수 검정은 화면에서 눈에 띄게 딱딱하다.
class AppColors {
  AppColors._();

  // --- 바탕 ---
  /// 화면 바탕. 따뜻한 오프화이트.
  static const Color background = Color(0xFFFAF9F7);

  /// 카드/목록 등 콘텐츠가 얹히는 면.
  static const Color surface = Color(0xFFFFFFFF);

  /// 강조 없이 살짝 구분만 하고 싶은 면. (선택된 행, 대댓글 배경)
  static const Color surfaceMuted = Color(0xFFFCFBF9);

  /// 태그·칩처럼 배경만 살짝 깔 때.
  static const Color surfaceTag = Color(0xFFF6F4F1);

  // --- 글자 ---
  /// 본문/제목.
  static const Color ink = Color(0xFF1C1B19);

  /// 긴 본문. ink보다 아주 조금 옅게 해서 장문의 피로를 줄인다.
  static const Color inkBody = Color(0xFF2E2C29);

  /// 보조 설명.
  static const Color inkSecondary = Color(0xFF5F5C56);

  /// 메타 정보(작성자, 시각, 카운트).
  static const Color inkMuted = Color(0xFF94908A);

  /// 비활성/플레이스홀더.
  static const Color inkDisabled = Color(0xFFB0ACA5);

  // --- 선 ---
  /// 영역을 나누는 선.
  static const Color line = Color(0xFFE9E6E1);

  /// 목록 항목 사이의 더 연한 선.
  static const Color lineSubtle = Color(0xFFF3F0EB);

  // --- 포인트 컬러 ---
  /// 유일한 강조색. 깊은 청자녹.
  ///
  /// 강조가 하나뿐이라 "여기가 중요하다"는 신호가 분산되지 않는다.
  /// 새 색을 추가하고 싶어지면, 그 자리가 정말 강조인지 먼저 의심할 것.
  static const Color accent = Color(0xFF3D5F52);

  /// 강조색 위에 얹는 글자색.
  static const Color onAccent = Color(0xFFFFFFFF);

  /// 강조색의 아주 옅은 배경. (선택된 칩, 뱃지)
  static const Color accentSurface = Color(0xFFEDF1EE);

  /// 강조색 계열의 테두리.
  static const Color accentBorder = Color(0xFFD9E2DC);

  // --- 상태 ---
  /// 삭제/탈퇴 등 되돌리기 어려운 동작.
  ///
  /// 포인트 컬러와 충분히 구분되면서도 톤에서 튀지 않는 벽돌빛을 쓴다.
  static const Color danger = Color(0xFF9C4A3C);

  /// 경고/안내 배경. (숨김 처리 안내 등)
  static const Color noticeSurface = Color(0xFFF7F2EC);

  // --- 브랜드 (SNS 로그인) ---
  /// 카카오 공식 색. 브랜드 규정상 바꿀 수 없다.
  static const Color kakao = Color(0xFFFEE500);
  static const Color kakaoLabel = Color(0xFF191600);

  /// 네이버 공식 색. 브랜드 규정상 바꿀 수 없다.
  static const Color naver = Color(0xFF03C75A);
}
