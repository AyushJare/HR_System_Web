import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_service.dart';

class LeaveService {
  static String get baseUrl => AuthService.baseUrl;

  static Map<String, String> get _headers => {
  'Content-Type': 'application/json',
  if (AuthService.accessToken != null)
    'Authorization': 'Bearer ${AuthService.accessToken!}',
};

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

  static String _errorMessage(
    http.Response response,
    String fallback,
  ) {
    final data = _decode(response);

    if (data is Map && data['error'] != null) {
      return data['error'].toString();
    }

    return '$fallback (${response.statusCode})';
  }

  // ============================================================
  // LEAVE BALANCE
  // ============================================================

  static Future<List<Map<String, dynamic>>> getMyBalances() async {
  final response = await http.get(
    Uri.parse('$baseUrl/api/leave-balances'),
    headers: _headers,
  );

  final data = _decode(response);

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw Exception(
      _errorMessage(
        response,
        'Failed to load leave balances',
      ),
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

  throw Exception(
    'Invalid leave balance data received',
  );
}

  // ============================================================
  // MY LEAVE REQUESTS
  // ============================================================

  static Future<List<Map<String, dynamic>>> getMyRequests() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/approvals/leaves/me'),
      headers: _headers,
    );

    final data = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _errorMessage(
          response,
          'Failed to load leave requests',
        ),
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

    throw Exception(
      'Invalid leave request data received',
    );
  }

  // ============================================================
  // SUBMIT LEAVE
  // ============================================================

  static Future<Map<String, dynamic>> submitLeave({
    required String type,
    required String leaveTypeId,
    required DateTime fromDate,
    required DateTime toDate,
    required String reason,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/approvals/leaves'),
      headers: _headers,
      body: jsonEncode({
        'type': type,
        'leaveTypeId': leaveTypeId,
        'fromDate':
          '${fromDate.year.toString().padLeft(4, '0')}-'
          '${fromDate.month.toString().padLeft(2, '0')}-'
          '${fromDate.day.toString().padLeft(2, '0')}',
        'toDate':
          '${toDate.year.toString().padLeft(4, '0')}-'
          '${toDate.month.toString().padLeft(2, '0')}-'
          '${toDate.day.toString().padLeft(2, '0')}',
        'reason': reason.trim(),
      }),
    );

    final data = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        _errorMessage(
          response,
          'Failed to submit leave',
        ),
      );
    }

    if (data is Map<String, dynamic>) {
      return data;
    }

    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }

    return {};
  }
}