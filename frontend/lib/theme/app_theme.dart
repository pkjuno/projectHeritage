import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// 앱 전역 테마.
///
/// 색은 [AppColors]에, 형태(서체·간격·컴포넌트 스타일)는 여기에 모은다.
/// 화면 위젯이 색과 크기를 직접 적지 않게 하는 것이 목적이다.
class AppTheme {
  AppTheme._();

  /// 제목과 게시글 제목에 쓰는 명조체.
  ///
  /// UI 전체를 산세리프로만 채우면 어떤 앱과도 구별되지 않는다.
  /// 제목에만 명조를 써서 차분한 인상을 만들고, 읽는 밀도가 높은
  /// 본문·라벨은 산세리프로 둔다.
  static TextStyle serif({
    double? fontSize,
    FontWeight fontWeight = FontWeight.w700,
    Color? color,
    double? height,
    double letterSpacing = -0.2,
  }) {
    return GoogleFonts.gowunBatang(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color ?? AppColors.ink,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  /// 본문/UI 서체.
  static TextTheme _buildTextTheme() {
    // IBM Plex Sans KR은 한글 자소가 또렷하고 굵기 단계가 넉넉해
    // 작은 글자(11~13px)가 많은 목록 화면에서 잘 버틴다.
    final base = GoogleFonts.ibmPlexSansKrTextTheme();

    return base.copyWith(
      // 화면 제목
      titleLarge: serif(fontSize: 21, height: 1.45, letterSpacing: -0.3),
      titleMedium: serif(fontSize: 17, height: 1.4),
      // 목록의 글 제목
      titleSmall: serif(fontSize: 16, height: 1.45),

      // 본문
      bodyLarge: base.bodyLarge?.copyWith(fontSize: 14, height: 1.85, color: AppColors.inkBody),
      bodyMedium: base.bodyMedium?.copyWith(fontSize: 13, height: 1.7, color: AppColors.inkBody),
      // 메타 정보 (작성자 · 시각 · 카운트)
      bodySmall: base.bodySmall?.copyWith(fontSize: 11, height: 1.5, color: AppColors.inkMuted),

      labelLarge: base.labelLarge?.copyWith(fontSize: 14, fontWeight: FontWeight.w500),
      labelMedium: base.labelMedium?.copyWith(fontSize: 12, color: AppColors.inkSecondary),
      // 폼의 섹션 라벨
      labelSmall: base.labelSmall?.copyWith(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
        color: AppColors.inkMuted,
      ),
    );
  }

  /// 앱 전체에 적용할 테마.
  static ThemeData get light {
    final textTheme = _buildTextTheme();

    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.background,
      textTheme: textTheme,

      // Material 3의 기본 배색(보라 계열)을 그대로 두면 곳곳에서 튀어나온다.
      // seed가 아니라 값을 직접 지정해 강조색이 하나로 유지되게 한다.
      colorScheme: const ColorScheme.light(
        primary: AppColors.accent,
        onPrimary: AppColors.onAccent,
        primaryContainer: AppColors.accentSurface,
        onPrimaryContainer: AppColors.accent,
        secondary: AppColors.accent,
        onSecondary: AppColors.onAccent,
        surface: AppColors.surface,
        onSurface: AppColors.ink,
        onSurfaceVariant: AppColors.inkSecondary,
        error: AppColors.danger,
        onError: AppColors.onAccent,
        errorContainer: AppColors.noticeSurface,
        onErrorContainer: AppColors.danger,
        outline: AppColors.line,
        outlineVariant: AppColors.lineSubtle,
      ),

      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: serif(fontSize: 18, color: AppColors.ink),
      ),

      // 그림자 대신 얇은 선으로 면을 구분한다. 미니멀 톤에서 그림자는 소음이다.
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(4),
          side: const BorderSide(color: AppColors.line),
        ),
      ),

      dividerTheme: const DividerThemeData(
        color: AppColors.lineSubtle,
        thickness: 1,
        space: 1,
      ),

      // 모든 입력칸을 같은 모양으로 통일한다.
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        hintStyle: textTheme.bodyMedium?.copyWith(color: AppColors.inkMuted),
        labelStyle: textTheme.bodyMedium?.copyWith(color: AppColors.inkSecondary),
        border: _inputBorder(AppColors.line),
        enabledBorder: _inputBorder(AppColors.line),
        focusedBorder: _inputBorder(AppColors.accent),
        errorBorder: _inputBorder(AppColors.danger),
        focusedErrorBorder: _inputBorder(AppColors.danger),
      ),

      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: AppColors.onAccent,
          disabledBackgroundColor: AppColors.line,
          disabledForegroundColor: AppColors.inkDisabled,
          elevation: 0,
          // 터치 목표를 48px 이상으로 유지한다.
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
          textStyle: textTheme.labelLarge,
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          minimumSize: const Size.fromHeight(48),
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
          textStyle: textTheme.labelLarge,
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.accent,
          textStyle: textTheme.labelMedium?.copyWith(color: AppColors.accent),
        ),
      ),

      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.accent,
        foregroundColor: AppColors.onAccent,
        elevation: 2,
      ),

      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surface,
        selectedColor: AppColors.accentSurface,
        side: const BorderSide(color: AppColors.line),
        labelStyle: textTheme.labelMedium,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        showCheckmark: false,
      ),

      tabBarTheme: TabBarThemeData(
        labelColor: AppColors.ink,
        unselectedLabelColor: AppColors.inkMuted,
        indicatorColor: AppColors.accent,
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: AppColors.line,
        labelStyle: textTheme.labelLarge,
        unselectedLabelStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w400),
      ),

      listTileTheme: const ListTileThemeData(
        iconColor: AppColors.inkSecondary,
        textColor: AppColors.ink,
      ),

      iconTheme: const IconThemeData(color: AppColors.inkSecondary, size: 20),

      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.ink,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: AppColors.surface),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      ),

      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        titleTextStyle: serif(fontSize: 17),
        contentTextStyle: textTheme.bodyMedium,
      ),

      progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.accent),
    );
  }

  static OutlineInputBorder _inputBorder(Color color) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(4),
      borderSide: BorderSide(color: color),
    );
  }
}
