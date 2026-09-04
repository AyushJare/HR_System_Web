import 'api_service.dart';

class UserService {
  static Future<Map<String, dynamic>> getCurrentUser() async {
    final responseData = await ApiService.get('/api/auth/me');

    if (responseData is! Map<String, dynamic>) {
      throw Exception('Invalid user data received');
    }

    final data = responseData['data'];

    if (data is! Map<String, dynamic>) {
      throw Exception('Invalid user data received');
    }

    return data;
  }
}