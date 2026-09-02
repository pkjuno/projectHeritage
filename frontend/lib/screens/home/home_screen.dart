import 'package:flutter/material.dart';
import '../../models/user_model.dart';
import '../../services/user_service.dart';
import '../../utils/constants.dart';

/// 앱의 메인(홈) 화면.
/// 백엔드 API에서 사용자 목록을 조회하여 리스트로 보여주는 예시 화면이다.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final UserService _userService = UserService();

  // 사용자 목록 조회 결과를 담는 Future. FutureBuilder에서 상태(로딩/성공/실패)를 관리한다.
  late Future<List<UserModel>> _usersFuture;

  @override
  void initState() {
    super.initState();
    _usersFuture = _userService.fetchUsers();
  }

  /// 새로고침(Pull to refresh) 시 사용자 목록을 다시 조회하는 함수.
  Future<void> _refreshUsers() async {
    setState(() {
      _usersFuture = _userService.fetchUsers();
    });
    await _usersFuture;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.homeTitle)),
      body: RefreshIndicator(
        onRefresh: _refreshUsers,
        child: FutureBuilder<List<UserModel>>(
          future: _usersFuture,
          builder: (context, snapshot) {
            // 데이터 로딩 중
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            // 에러 발생 시
            if (snapshot.hasError) {
              return Center(child: Text(AppStrings.errorMessage));
            }

            final users = snapshot.data ?? [];

            // 데이터가 없는 경우
            if (users.isEmpty) {
              return const Center(child: Text('사용자가 없습니다.'));
            }

            // 사용자 목록 렌더링
            return ListView.builder(
              itemCount: users.length,
              itemBuilder: (context, index) {
                final user = users[index];
                return ListTile(
                  title: Text(user.name),
                  subtitle: Text(user.email),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
