import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const String baseUrl = 'http://localhost:3000';

  static const String _accessTokenKey = 'auth_access_token';
  static const String _refreshTokenKey = 'auth_refresh_token';
  static const String _loginTimeKey = 'auth_login_time';

  static const Duration _sessionDuration = Duration(hours: 24);

  static String? _accessToken;
  static String? _refreshToken;

  static String? get accessToken => _accessToken;
  static String? get refreshToken => _refreshToken;

  static Map<String, String> get authHeaders => {
    'Content-Type': 'application/json',
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  static Future<Map<String, dynamic>> login(
    String identifier,
    String password,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'identifier': identifier, 'password': password}),
    );

    Map<String, dynamic> data = {};

    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {}

    if (response.statusCode == 403 && data['requiresApproval'] == true) {
      return {...data, 'success': false, 'requiresApproval': true};
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(data['error'] ?? data['message'] ?? 'Login failed');
    }

    if (data['requiresApproval'] == true) {
      return data;
    }

    _accessToken = data['accessToken'];
    _refreshToken = data['refreshToken'];

    if (_accessToken == null || _refreshToken == null) {
      throw Exception('Authentication tokens were not received');
    }

    await _saveSession();

    return data;
  }

  // ============================================================
  // PERSISTENT SESSION
  // ============================================================

  static Future<void> _saveSession() async {
    final prefs = await SharedPreferences.getInstance();

    await prefs.setString(_accessTokenKey, _accessToken!);
    await prefs.setString(_refreshTokenKey, _refreshToken!);
    await prefs.setInt(_loginTimeKey, DateTime.now().millisecondsSinceEpoch);
  }

  static Future<bool> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();

    final savedAccessToken = prefs.getString(_accessTokenKey);
    final savedRefreshToken = prefs.getString(_refreshTokenKey);
    final savedLoginTime = prefs.getInt(_loginTimeKey);

    if (savedAccessToken == null ||
        savedRefreshToken == null ||
        savedLoginTime == null) {
      await clearSession();
      return false;
    }

    final loginTime = DateTime.fromMillisecondsSinceEpoch(savedLoginTime);
    final sessionAge = DateTime.now().difference(loginTime);

    if (sessionAge >= _sessionDuration) {
      await clearSession();
      return false;
    }

    _accessToken = savedAccessToken;
    _refreshToken = savedRefreshToken;

    final refreshed = await refreshAccessToken();

    if (!refreshed) {
      await clearSession();
      return false;
    }

    return true;
  }

  // ============================================================
  // FORGOT PASSWORD
  // ============================================================

  static Future<Map<String, dynamic>> forgotPassword({
    required String firstName,
    required String employeeCode,
    required String mobile,
    required String newPassword,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/forgot-password'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'firstName': firstName,
        'employeeCode': employeeCode,
        'mobile': mobile,
        'newPassword': newPassword,
      }),
    );

    Map<String, dynamic> data = {};

    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {}

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        data['error'] ?? data['message'] ?? 'Failed to reset password',
      );
    }

    return data;
  }

  static Future<bool> refreshAccessToken() async {
    if (_refreshToken == null) {
      return false;
    }

    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': _refreshToken}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _accessToken = null;
      _refreshToken = null;
      return false;
    }

    try {
      final data = jsonDecode(response.body) as Map<String, dynamic>;

      _accessToken = data['accessToken'];

      if (_accessToken == null) {
        return false;
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_accessTokenKey, _accessToken!);

      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> logout() async {
    try {
      if (_refreshToken != null) {
        await http.post(
          Uri.parse('$baseUrl/api/auth/logout'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': _refreshToken}),
        );
      }
    } finally {
      await clearSession();
    }
  }

  static Future<void> clearSession() async {
    _accessToken = null;
    _refreshToken = null;

    final prefs = await SharedPreferences.getInstance();

    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
    await prefs.remove(_loginTimeKey);
  }
}
