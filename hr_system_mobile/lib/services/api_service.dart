import 'dart:convert';
import 'package:http/http.dart' as http;
import 'auth_service.dart';

class ApiService {
  static Future<dynamic> get(String endpoint) async {
    final response = await http.get(
      Uri.parse('${AuthService.baseUrl}$endpoint'),
      headers: AuthService.authHeaders,
    );

    if (response.statusCode == 401) {
      final refreshed = await AuthService.refreshAccessToken();

      if (refreshed) {
        final retry = await http.get(
          Uri.parse('${AuthService.baseUrl}$endpoint'),
          headers: AuthService.authHeaders,
        );

        return _handleResponse(retry);
      }
    }

    return _handleResponse(response);
  }

  static Future<dynamic> post(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    final response = await http.post(
      Uri.parse('${AuthService.baseUrl}$endpoint'),
      headers: AuthService.authHeaders,
      body: jsonEncode(body),
    );

    if (response.statusCode == 401) {
      final refreshed = await AuthService.refreshAccessToken();

      if (refreshed) {
        final retry = await http.post(
          Uri.parse('${AuthService.baseUrl}$endpoint'),
          headers: AuthService.authHeaders,
          body: jsonEncode(body),
        );

        return _handleResponse(retry);
      }
    }

    return _handleResponse(response);
  }

  static Future<dynamic> put(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    final response = await http.put(
      Uri.parse('${AuthService.baseUrl}$endpoint'),
      headers: AuthService.authHeaders,
      body: jsonEncode(body),
    );

    if (response.statusCode == 401) {
      final refreshed = await AuthService.refreshAccessToken();

      if (refreshed) {
        final retry = await http.put(
          Uri.parse('${AuthService.baseUrl}$endpoint'),
          headers: AuthService.authHeaders,
          body: jsonEncode(body),
        );

        return _handleResponse(retry);
      }
    }

    return _handleResponse(response);
  }

  static dynamic _handleResponse(http.Response response) {
    dynamic data;

    try {
      data = jsonDecode(response.body);
    } catch (_) {
      data = null;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        data is Map && data['error'] != null
            ? data['error']
            : 'Request failed (${response.statusCode})',
      );
    }

    return data;
  }
}