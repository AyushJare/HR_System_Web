import 'dart:convert';
import 'package:http/http.dart' as http;

class AuthService {
  static const String baseUrl = 'http://localhost:3000';

  static String? _accessToken;
  static String? _refreshToken;

  static String? get accessToken => _accessToken;
  static String? get refreshToken => _refreshToken;

  static Map<String, String> get authHeaders => {
        'Content-Type': 'application/json',
        if (_accessToken != null)
          'Authorization': 'Bearer $_accessToken',
      };

  static Future<Map<String, dynamic>> login(
    String email,
    String password, {
    double? latitude,
    double? longitude,
    double? gpsAccuracy,
    String? deviceId,
    bool isMockLocation = false,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'email': email,
        'password': password,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        if (gpsAccuracy != null) 'gpsAccuracy': gpsAccuracy,
        if (deviceId != null) 'deviceId': deviceId,
        'isMockLocation': isMockLocation,
      }),
    );

    Map<String, dynamic> data = {};

    try {
      data = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {}

    if (response.statusCode == 403 &&
        data['requiresApproval'] == true) {
      return {
        ...data,
        'success': false,
        'requiresApproval': true,
      };
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        data['error'] ?? data['message'] ?? 'Login failed',
      );
    }

    if (data['requiresApproval'] == true) {
      return data;
    }

    _accessToken = data['accessToken'];
    _refreshToken = data['refreshToken'];

    if (_accessToken == null || _refreshToken == null) {
      throw Exception('Authentication tokens were not received');
    }

    return data;
  }

  static Future<bool> refreshAccessToken() async {
    if (_refreshToken == null) {
      return false;
    }

    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/refresh'),
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        'refreshToken': _refreshToken,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _accessToken = null;
      _refreshToken = null;
      return false;
    }

    try {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      _accessToken = data['accessToken'];

      return _accessToken != null;
    } catch (_) {
      return false;
    }
  }

  static Future<void> logout() async {
    try {
      if (_refreshToken != null) {
        await http.post(
          Uri.parse('$baseUrl/api/auth/logout'),
          headers: {
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'refreshToken': _refreshToken,
          }),
        );
      }
    } finally {
      _accessToken = null;
      _refreshToken = null;
    }
  }
}