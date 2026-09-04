import 'dart:convert';
import 'package:http/http.dart' as http;

import 'auth_service.dart';

class AuditService {
  static String get baseUrl => AuthService.baseUrl;
  static Map<String, String> get _headers =>
    AuthService.authHeaders;

  static Future<List<Map<String, dynamic>>> getAuditLogs() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/audit'),
      headers: _headers,
    );

    final data = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        data is Map && data['error'] != null
            ? data['error'].toString()
            : 'Failed to load audit logs (${response.statusCode})',
      );
    }

    if (data is List) {
      return data
          .whereType<Map>()
          .map(
            (item) => Map<String, dynamic>.from(item),
          )
          .toList();
    }

    if (data is Map && data['data'] is List) {
      return (data['data'] as List)
          .whereType<Map>()
          .map(
            (item) => Map<String, dynamic>.from(item),
          )
          .toList();
    }

    throw Exception('Invalid audit log data received');
  }

  static dynamic _decode(http.Response response) {
    try {
      if (response.body.trim().isEmpty) {
        return null;
      }

      return jsonDecode(response.body);
    } catch (_) {
      return null;
    }
  }
}