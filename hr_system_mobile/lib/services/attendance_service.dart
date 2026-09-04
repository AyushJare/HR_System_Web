import 'dart:convert';
import 'package:http/http.dart' as http;
import 'auth_service.dart';

class AttendanceService {
  static String get baseUrl => AuthService.baseUrl;

  static Map<String, String> get _headers {
    return AuthService.authHeaders;
  }

  // ============================================================
  // GET MONTHLY ATTENDANCE SUMMARY
  // ============================================================
  static Future<Map<String, dynamic>> getAttendanceSummary(
    String month,
  ) async {
    final parts = month.split('-');

    if (parts.length != 2) {
      throw Exception('Invalid month format');
    }

    final year = int.tryParse(parts[0]);
    final monthNumber = int.tryParse(parts[1]);

    if (year == null ||
        monthNumber == null ||
        monthNumber < 1 ||
        monthNumber > 12) {
      throw Exception('Invalid month');
    }
    print(
  'SUMMARY URL: $baseUrl/api/attendance/summary?year=$year&month=$monthNumber',
);

    final response = await http.get(
      Uri.parse(
        '$baseUrl/api/attendance/summary'
        '?year=$year&month=$monthNumber',
      ),
      headers: _headers,
    );

    final data = _decode(response);

    if (response.statusCode < 200 ||
        response.statusCode >= 300) {
      throw Exception(
        _errorMessage(
          data,
          'Failed to load attendance summary',
          response.statusCode,
        ),
      );
    }

    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }

    throw Exception(
      'Invalid attendance summary received from server',
    );
  }

  // ============================================================
  // CHECK IN
  // ============================================================
  static Future<Map<String, dynamic>> checkIn() async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/attendance'),
      headers: _headers,
      body: jsonEncode({
        'action': 'LOGIN',
        'date': _todayDate(),
      }),
    );

    return _handleResponse(
      response,
      'Check-in failed',
    );
  }

  // ============================================================
  // CHECK IN WITH LOCATION (NEW METHOD)
  // ============================================================
  static Future<Map<String, dynamic>> checkInWithLocation(
    Map<String, dynamic> location,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/attendance/check-in'),
        headers: _headers,
        body: jsonEncode({
          'latitude': location['latitude'],
          'longitude': location['longitude'],
          'gpsAccuracy': location['accuracy'],
          'deviceId': 'flutter-web',
          'isMockLocation': false,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 201) {
        return {
          'success': true,
          'message': data['message'] ?? 'Checked in successfully',
          'attendance': data['attendance'],
          'distance': data['distance'] ?? 0,
          'status': 'PRESENT',
        };
      } else if (response.statusCode == 202) {
        return {
          'success': false,
          'requiresApproval': true,
          'message': data['message'] ?? 'Out of radius. Awaiting approval.',
          'distance': data['distance'] ?? 0,
          'approvalId': data['approvalId'],
          'statusCode': 202,
        };
      } else {
        return {
          'success': false,
          'message': data['error'] ?? 'Check-in failed',
          'statusCode': response.statusCode,
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error: ${e.toString()}',
      };
    }
  }

  // ============================================================
  // CHECK OUT
  // ============================================================
  static Future<Map<String, dynamic>> checkOut() async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/attendance'),
      headers: _headers,
      body: jsonEncode({
        'action': 'LOGOUT',
        'date': _todayDate(),
      }),
    );

    return _handleResponse(
      response,
      'Check-out failed',
    );
  }

  // ============================================================
  // GET TODAY'S ATTENDANCE
  // ============================================================
  static Future<Map<String, dynamic>?> getTodayAttendance() async {
  final now = DateTime.now();

  final today =
      '${now.year.toString().padLeft(4, '0')}-'
      '${now.month.toString().padLeft(2, '0')}-'
      '${now.day.toString().padLeft(2, '0')}';

  final response = await http.get(
    Uri.parse('$baseUrl/api/attendance?date=$today'),
    headers: _headers,
  );

  final data = _decode(response);

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw Exception(
      _errorMessage(
        data,
        'Failed to load today attendance',
        response.statusCode,
      ),
    );
  }

  if (data is! Map) return null;

  final employees = data['employees'];

  if (employees is! List || employees.isEmpty) {
    return null;
  }

  final employeeData = employees.first;

  if (employeeData is! Map) {
    return null;
  }

  final attendance = employeeData['attendance'];

  if (attendance is! Map) {
    return null;
  }

  return Map<String, dynamic>.from(attendance);
}

  // ============================================================
  // TODAY'S DATE
  // ============================================================
  static String _todayDate() {
    final now = DateTime.now();

    return '${now.year.toString().padLeft(4, '0')}-'
        '${now.month.toString().padLeft(2, '0')}-'
        '${now.day.toString().padLeft(2, '0')}';
  }

  // ============================================================
  // JSON DECODER
  // ============================================================
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

  // ============================================================
  // RESPONSE HANDLER
  // ============================================================
  static Map<String, dynamic> _handleResponse(
    http.Response response,
    String defaultError,
  ) {
    final data = _decode(response);

    if (response.statusCode < 200 ||
        response.statusCode >= 300) {
      throw Exception(
        _errorMessage(
          data,
          defaultError,
          response.statusCode,
        ),
      );
    }

    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }

    throw Exception(
      'Invalid response received from server',
    );
  }

  // ============================================================
  // ERROR MESSAGE
  // ============================================================
  static String _errorMessage(
    dynamic data,
    String defaultMessage,
    int statusCode,
  ) {
    if (data is Map) {
      final error = data['error'];

      if (error != null &&
          error.toString().trim().isNotEmpty) {
        return error.toString();
      }

      final message = data['message'];

      if (message != null &&
          message.toString().trim().isNotEmpty) {
        return message.toString();
      }
    }

    return '$defaultMessage ($statusCode)';
  }
}