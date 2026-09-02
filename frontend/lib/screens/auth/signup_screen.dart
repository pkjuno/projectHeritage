import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../services/api_service.dart';
import '../../utils/constants.dart';
import '../../widgets/custom_button.dart';

/// 일반(이메일/비밀번호) 회원가입 화면.
class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();

  final AuthService _authService = AuthService();

  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  /// 입력값 유효성 검증 후 회원가입 API를 호출하는 함수.
  Future<void> _handleSignup() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      await _authService.signup(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        name: _nameController.text.trim(),
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('회원가입이 완료되었습니다. 로그인해 주세요.')),
      );
      Navigator.of(context).pop();
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.signupTitle)),
      body: Padding(
        padding: const EdgeInsets.all(AppSizes.paddingLarge),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(labelText: AppStrings.nameLabel),
                validator: (value) => (value == null || value.trim().isEmpty) ? '이름을 입력해 주세요.' : null,
              ),
              const SizedBox(height: AppSizes.paddingMedium),
              TextFormField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: AppStrings.emailLabel),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) return '이메일을 입력해 주세요.';
                  final emailRegex = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
                  if (!emailRegex.hasMatch(value.trim())) return '올바른 이메일 형식이 아닙니다.';
                  return null;
                },
              ),
              const SizedBox(height: AppSizes.paddingMedium),
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(labelText: AppStrings.passwordLabel),
                validator: (value) {
                  if (value == null || value.isEmpty) return '비밀번호를 입력해 주세요.';
                  if (value.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
                  return null;
                },
              ),
              const SizedBox(height: AppSizes.paddingLarge),
              CustomButton(
                label: AppStrings.signupButton,
                isLoading: _isLoading,
                onPressed: _handleSignup,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
