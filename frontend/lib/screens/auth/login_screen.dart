import 'package:flutter/material.dart';
import '../../models/user_model.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_button.dart';
import '../home/home_screen.dart';
import 'signup_screen.dart';

/// 로그인 화면. 일반(이메일/비밀번호) 로그인과 SNS 간편로그인(네이버/카카오/구글)을 제공한다.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  final AuthService _authService = AuthService();

  // 어떤 버튼이 로딩 중인지 구분하기 위한 상태 (동시에 여러 로그인 시도 방지)
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// 일반 로그인 처리.
  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    await _runAuthAction(() => _authService.login(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        ));
  }

  /// SNS 간편로그인 처리. [provider]에 해당하는 SDK 로그인을 실행한다.
  Future<void> _handleSocialLogin(AuthProvider provider) async {
    await _runAuthAction(() => _authService.socialLogin(provider));
  }

  /// 로그인 공통 처리(로딩 상태 관리, 성공 시 홈 이동, 실패 시 에러 표시).
  Future<void> _runAuthAction(Future<UserModel?> Function() action) async {
    setState(() => _isLoading = true);
    try {
      final user = await action();

      // socialLogin은 사용자가 취소하면 null을 반환한다.
      if (user == null) return;

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    } on ApiException catch (error) {
      _showError(error.message);
    } catch (error) {
      _showError(AppStrings.errorMessage);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// 에러 메시지를 스낵바로 보여주는 함수.
  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  /// 회원가입 화면으로 이동하는 함수.
  void _goToSignup() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SignupScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.loginTitle)),
      body: Padding(
        padding: const EdgeInsets.all(AppSizes.paddingLarge),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: AppStrings.emailLabel),
                validator: (value) => (value == null || value.trim().isEmpty) ? '이메일을 입력해 주세요.' : null,
              ),
              const SizedBox(height: AppSizes.paddingMedium),
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: AppStrings.passwordLabel),
                validator: (value) => (value == null || value.isEmpty) ? '비밀번호를 입력해 주세요.' : null,
              ),
              const SizedBox(height: AppSizes.paddingLarge),
              CustomButton(
                label: AppStrings.loginButton,
                isLoading: _isLoading,
                onPressed: _handleLogin,
              ),
              TextButton(
                onPressed: _isLoading ? null : _goToSignup,
                child: const Text(AppStrings.goToSignup),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: AppSizes.paddingMedium),
                child: Divider(),
              ),
              // SNS 간편로그인 버튼 목록
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.kakao),
                onPressed: _isLoading ? null : () => _handleSocialLogin(AuthProvider.kakao),
                child: const Text(AppStrings.kakaoLoginButton, style: TextStyle(color: Colors.black)),
              ),
              const SizedBox(height: AppSizes.paddingSmall),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.naver),
                onPressed: _isLoading ? null : () => _handleSocialLogin(AuthProvider.naver),
                child: const Text(AppStrings.naverLoginButton, style: TextStyle(color: Colors.white)),
              ),
              const SizedBox(height: AppSizes.paddingSmall),
              OutlinedButton(
                onPressed: _isLoading ? null : () => _handleSocialLogin(AuthProvider.google),
                child: const Text(AppStrings.googleLoginButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
