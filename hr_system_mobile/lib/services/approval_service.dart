import 'dart:convert';
import 'package:http/http.dart' as http;

import 'auth_service.dart';
import 'api_service.dart';

class ApprovalService {
  static String get baseUrl => AuthService.baseUrl;

  static Map<String, String> get _headers => AuthService.authHeaders;

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

  // --------------------------------------------------
  // LOGIN / LOCATION APPROVALS
  // --------------------------------------------------

  static Future<List<Map<String, dynamic>>> getLoginApprovals() async {
    return _getApprovals(
      type: 'LOCATION_BASED_LOGIN',
    );
  }

  // --------------------------------------------------
  // LEAVE APPROVALS
  // --------------------------------------------------

  static Future<List<Map<String, dynamic>>> getLeaveApprovals() async {
    return _getApprovals(
      type: 'LEAVE',
    );
  }

  // --------------------------------------------------
  // LEAVE TYPES
  // --------------------------------------------------

  static Future<List<Map<String, dynamic>>> getLeaveTypes() async {
    final data = await ApiService.get(
      '/api/leave-types',
    );

    return _listFromResponse(data);
  }

  // --------------------------------------------------
  // ATTENDANCE CORRECTION APPROVALS
  // --------------------------------------------------

  static Future<List<Map<String, dynamic>>>
      getAttendanceCorrectionApprovals() async {
    return _getApprovals(
      type: 'ATTENDANCE_CORRECTION',
    );
  }

  // --------------------------------------------------
  // COMMON APPROVAL GET
  // --------------------------------------------------

  static Future<List<Map<String, dynamic>>> _getApprovals({
    required String type,
  }) async {
    final data = await ApiService.get(
      '/api/approvals?type=$type&status=PENDING',
    );

    return _listFromResponse(data);
  }

  // --------------------------------------------------
  // APPROVE
  // --------------------------------------------------

  static Future<void> approveLogin(String id) async {
    await _decide(
      id,
      'APPROVED',
      'Failed to approve login',
    );
  }

  static Future<void> approveLeave(String id) async {
    await _decide(
      id,
      'APPROVED',
      'Failed to approve leave',
    );
  }

  static Future<void> approveAttendanceCorrection(String id) async {
    await _decide(
      id,
      'APPROVED',
      'Failed to approve attendance correction',
    );
  }

  // --------------------------------------------------
  // REJECT
  // --------------------------------------------------

  static Future<void> rejectLogin(
    String id,
    String reason,
  ) async {
    await _decide(
      id,
      'REJECTED',
      'Failed to reject login',
      remarks: reason,
    );
  }

  static Future<void> rejectLeave(
    String id,
    String reason,
  ) async {
    await _decide(
      id,
      'REJECTED',
      'Failed to reject leave',
      remarks: reason,
    );
  }

  static Future<void> rejectAttendanceCorrection(
    String id,
    String reason,
  ) async {
    await _decide(
      id,
      'REJECTED',
      'Failed to reject attendance correction',
      remarks: reason,
    );
  }

  // --------------------------------------------------
  // COMMON APPROVE / REJECT
  // --------------------------------------------------

  static Future<void> _decide(
    String id,
    String decision,
    String fallback, {
    String? remarks,
  }) async {
    final body = <String, dynamic>{
      'decision': decision,
    };

    if (remarks != null && remarks.trim().isNotEmpty) {
      body['remarks'] = remarks.trim();
    }

    try {
      await ApiService.put(
        '/api/approvals/$id',
        body,
      );
    } catch (e) {
      throw Exception(
        e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  // --------------------------------------------------
  // RESPONSE PARSER
  // --------------------------------------------------

  static List<Map<String, dynamic>> _listFromResponse(
    dynamic data,
  ) {
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
      'Invalid approval data received',
    );
  }
}