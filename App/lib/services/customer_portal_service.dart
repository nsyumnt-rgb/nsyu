import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/supabase_config.dart';

class CustomerPortalService {
  static final CustomerPortalService _instance = CustomerPortalService._internal();
  factory CustomerPortalService() => _instance;
  CustomerPortalService._internal();

  static const _prefCustomerTokenKey = 'nsyu_customer_access_token';
  static const _prefCustomerRefreshKey = 'nsyu_customer_refresh_token';
  static const _prefCustomerDataKey = 'nsyu_customer_data';

  String? _accessToken;
  String? _refreshToken;
  Map<String, dynamic>? _customerData;

  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  Map<String, dynamic>? get customerData => _customerData;

  String get _portalBaseUrl => '${SupabaseConfig.apiUrl}/customer-portal';

  Map<String, String> get _headers {
    final map = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_accessToken != null && _accessToken!.isNotEmpty) {
      map['Authorization'] = 'Bearer $_accessToken';
    }
    return map;
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString(_prefCustomerTokenKey);
    _refreshToken = prefs.getString(_prefCustomerRefreshKey);
    final rawCust = prefs.getString(_prefCustomerDataKey);
    if (rawCust != null) {
      try {
        _customerData = jsonDecode(rawCust) as Map<String, dynamic>;
      } catch (_) {}
    }
  }

  Future<void> _persistSession(String access, String refresh, Map<String, dynamic> customer) async {
    _accessToken = access;
    _refreshToken = refresh;
    _customerData = customer;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefCustomerTokenKey, access);
    await prefs.setString(_prefCustomerRefreshKey, refresh);
    await prefs.setString(_prefCustomerDataKey, jsonEncode(customer));
  }

  Future<void> clearSession() async {
    _accessToken = null;
    _refreshToken = null;
    _customerData = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefCustomerTokenKey);
    await prefs.remove(_prefCustomerRefreshKey);
    await prefs.remove(_prefCustomerDataKey);
  }

  /* ---------------- Auth ---------------- */
  Future<Map<String, dynamic>> requestOtp({
    String? identifier,
    String? phone,
    String? shopCode,
  }) async {
    final effectiveId = (identifier ?? phone ?? '').trim();
    final isEmail = effectiveId.contains('@');
    final url = Uri.parse('$_portalBaseUrl/auth/request-otp');
    final res = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'identifier': effectiveId,
        if (isEmail) 'email': effectiveId else 'phone': effectiveId,
        if (shopCode != null && shopCode.isNotEmpty) 'shopCode': shopCode.trim(),
      }),
    );
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return data;
    }
    throw Exception(data['message'] ?? 'Failed to send OTP (HTTP ${res.statusCode})');
  }

  Future<Map<String, dynamic>> verifyOtp({
    String? identifier,
    String? phone,
    required String otp,
    String? shopCode,
  }) async {
    final effectiveId = (identifier ?? phone ?? '').trim();
    final isEmail = effectiveId.contains('@');
    final url = Uri.parse('$_portalBaseUrl/auth/verify-otp');
    final res = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'identifier': effectiveId,
        if (isEmail) 'email': effectiveId else 'phone': effectiveId,
        'otp': otp.trim(),
        if (shopCode != null && shopCode.isNotEmpty) 'shopCode': shopCode.trim(),
      }),
    );
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      final payload = data['data'] as Map<String, dynamic>;
      await _persistSession(
        payload['accessToken'].toString(),
        payload['refreshToken'].toString(),
        payload['customer'] as Map<String, dynamic>,
      );
      return payload;
    }
    throw Exception(data['message'] ?? 'Invalid OTP (HTTP ${res.statusCode})');
  }

  Future<Map<String, dynamic>> register({
    required String shopCode,
    required String name,
    required String phone,
    String? email,
    String? address,
  }) async {
    final url = Uri.parse('$_portalBaseUrl/auth/register');
    final res = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'shopCode': shopCode.trim(),
        'name': name.trim(),
        'phone': phone.trim(),
        if (email != null && email.isNotEmpty) 'email': email.trim(),
        if (address != null && address.isNotEmpty) 'address': address.trim(),
      }),
    );
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return data;
    }
    throw Exception(data['message'] ?? 'Registration failed (HTTP ${res.statusCode})');
  }

  Future<void> logout() async {
    if (_refreshToken != null) {
      try {
        final url = Uri.parse('$_portalBaseUrl/auth/logout');
        await http.post(
          url,
          headers: _headers,
          body: jsonEncode({'refreshToken': _refreshToken}),
        );
      } catch (_) {}
    }
    await clearSession();
  }

  /* ---------------- Catalog ---------------- */
  Future<List<Map<String, dynamic>>> getCategories() async {
    final url = Uri.parse('$_portalBaseUrl/catalog/categories');
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      return (data['data'] as List<dynamic>).map((e) => e as Map<String, dynamic>).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> getProducts({
    String? search,
    int? categoryId,
    int page = 1,
    int limit = 20,
  }) async {
    final qParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
      if (search != null && search.isNotEmpty) 'search': search,
      if (categoryId != null) 'categoryId': categoryId.toString(),
    };
    final url = Uri.parse('$_portalBaseUrl/catalog/products').replace(queryParameters: qParams);
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception('Failed to load catalog');
  }

  /* ---------------- Cart ---------------- */
  Future<Map<String, dynamic>> getCart() async {
    final url = Uri.parse('$_portalBaseUrl/cart');
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return (body['data'] as Map<String, dynamic>?) ?? {};
    }
    return {};
  }

  Future<Map<String, dynamic>> setCartItem(int productId, int quantity) async {
    final url = Uri.parse('$_portalBaseUrl/cart/items/$productId');
    final res = await http.put(
      url,
      headers: _headers,
      body: jsonEncode({'quantity': quantity}),
    );
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return (body['data'] as Map<String, dynamic>?) ?? {};
    }
    final body = jsonDecode(res.body);
    throw Exception(body['message'] ?? 'Failed to update cart');
  }

  Future<Map<String, dynamic>> removeCartItem(int productId) async {
    final url = Uri.parse('$_portalBaseUrl/cart/items/$productId');
    final res = await http.delete(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return (body['data'] as Map<String, dynamic>?) ?? {};
    }
    final body = jsonDecode(res.body);
    throw Exception(body['message'] ?? 'Failed to remove item');
  }

  Future<void> clearCart() async {
    final url = Uri.parse('$_portalBaseUrl/cart');
    await http.delete(url, headers: _headers);
  }

  /* ---------------- Orders ---------------- */
  Future<Map<String, dynamic>> placeOrder({
    required String clientRequestId,
    String? note,
    String? deliveryType,
    String? shippingAddress,
  }) async {
    final url = Uri.parse('$_portalBaseUrl/orders');
    final res = await http.post(
      url,
      headers: _headers,
      body: jsonEncode({
        'clientRequestId': clientRequestId,
        if (note != null && note.isNotEmpty) 'note': note.trim(),
        if (deliveryType != null) 'deliveryType': deliveryType,
        if (shippingAddress != null && shippingAddress.isNotEmpty) 'shippingAddress': shippingAddress.trim(),
      }),
    );
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return (data['data'] as Map<String, dynamic>?) ?? {};
    }
    throw Exception(data['message'] ?? 'Failed to place order');
  }

  Future<List<Map<String, dynamic>>> listOrders({String? status, int page = 1, int limit = 20}) async {
    final qParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
      if (status != null && status.isNotEmpty && status != 'all') 'status': status,
    };
    final url = Uri.parse('$_portalBaseUrl/orders').replace(queryParameters: qParams);
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final list = body['data'] as List<dynamic>?;
      return list?.map((e) => e as Map<String, dynamic>).toList() ?? [];
    }
    return [];
  }

  Future<Map<String, dynamic>> getOrder(int id) async {
    final url = Uri.parse('$_portalBaseUrl/orders/$id');
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return (body['data'] as Map<String, dynamic>?) ?? {};
    }
    throw Exception('Order not found');
  }

  Future<void> cancelOrder(int id) async {
    final url = Uri.parse('$_portalBaseUrl/orders/$id/cancel');
    final res = await http.post(url, headers: _headers);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final body = jsonDecode(res.body);
      throw Exception(body['message'] ?? 'Failed to cancel order');
    }
  }

  /* ---------------- Bills ---------------- */
  Future<List<Map<String, dynamic>>> listBills({String? status, int page = 1, int limit = 20}) async {
    final qParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
      if (status != null && status.isNotEmpty && status != 'all') 'status': status,
    };
    final url = Uri.parse('$_portalBaseUrl/bills').replace(queryParameters: qParams);
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final list = body['data'] as List<dynamic>?;
      return list?.map((e) => e as Map<String, dynamic>).toList() ?? [];
    }
    return [];
  }

  Future<Map<String, dynamic>> getBill(int id) async {
    final url = Uri.parse('$_portalBaseUrl/bills/$id');
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return (body['data'] as Map<String, dynamic>?) ?? {};
    }
    throw Exception('Bill not found');
  }

  /* ---------------- Ledger ---------------- */
  Future<Map<String, dynamic>> getLedgerSummary() async {
    final url = Uri.parse('$_portalBaseUrl/ledger/summary');
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return (body['data'] as Map<String, dynamic>?) ?? {};
    }
    return {};
  }

  Future<List<Map<String, dynamic>>> listLedger({String? from, String? to, int page = 1, int limit = 20}) async {
    final qParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
      if (from != null && from.isNotEmpty) 'from': from,
      if (to != null && to.isNotEmpty) 'to': to,
    };
    final url = Uri.parse('$_portalBaseUrl/ledger').replace(queryParameters: qParams);
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final list = body['data'] as List<dynamic>?;
      return list?.map((e) => e as Map<String, dynamic>).toList() ?? [];
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> listPayments() async {
    final url = Uri.parse('$_portalBaseUrl/payments');
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final list = body['data'] as List<dynamic>?;
      return list?.map((e) => e as Map<String, dynamic>).toList() ?? [];
    }
    return [];
  }

  /* ---------------- Notifications ---------------- */
  Future<int> getUnreadNotificationCount() async {
    try {
      final url = Uri.parse('$_portalBaseUrl/notifications/unread-count');
      final res = await http.get(url, headers: _headers);
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        return (body['count'] as num?)?.toInt() ?? 0;
      }
    } catch (_) {}
    return 0;
  }

  Future<List<Map<String, dynamic>>> listNotifications({bool unreadOnly = false}) async {
    final qParams = <String, String>{
      if (unreadOnly) 'unread': 'true',
    };
    final url = Uri.parse('$_portalBaseUrl/notifications').replace(queryParameters: qParams);
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final list = body['data'] as List<dynamic>?;
      return list?.map((e) => e as Map<String, dynamic>).toList() ?? [];
    }
    return [];
  }

  Future<void> markNotificationRead(int id) async {
    final url = Uri.parse('$_portalBaseUrl/notifications/$id/read');
    await http.patch(url, headers: _headers);
  }

  Future<void> markAllNotificationsRead() async {
    final url = Uri.parse('$_portalBaseUrl/notifications/read-all');
    await http.post(url, headers: _headers);
  }

  /* ---------------- Profile ---------------- */
  Future<Map<String, dynamic>> getProfile() async {
    final url = Uri.parse('$_portalBaseUrl/me');
    final res = await http.get(url, headers: _headers);
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final cust = (body['data'] as Map<String, dynamic>?) ?? {};
      _customerData = cust;
      return cust;
    }
    throw Exception('Failed to load profile');
  }

  Future<void> updateProfile({String? email, String? address}) async {
    final url = Uri.parse('$_portalBaseUrl/me');
    final res = await http.patch(
      url,
      headers: _headers,
      body: jsonEncode({
        if (email != null) 'email': email.trim(),
        if (address != null) 'address': address.trim(),
      }),
    );
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      _customerData = (body['data'] as Map<String, dynamic>?) ?? _customerData;
    }
  }
}

