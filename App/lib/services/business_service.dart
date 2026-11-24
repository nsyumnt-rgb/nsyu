import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/supabase_config.dart';
import 'supabase_service.dart';

/// Categories, suppliers, purchases, stock movements and roles — the same
/// API endpoints the website uses, so both stay in sync.
class BusinessService {
  static final BusinessService _instance = BusinessService._internal();
  factory BusinessService() => _instance;
  BusinessService._internal();

  final _api = SupabaseService();
  Uri _u(String path, [Map<String, String>? q]) => Uri.parse('${SupabaseConfig.apiUrl}$path').replace(queryParameters: q);

  Map<String, dynamic> _body(http.Response res) {
    Map<String, dynamic> body = {};
    try {
      final d = jsonDecode(res.body);
      if (d is Map<String, dynamic>) body = d;
    } catch (_) {}
    if (res.statusCode >= 400 || body['success'] == false) {
      throw BusinessException(body['message']?.toString() ?? 'Request failed (HTTP ${res.statusCode})');
    }
    return body;
  }

  List<Map<String, dynamic>> _list(http.Response res) =>
      ((_body(res)['data'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

  /* ── Products (with real database ids) ── */
  Future<List<Map<String, dynamic>>> products({int? shopId}) async =>
      _list(await _api.authedGet(_u('/products', {if (shopId != null) 'shopId': '$shopId', 'limit': '500'})));

  /* ── Categories ── */
  Future<List<Map<String, dynamic>>> categories() async => _list(await _api.authedGet(_u('/categories')));
  Future<void> createCategory(String name) async => _body(await _api.authedPost(_u('/categories'), {'name': name, 'status': 'active'}));
  Future<void> renameCategory(int id, String name) async => _body(await _api.authedPut(_u('/categories/$id'), {'name': name}));
  Future<void> setCategoryStatus(int id, bool active) async =>
      _body(await _api.authedPatch(_u('/categories/$id/status'), {'status': active ? 'active' : 'inactive'}));
  Future<void> deleteCategory(int id) async => _body(await _api.authedDelete(_u('/categories/$id')));

  /* ── Suppliers ── */
  Future<List<Map<String, dynamic>>> suppliers() async => _list(await _api.authedGet(_u('/suppliers')));
  Future<Map<String, dynamic>> supplier(int id) async =>
      Map<String, dynamic>.from(_body(await _api.authedGet(_u('/suppliers/$id')))['data'] as Map);
  Future<void> saveSupplier(Map<String, dynamic> data, {int? id}) async => _body(
        id == null ? await _api.authedPost(_u('/suppliers'), data) : await _api.authedPut(_u('/suppliers/$id'), data),
      );

  /* ── Purchases ── */
  Future<List<Map<String, dynamic>>> purchases() async => _list(await _api.authedGet(_u('/purchases')));
  Future<Map<String, dynamic>> purchase(int id) async =>
      Map<String, dynamic>.from(_body(await _api.authedGet(_u('/purchases/$id')))['data'] as Map);
  Future<String> createPurchase({
    required int supplierId,
    required List<Map<String, dynamic>> items, // productId, quantity, rate, taxPercent
    double paid = 0,
    String paymentMethod = 'cash',
    String notes = '',
    required String requestId,
  }) async {
    final b = _body(await _api.authedPost(_u('/purchases'), {
      'supplierId': supplierId,
      'items': items,
      'initialPaid': paid,
      'paymentMethod': paymentMethod,
      if (notes.isNotEmpty) 'notes': notes,
      'clientRequestId': requestId,
    }));
    return b['message']?.toString() ?? 'Purchase saved';
  }

  Future<String> payPurchase(int id, double amount, String method, String key) async =>
      _body(await _api.authedPost(_u('/purchases/$id/payment'), {'amount': amount, 'paymentMethod': method, 'idempotencyKey': key}))['message']
          ?.toString() ??
      'Payment recorded';

  /* ── Stock movements ── */
  Future<String> recordMovement({required int productId, required String type, required int quantity, String notes = ''}) async =>
      _body(await _api.authedPost(_u('/inventory/movement'), {
        'productId': productId,
        'type': type,
        'quantity': quantity,
        if (notes.isNotEmpty) 'notes': notes,
      }))['message']
          ?.toString() ??
      'Stock updated';

  Future<List<Map<String, dynamic>>> stockHistory({int? productId, int limit = 100}) async =>
      _list(await _api.authedGet(_u('/inventory/history', {if (productId != null) 'productId': '$productId', 'limit': '$limit'})));

  /* ── Shops & stock transfers between them ── */
  Future<List<Map<String, dynamic>>> shops() async => _list(await _api.authedGet(_u('/shops')));

  /// One page of transfers plus the summary counts.
  Future<Map<String, dynamic>> transfers({String? status, int page = 1, int limit = 20}) async {
    final body = _body(await _api.authedGet(_u('/inventory/transfers', {
      if (status != null && status != 'all') 'status': status,
      'page': '$page',
      'limit': '$limit',
    })));
    return Map<String, dynamic>.from((body['data'] as Map?) ?? {});
  }

  Future<Map<String, dynamic>> transfer(int id) async =>
      Map<String, dynamic>.from((_body(await _api.authedGet(_u('/inventory/transfers/$id')))['data'] as Map?) ?? {});

  /// status: completed (moves now), in_transit (leaves source now), pending (moves nothing yet).
  Future<String> createTransfer({
    required int fromShopId,
    required int toShopId,
    required List<Map<String, int>> items,
    String status = 'completed',
    String notes = '',
  }) async =>
      _body(await _api.authedPost(_u('/inventory/transfers'), {
        'fromShopId': fromShopId,
        'toShopId': toShopId,
        'items': items,
        'status': status,
        if (notes.isNotEmpty) 'notes': notes,
      }))['message']
          ?.toString() ??
      'Transfer created';

  Future<String> dispatchTransfer(int id) async =>
      _body(await _api.authedPut(_u('/inventory/transfers/$id/dispatch'), {}))['message']?.toString() ?? 'Dispatched';
  Future<String> receiveTransfer(int id) async =>
      _body(await _api.authedPut(_u('/inventory/transfers/$id/receive'), {}))['message']?.toString() ?? 'Received';
  Future<String> cancelTransfer(int id, String reason) async =>
      _body(await _api.authedPut(_u('/inventory/transfers/$id/cancel'), {if (reason.isNotEmpty) 'reason': reason}))['message']?.toString() ??
      'Transfer cancelled';

  /* ── Shop billing, tax & payment settings (same store as the website's Settings) ── */
  Future<Map<String, dynamic>> shopSettings(int shopId) async =>
      Map<String, dynamic>.from((_body(await _api.authedGet(_u('/shops/$shopId/settings')))['data'] as Map?) ?? {});
  Future<void> saveShopSettings(int shopId, Map<String, dynamic> settings) async =>
      _body(await _api.authedPut(_u('/shops/$shopId/settings'), {'settings': settings}));

  /* ── Roles & permissions ── */
  Future<List<Map<String, dynamic>>> roles() async => _list(await _api.authedGet(_u('/roles')));
  Future<List<Map<String, dynamic>>> modules() async => _list(await _api.authedGet(_u('/roles/modules')));
  Future<void> createRole(String name, String description) async =>
      _body(await _api.authedPost(_u('/roles'), {'name': name, 'description': description}));
  Future<void> saveRolePermissions(int roleId, List<Map<String, dynamic>> permissions) async =>
      _body(await _api.authedPut(_u('/roles/$roleId/permissions'), {'permissions': permissions}));
  Future<void> deleteRole(int roleId) async => _body(await _api.authedDelete(_u('/roles/$roleId')));
}

class BusinessException implements Exception {
  final String message;
  BusinessException(this.message);
  @override
  String toString() => message;
}
