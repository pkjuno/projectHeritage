import 'package:flutter/material.dart';

/// 앱 전역에서 재사용하는 공통 버튼 위젯.
/// 디자인 시스템 통일을 위해 버튼 스타일을 한 곳에서 관리한다.
class CustomButton extends StatelessWidget {
  /// 버튼에 표시할 텍스트
  final String label;

  /// 버튼 클릭 시 실행할 콜백
  final VoidCallback onPressed;

  /// 로딩 상태 여부 (true면 로딩 인디케이터를 표시하고 버튼을 비활성화)
  final bool isLoading;

  const CustomButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      // 로딩 중일 때는 버튼을 비활성화한다.
      onPressed: isLoading ? null : onPressed,
      style: ElevatedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: isLoading
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          : Text(label),
    );
  }
}
