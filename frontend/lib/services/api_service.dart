import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import 'token_storage.dart';

/// 서버 응답이 실패했을 때 던지는 커스텀 예외.
class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, {this.statusCode});

  @override
  String toString() => 'ApiException($statusCode): $message';
}

/// 백엔드 REST API와의 통신을 담당하는 공통 서비스.
/// 개별 도메인 서비스(AuthService, UserService 등)는 이 클래스를 통해 HTTP 요청을 보낸다.
class ApiService {
  final http.Client _client;
  final TokenStorage _tokenStorage;

  ApiService({http.Client? client, TokenStorage? tokenStorage})
      : _client = client ?? http.Client(),
        _tokenStorage = tokenStorage ?? TokenStorage();

  /// 요청 헤더를 구성한다. [authorized]가 true면 저장된 Access Token을 Authorization 헤더에 담는다.
  Future<Map<String, String>> _buildHeaders({bool authorized = false}) async {
    final headers = {'Content-Type': 'application/json'};

    if (authorized) {
      final accessToken = await _tokenStorage.readAccessToken();
      if (accessToken != null) {
        headers['Authorization'] = 'Bearer $accessToken';
      }
    }

    return headers;
  }

  /// GET 요청을 보내고 응답 본문(JSON)을 반환한다.
  /// [path]는 baseUrl 이후의 경로, [authorized]가 true면 인증 헤더를 함께 보낸다.
  Future<dynamic> get(String path, {bool authorized = false}) async {
    final uri = Uri.parse('${AppConfig.baseUrl}$path');
    final headers = await _buildHeaders(authorized: authorized);
    final response = await _client
        .get(uri, headers: headers)
        .timeout(Duration(seconds: AppConfig.requestTimeoutSeconds));
    return _handleResponse(response);
  }

  /// POST 요청을 보내고 응답 본문(JSON)을 반환한다.
  Future<dynamic> post(String path, Map<String, dynamic> body, {bool authorized = false}) async {
    final uri = Uri.parse('${AppConfig.baseUrl}$path');
    final headers = await _buildHeaders(authorized: authorized);
    final response = await _client
        .post(uri, headers: headers, body: jsonEncode(body))
        .timeout(Duration(seconds: AppConfig.requestTimeoutSeconds));
    return _handleResponse(response);
  }

  /// PATCH 요청을 보내고 응답 본문(JSON)을 반환한다. (회원정보 부분 수정 등에서 사용)
  Future<dynamic> patch(String path, Map<String, dynamic> body, {bool authorized = false}) async {
    final uri = Uri.parse('${AppConfig.baseUrl}$path');
    final headers = await _buildHeaders(authorized: authorized);
    final response = await _client
        .patch(uri, headers: headers, body: jsonEncode(body))
        .timeout(Duration(seconds: AppConfig.requestTimeoutSeconds));
    return _handleResponse(response);
  }

  /// 파일을 multipart/form-data로 업로드한다. (프로필 이미지 등록/수정에서 사용)
  /// [fieldName]은 서버가 기대하는 파일 필드명이다.
  Future<dynamic> uploadFile(
    String path,
    File file, {
    String method = 'PUT',
    String fieldName = 'image',
    bool authorized = true,
  }) async {
    final uri = Uri.parse('${AppConfig.baseUrl}$path');
    final request = http.MultipartRequest(method, uri);

    // multipart 요청은 Content-Type을 http 패키지가 직접 설정하므로 인증 헤더만 추가한다.
    if (authorized) {
      final accessToken = await _tokenStorage.readAccessToken();
      if (accessToken != null) {
        request.headers['Authorization'] = 'Bearer $accessToken';
      }
    }

    request.files.add(await http.MultipartFile.fromPath(fieldName, file.path));

    final streamed = await _client
        .send(request)
        .timeout(Duration(seconds: AppConfig.requestTimeoutSeconds));
    final response = await http.Response.fromStream(streamed);

    return _handleResponse(response);
  }

  /// DELETE 요청을 보내고 응답 본문(JSON)을 반환한다. (회원탈퇴 등에서 사용)
  Future<dynamic> delete(String path, {bool authorized = false}) async {
    final uri = Uri.parse('${AppConfig.baseUrl}$path');
    final headers = await _buildHeaders(authorized: authorized);
    final response = await _client
        .delete(uri, headers: headers)
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
