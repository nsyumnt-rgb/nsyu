import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../config/supabase_config.dart';

/// Central HTTP Client for NSYU SMS
class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  ApiClient._internal();

  Map<String, String> get headers {
    final map = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (SupabaseConfig.authToken != null && SupabaseConfig.authToken!.isNotEmpty) {
      map['Authorization'] = 'Bearer ${SupabaseConfig.authToken}';
    }
    return map;
  }

  Future<http.Response> get(Uri url, {Duration timeout = const Duration(seconds: 12)}) async {
    return http.get(url, headers: headers).timeout(timeout);
  }

  Future<http.Response> post(Uri url, Map<String, dynamic> body, {Duration timeout = const Duration(seconds: 15)}) async {
    return http.post(url, headers: headers, body: jsonEncode(body)).timeout(timeout);
  }

  Future<http.Response> put(Uri url, Map<String, dynamic> body, {Duration timeout = const Duration(seconds: 15)}) async {
    return http.put(url, headers: headers, body: jsonEncode(body)).timeout(timeout);
  }

  Future<http.Response> delete(Uri url, {Duration timeout = const Duration(seconds: 12)}) async {
    return http.delete(url, headers: headers).timeout(timeout);
  }
}
