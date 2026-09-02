import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

/// 서버 응답이 실패했을 때 던지는 커스텀 예외.
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// 백엔드 REST API와의 통신을 담당하는 공통 서비스.
/// 개별 도메인 서비스(UserService 등)는 이 클래스를 통해 HTTP 요청을 보낸다.
class ApiService {
  final http.Client _client;

  ApiService({http.Client? client}) : _client = client ?? http.Client();

  /// GET 요청을 보내고 응답 본문(JSON)을 반환한다.
  /// [path]는 baseUrl 이후의 경로 (예: '/users')
  Future<dynamic> get(String path) async {
    final uri = Uri.parse('${AppConfig.baseUrl}$path');
    final response = await _client
        .get(uri)
        .timeout(Duration(seconds: AppConfig.requestTimeoutSeconds));
    return _handleResponse(response);
  }

  /// POST 요청을 보내고 응답 본문(JSON)을 반환한다.
  /// [path]는 baseUrl 이후의 경로, [body]는 요청 본문에 담을 데이터
  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('${AppConfig.baseUrl}$path');
    final response = await _client
        .post(
          uri,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(body),
        )
        .timeout(Duration(seconds: AppConfig.requestTimeoutSeconds));
    return _handleResponse(response);
  }

  /// HTTP 응답을 검사하고, 성공 시 디코딩된 body를,
  /// 실패 시 [ApiException]을 던지는 공통 처리 함수.
  dynamic _handleResponse(http.Response response) {
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded['data'];
    }

    throw ApiException(
      decoded['message'] ?? '알 수 없는 오류가 발생했습니다.',
      statusCode: response.statusCode,
    );
  }
}
