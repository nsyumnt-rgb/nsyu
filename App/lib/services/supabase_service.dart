import 'dart:convert';
import 'package:flutter/foundation.dart' show debugPrint;
import 'package:http/http.dart' as http;
import '../config/supabase_config.dart';
import '../models/app_settings.dart';
import '../models/customer.dart';
import '../models/product.dart';
import '../models/saved_bill.dart';
import '../models/saved_order.dart';
import '../models/saved_payment.dart';
import '../models/customer_ledger_entry.dart';
import '../models/visibility_settings.dart';

/// Central Data Access Service replacing all Google Sheets & Excel operations
/// with the Supabase PostgreSQL database.
class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  Map<String, String> get _headers {
    final map = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (SupabaseConfig.authToken != null && SupabaseConfig.authToken!.isNotEmpty) {
      map['Authorization'] = 'Bearer ${SupabaseConfig.authToken}';
    }
    return map;
  }

  /// Checks health of the API server and its connection to Supabase PostgreSQL
  Future<Map<String, dynamic>> checkHealth() async {
    try {
      final url = Uri.parse('${SupabaseConfig.apiUrl}/health');
      final res = await http.get(url).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
      return {
        'success': false,
        'status': 'error',
        'message': 'HTTP ${res.statusCode}: ${res.body}',
      };
    } catch (e) {
      return {
        'success': false,
        'status': 'unreachable',
        'message': e.toString(),
      };
    }
  }

  /// Ensures authentication with the Supabase database backend
  Future<String?> ensureAuth({bool force = false, String? mobile, String? password}) async {
    if (!force && SupabaseConfig.authToken != null && SupabaseConfig.authToken!.isNotEmpty) {
      return SupabaseConfig.authToken;
    }

    if (mobile == null || password == null || mobile.trim().isEmpty || password.trim().isEmpty) {
      return SupabaseConfig.authToken;
    }

    try {
      final url = Uri.parse('${SupabaseConfig.apiUrl}/auth/login');
      final email = mobile.trim();
      final res = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password.trim()}),
      );

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final token = data['data']?['accessToken'] ?? data['token'];
        if (token != null) {
          await SupabaseConfig.updateConfig(authToken: token.toString());
          return token.toString();
        }
      }
    } catch (_) {}
    return null;
  }

  Future<http.Response> _getWithRetry(Uri url) async {
    await ensureAuth();
    var res = await http.get(url, headers: _headers);
    if (res.statusCode == 401) {
      await ensureAuth(force: true);
      res = await http.get(url, headers: _headers);
    }
    return res;
  }

  Future<http.Response> _postWithRetry(Uri url, Map<String, dynamic> body) async {
    await ensureAuth();
    var res = await http.post(url, headers: _headers, body: jsonEncode(body));
    if (res.statusCode == 401) {
      await ensureAuth(force: true);
      res = await http.post(url, headers: _headers, body: jsonEncode(body));
    }
    return res;
  }

  Future<http.Response> _putWithRetry(Uri url, Map<String, dynamic> body) async {
    await ensureAuth();
    var res = await http.put(url, headers: _headers, body: jsonEncode(body));
    if (res.statusCode == 401) {
      await ensureAuth(force: true);
      res = await http.put(url, headers: _headers, body: jsonEncode(body));
    }
    return res;
  }

  // =========================================================================
  // PRODUCTS & INVENTORY CRUD (Replaces SheetService & ProductWriteService)
  // =========================================================================

  /// Fetches the product catalog from Supabase PostgreSQL
  Future<List<Product>> fetchProducts() async {
    final url = Uri.parse('${SupabaseConfig.apiUrl}/products');
    final res = await _getWithRetry(url);

    if (res.statusCode != 200) {
      throw Exception('Failed to load products from Supabase (HTTP ${res.statusCode}): ${res.body}');
    }

    final decoded = jsonDecode(res.body);
    final List list = decoded['data'] ?? (decoded is List ? decoded : []);
    final products = <Product>[];

    for (var i = 0; i < list.length; i++) {
      final item = list[i];
      if (item is Map<String, dynamic>) {
        products.add(Product.fromSupabase(item, index: i + 1));
      }
    }
    return products;
  }

  /// Updates a product's margin price and recomputed selling price in Supabase PostgreSQL
  Future<double> updateMarginPrice({
    required String productCode,
    required double purchase,
    required double newMarginPrice,
  }) async {
    await ensureAuth();
    final newSelling = purchase + newMarginPrice;

    // First resolve the product ID by SKU/Code
    final lookupUrl = Uri.parse('${SupabaseConfig.apiUrl}/products/${Uri.encodeComponent(productCode)}');
    final lookupRes = await http.get(lookupUrl, headers: _headers);

    int? productId;
    if (lookupRes.statusCode == 200) {
      final decoded = jsonDecode(lookupRes.body);
      productId = decoded['data']?['id'];
    }

    if (productId != null) {
      final updateUrl = Uri.parse('${SupabaseConfig.apiUrl}/products/$productId');
      final updateRes = await http.put(
        updateUrl,
        headers: _headers,
        body: jsonEncode({
          'purchase_price': purchase,
          'selling_price': newSelling,
          'mrp': newSelling,
        }),
      );
      if (updateRes.statusCode >= 300) {
        throw Exception('Could not update margin price in Supabase: ${updateRes.body}');
      }
    } else {
      throw Exception('Product with code "$productCode" not found in Supabase.');
    }

    return newSelling;
  }

  /// Adds a new product to Supabase PostgreSQL
  Future<int> addProduct({
    required String code,
    required String desc,
    String spec = '',
    String category = '',
    int pkg = 1,
    required double purchase,
    double marginPrice = 0,
    required double sellingPrice,
    int stock = 0,
  }) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/products');
    final res = await http.post(
      url,
      headers: _headers,
      body: jsonEncode({
        'sku': code,
        'name': desc,
        'description': spec,
        'brand': category.isNotEmpty ? category : 'NSYU',
        'purchase_price': purchase,
        'selling_price': sellingPrice,
        'mrp': purchase + marginPrice,
        'min_stock': pkg,
        'opening_stock': {'quantity': stock, 'shopId': SupabaseConfig.shopId},
      }),
    );

    if (res.statusCode >= 300) {
      throw Exception('Failed to add product to Supabase: ${res.body}');
    }

    final decoded = jsonDecode(res.body);
    final id = decoded['data']?['id'];
    return (id is int) ? id : (int.tryParse(id?.toString() ?? '1') ?? 1);
  }

  /// Deactivates / deletes a product in Supabase PostgreSQL
  Future<void> deleteProduct(dynamic productId) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/products/$productId');
    final res = await http.delete(url, headers: _headers);
    if (res.statusCode >= 300) {
      throw Exception('Failed to delete product from Supabase: ${res.body}');
    }
  }

  // =========================================================================
  // CUSTOMERS CRUD (Replaces CustomerSheetService & CustomerStoreService)
  // =========================================================================

  /// Fetches the customer directory from Supabase PostgreSQL
  Future<List<Customer>> fetchCustomers() async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/customers');
    final res = await http.get(url, headers: _headers);

    if (res.statusCode != 200) {
      throw Exception('Failed to load customers from Supabase (HTTP ${res.statusCode}): ${res.body}');
    }

    final decoded = jsonDecode(res.body);
    final List list = decoded['data'] ?? (decoded is List ? decoded : []);
    final customers = <Customer>[];

    for (final item in list) {
      if (item is Map<String, dynamic>) {
        customers.add(Customer.fromSupabase(item));
      }
    }
    return customers;
  }

  /// Adds a new customer to Supabase PostgreSQL
  Future<Customer> addCustomer({
    required String name,
    required String mobile,
    String address = '',
    double openingBalance = 0.0,
  }) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/customers');
    final res = await http.post(
      url,
      headers: _headers,
      body: jsonEncode({
        'name': name.trim(),
        'phone': mobile.trim(),
        'address': address.trim(),
        'opening_balance': openingBalance,
        'openingBalance': openingBalance,
      }),
    );

    if (res.statusCode >= 300) {
      throw Exception('Failed to create customer in Supabase: ${res.body}');
    }

    final decoded = jsonDecode(res.body);
    return Customer.fromSupabase(decoded['data'] ?? {});
  }

  /// Updates an existing customer in Supabase PostgreSQL
  Future<void> updateCustomer(Customer customer) async {
    await ensureAuth();
    final id = int.tryParse(customer.id.replaceAll(RegExp(r'[^0-9]'), '')) ?? customer.id;
    final url = Uri.parse('${SupabaseConfig.apiUrl}/customers/$id');
    final res = await http.put(
      url,
      headers: _headers,
      body: jsonEncode({
        'name': customer.name.trim(),
        'phone': customer.mobile.trim(),
        'address': customer.address.trim(),
      }),
    );
    if (res.statusCode >= 300) {
      throw Exception('Failed to update customer in Supabase: ${res.body}');
    }
  }

  /// Deletes a customer in Supabase PostgreSQL
  Future<void> deleteCustomer(String id) async {
    await ensureAuth();
    final numericId = int.tryParse(id.replaceAll(RegExp(r'[^0-9]'), '')) ?? id;
    final url = Uri.parse('${SupabaseConfig.apiUrl}/customers/$numericId');
    final res = await http.delete(url, headers: _headers);
    if (res.statusCode >= 300) {
      throw Exception('Failed to delete customer in Supabase: ${res.body}');
    }
  }

  // =========================================================================
  // BILLS & INVOICES CRUD (Replaces BillsSheetService & BillsStoreService)
  // =========================================================================

  /// Fetches bills / sales invoices from Supabase PostgreSQL
  Future<List<SavedBill>> fetchBills() async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/sales?limit=100');
    final res = await http.get(url, headers: _headers);

    if (res.statusCode != 200) {
      throw Exception('Failed to load bills from Supabase (HTTP ${res.statusCode}): ${res.body}');
    }

    final decoded = jsonDecode(res.body);
    final List list = decoded['data'] ?? (decoded is List ? decoded : []);
    final bills = <SavedBill>[];

    for (final item in list) {
      if (item is Map<String, dynamic>) {
        bills.add(SavedBill.fromSupabase(item));
      }
    }
    return bills;
  }

  /// Creates a new sales bill in Supabase PostgreSQL with line items & ledger entry
  Future<SavedBill> createBill(
    SavedBill bill, {
    dynamic customerId,
    String paymentMethod = 'cash',
    double billDiscount = 0.0,
  }) async {
    int? resolvedCustomerId = customerId != null ? int.tryParse(customerId.toString().replaceAll(RegExp(r'[^0-9]'), '')) : null;

    if (resolvedCustomerId == null || resolvedCustomerId == 0) {
      // Find customer by name or mobile
      final cleanName = bill.customerName.trim();
      if (cleanName.isNotEmpty && !cleanName.toLowerCase().contains('walk-in') && !cleanName.toLowerCase().contains('walk_in')) {
        final customerRes = await _getWithRetry(
          Uri.parse('${SupabaseConfig.apiUrl}/customers?search=${Uri.encodeComponent(cleanName)}'),
        );
        if (customerRes.statusCode == 200) {
          final data = jsonDecode(customerRes.body);
          final List customers = data['data'] ?? [];
          if (customers.isNotEmpty) {
            resolvedCustomerId = customers.first['id'];
          }
        }
      }
    }

    // Resolve products to valid backend product IDs
    List<Product> prods = [];
    try {
      prods = await fetchProducts();
    } catch (_) {}

    final itemsPayload = bill.items.map((i) {
      Product? matched;
      if (prods.isNotEmpty) {
        for (final p in prods) {
          if (p.desc.trim().toLowerCase() == i.desc.trim().toLowerCase() ||
              p.code.trim().toLowerCase() == i.desc.trim().toLowerCase()) {
            matched = p;
            break;
          }
        }
        matched ??= prods.first;
      }

      final pId = matched?.sno ?? 1;
      return {
        'productId': pId,
        'quantity': i.qty,
        'rate': i.price,
        'discountPercent': 0,
        'taxPercent': 0,
      };
    }).toList();

    final url = Uri.parse('${SupabaseConfig.apiUrl}/sales');
    final payload = <String, dynamic>{
      'shopId': SupabaseConfig.shopId,
      'items': itemsPayload,
      'billDiscount': billDiscount,
      'paymentMethod': paymentMethod.toLowerCase(),
      'paidAmount': bill.paidAmount,
      'notes': 'Created from Flutter App',
    };

    if (resolvedCustomerId != null && resolvedCustomerId > 0) {
      payload['customerId'] = resolvedCustomerId;
    } else {
      payload['customer'] = {
        'name': bill.customerName.trim().isNotEmpty ? bill.customerName.trim() : 'Walk-in Customer',
      };
    }

    final res = await _postWithRetry(url, payload);
    if (res.statusCode >= 300) {
      debugPrint('⚠️ Notice: Could not sync bill to backend (${res.statusCode}): ${res.body}');
      return bill;
    }

    try {
      final decoded = jsonDecode(res.body);
      final saleData = decoded['data'];
      if (saleData is Map<String, dynamic>) {
        final backendBill = SavedBill.fromSupabase(saleData);
        backendBill.pdfPath = bill.pdfPath;
        backendBill.imagePath = bill.imagePath;
        return backendBill;
      }
    } catch (_) {}

    return bill;
  }

  /// Fetches authoritative live customer outstanding balance from backend ledger
  Future<double> fetchCustomerOutstanding(dynamic customerId) async {
    final cleanId = int.tryParse(customerId.toString().replaceAll(RegExp(r'[^0-9]'), '')) ?? customerId;
    final url = Uri.parse('${SupabaseConfig.apiUrl}/ledger/customer/$cleanId?allShops=true');
    final res = await _getWithRetry(url);
    if (res.statusCode == 200) {
      final decoded = jsonDecode(res.body);
      final currentBalance = decoded['data']?['currentBalance'];
      if (currentBalance != null) {
        return (currentBalance is num) ? currentBalance.toDouble() : (double.tryParse(currentBalance.toString()) ?? 0.0);
      }
    }
    return 0.0;
  }

  /// Fetches full chronological ledger for a customer with summary balances
  Future<Map<String, dynamic>> fetchCustomerLedger(dynamic customerId, {bool allShops = true}) async {
    final cleanId = int.tryParse(customerId.toString().replaceAll(RegExp(r'[^0-9]'), '')) ?? customerId;
    final url = Uri.parse('${SupabaseConfig.apiUrl}/ledger/customer/$cleanId?allShops=$allShops');
    final res = await _getWithRetry(url);
    if (res.statusCode != 200) {
      throw Exception('Failed to load ledger for customer $customerId (HTTP ${res.statusCode}): ${res.body}');
    }
    final decoded = jsonDecode(res.body);
    final data = decoded['data'] ?? {};
    final entriesRaw = (data['entries'] as List? ?? []);
    final entries = entriesRaw
        .whereType<Map<String, dynamic>>()
        .map((e) => CustomerLedgerEntry.fromJson(e))
        .toList();

    return {
      'currentBalance': (data['currentBalance'] is num) ? (data['currentBalance'] as num).toDouble() : 0.0,
      'shopBalance': (data['shopBalance'] is num) ? (data['shopBalance'] as num).toDouble() : 0.0,
      'totalDebit': (data['totalDebit'] is num) ? (data['totalDebit'] as num).toDouble() : 0.0,
      'totalCredit': (data['totalCredit'] is num) ? (data['totalCredit'] as num).toDouble() : 0.0,
      'entries': entries,
    };
  }

  /// Fetches all customers with outstanding balances
  Future<List<Customer>> fetchOutstandingBalances() async {
    final url = Uri.parse('${SupabaseConfig.apiUrl}/ledger/outstanding');
    final res = await _getWithRetry(url);
    if (res.statusCode != 200) return [];
    final decoded = jsonDecode(res.body);
    final List list = decoded['data'] ?? [];
    return list.whereType<Map<String, dynamic>>().map((c) => Customer.fromSupabase(c)).toList();
  }

  /// Updates a bill status in Supabase PostgreSQL
  Future<void> updateBillStatus(String billNumber, BillStatus status, {double paidAmount = 0}) async {
    await ensureAuth();
    final lookupUrl = Uri.parse('${SupabaseConfig.apiUrl}/sales/${Uri.encodeComponent(billNumber)}');
    final lookupRes = await http.get(lookupUrl, headers: _headers);

    if (lookupRes.statusCode == 200) {
      final saleId = jsonDecode(lookupRes.body)['data']?['id'];
      if (saleId != null) {
        final statusStr = status == BillStatus.paid
            ? 'paid'
            : (status == BillStatus.cancelled ? 'cancelled' : 'unpaid');
        await http.put(
          Uri.parse('${SupabaseConfig.apiUrl}/sales/$saleId'),
          headers: _headers,
          body: jsonEncode({'status': statusStr, 'paidAmount': paidAmount}),
        );
      }
    }
  }

  // =========================================================================
  // PAYMENTS & LEDGER CRUD (Replaces PaymentsSheetService & PaymentsStoreService)
  // =========================================================================

  /// Fetches payment collection receipts from Supabase PostgreSQL
  Future<List<SavedPayment>> fetchPayments() async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/payments');
    final res = await http.get(url, headers: _headers);

    if (res.statusCode != 200) {
      throw Exception('Failed to load payments from Supabase (HTTP ${res.statusCode}): ${res.body}');
    }

    final decoded = jsonDecode(res.body);
    final List list = decoded['data'] ?? (decoded is List ? decoded : []);
    final payments = <SavedPayment>[];

    for (final item in list) {
      if (item is Map<String, dynamic>) {
        payments.add(SavedPayment.fromSupabase(item));
      }
    }
    return payments;
  }

  /// Records a payment in Supabase PostgreSQL against customer and invoice
  Future<SavedPayment> recordPayment(SavedPayment payment) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/payments');
    final methodStr = payment.method.label.toLowerCase().replaceAll(' ', '_');

    final payload = {
      'shopId': SupabaseConfig.shopId,
      'customerId': int.tryParse(payment.customerId) ?? 1,
      'amount': payment.amount,
      'type': 'customer_receipt',
      'method': methodStr,
      'transactionId': payment.transactionId,
      'paymentDate': payment.date.toIso8601String(),
      'notes': payment.remarks,
    };

    final res = await http.post(url, headers: _headers, body: jsonEncode(payload));
    if (res.statusCode >= 300) {
      debugPrint('⚠️ Notice: Could not sync payment to Supabase (${res.statusCode}): ${res.body}');
    }
    return payment;
  }

  // =========================================================================
  // ORDERS CRUD (Replaces OrdersSheetService & OrdersStoreService)
  // =========================================================================

  /// Fetches orders from Supabase PostgreSQL
  Future<List<SavedOrder>> fetchOrders() async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/orders');
    final res = await http.get(url, headers: _headers);

    if (res.statusCode != 200) {
      return [];
    }

    final decoded = jsonDecode(res.body);
    final List list = decoded['data'] ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map((item) => SavedOrder.fromJson(item))
        .toList();
  }

  /// Creates a new order in Supabase PostgreSQL
  Future<SavedOrder> createOrder(SavedOrder order) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/orders');
    final payload = {
      'orderNumber': order.orderNumber,
      'customerId': int.tryParse(order.customerId),
      'customer': {
        'name': order.customerName,
        'phone': order.customerPhone,
        'address': order.customerAddress,
      },
      'orderDate': order.date.toIso8601String(),
      'expectedDeliveryDate': order.expectedDeliveryDate?.toIso8601String(),
      'discountAmount': order.discountAmount,
      'taxPercent': 18,
      'remarks': order.remarks,
      'status': order.status.name,
      'items': order.items.map((i) => {
            'productName': i.desc,
            'sku': i.sku,
            'availableStock': i.availableStock,
            'quantity': i.qty,
            'rate': i.price,
            'discountPercent': i.discountPercent,
          }).toList(),
    };

    final res = await http.post(url, headers: _headers, body: jsonEncode(payload));
    if (res.statusCode == 201 || res.statusCode == 200) {
      final data = jsonDecode(res.body)['data'];
      if (data != null && data is Map<String, dynamic>) {
        return SavedOrder.fromJson(data);
      }
    }
    return order;
  }

  /// Updates an order status in Supabase PostgreSQL
  Future<void> updateOrderStatus(dynamic orderIdOrNumber, OrderStatus status) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/orders/$orderIdOrNumber/status');
    final statusName = switch (status) {
      OrderStatus.pending => 'pending',
      OrderStatus.confirmed => 'confirmed',
      OrderStatus.delivered => 'delivered',
      OrderStatus.cancelled => 'cancelled',
      OrderStatus.convertedToBill => 'converted_to_bill',
    };
    await _putWithRetry(url, {'status': statusName});
  }

  /// Marks an order converted to a bill to prevent duplicate billing
  Future<void> markOrderConverted(int orderId, int saleId) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/orders/$orderId/convert');
    await http.post(url, headers: _headers, body: jsonEncode({'saleId': saleId}));
  }

  // =========================================================================
  // SETTINGS (Replaces SettingsSheetService & SettingsStoreService)
  // =========================================================================

  /// Loads business profile & settings from Supabase PostgreSQL
  Future<AppSettings> fetchSettings() async {
    await ensureAuth();
    try {
      final url = Uri.parse('${SupabaseConfig.apiUrl}/shops/${SupabaseConfig.shopId}');
      final res = await http.get(url, headers: _headers);

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body)['data'] ?? {};
        return AppSettings(
          company: data['name']?.toString() ?? 'NSYU Mobile Accessories',
          phone: data['phone']?.toString() ?? '',
          email: data['email']?.toString() ?? '',
          logo: data['logo']?.toString() ?? '',
          terms: 'Thank you for your business! Goods once sold cannot be returned.',
        );
      }
    } catch (_) {}
    return AppSettings();
  }

  /// Loads visibility & display preferences from Supabase PostgreSQL
  Future<VisibilitySettings> fetchVisibilitySettings() async {
    await ensureAuth();
    try {
      final url = Uri.parse('${SupabaseConfig.apiUrl}/settings/visibility');
      final res = await _getWithRetry(url);

      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        final settingsMap = body['data']?['settings'] as Map<String, dynamic>?;
        if (settingsMap != null) {
          return VisibilitySettings.fromJson(settingsMap);
        }
      }
    } catch (_) {}
    return VisibilitySettings.defaults();
  }

  /// Updates visibility & display preferences in Supabase PostgreSQL
  Future<bool> updateVisibilitySettings(VisibilitySettings settings) async {
    await ensureAuth();
    try {
      final url = Uri.parse('${SupabaseConfig.apiUrl}/settings/visibility');
      final res = await http.put(
        url,
        headers: _headers,
        body: jsonEncode({'settings': settings.toJson()}),
      );
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Resets visibility & display preferences to default values
  Future<VisibilitySettings> resetVisibilitySettings() async {
    await ensureAuth();
    try {
      final url = Uri.parse('${SupabaseConfig.apiUrl}/settings/visibility/reset');
      final res = await http.post(url, headers: _headers);
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        final settingsMap = body['data']?['settings'] as Map<String, dynamic>?;
        if (settingsMap != null) {
          return VisibilitySettings.fromJson(settingsMap);
        }
      }
    } catch (_) {}
    return VisibilitySettings.defaults();
  }

  /// Retrieves the authenticated user profile and permissions
  Future<Map<String, dynamic>?> fetchCurrentUserProfile() async {
    await ensureAuth();
    try {
      final url = Uri.parse('${SupabaseConfig.apiUrl}/auth/me');
      final res = await _getWithRetry(url);
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        return body['data'] as Map<String, dynamic>?;
      }
    } catch (_) {}
    return null;
  }

  /// Retrieves shop details by ID
  Future<Map<String, dynamic>?> fetchShopDetails(int shopId) async {
    await ensureAuth();
    try {
      final url = Uri.parse('${SupabaseConfig.apiUrl}/shops/$shopId');
      final res = await _getWithRetry(url);
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        return body['data'] as Map<String, dynamic>?;
      }
    } catch (_) {}
    return null;
  }

  /// Updates shop business details (Owner-only)
  Future<Map<String, dynamic>> updateShopDetails(int shopId, Map<String, dynamic> details) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/shops/$shopId');
    final res = await _putWithRetry(url, details);
    if (res.statusCode >= 300) {
      final err = jsonDecode(res.body);
      throw Exception(err['message'] ?? 'Failed to update shop (HTTP ${res.statusCode})');
    }
    final body = jsonDecode(res.body);
    return body['data'] as Map<String, dynamic>;
  }

  /// Retrieves real persisted audit/activity logs
  Future<List<Map<String, dynamic>>> fetchActivityLogs({int? shopId, String? module, int limit = 50}) async {
    await ensureAuth();
    try {
      final queryParams = <String, String>{'limit': '$limit'};
      if (shopId != null) queryParams['shopId'] = '$shopId';
      if (module != null && module.isNotEmpty && module != 'All') queryParams['module'] = module.toLowerCase();

      final uri = Uri.parse('${SupabaseConfig.apiUrl}/activity').replace(queryParameters: queryParams);
      final res = await _getWithRetry(uri);
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        final List list = body['data'] ?? [];
        return list.whereType<Map<String, dynamic>>().toList();
      }
    } catch (_) {}
    return [];
  }

  /// Exports full database backup payload
  Future<Map<String, dynamic>> exportBackupData() async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/backup');
    final res = await _getWithRetry(url);
    if (res.statusCode != 200) {
      throw Exception('Backup export failed (HTTP ${res.statusCode}): ${res.body}');
    }
    final body = jsonDecode(res.body);
    return body['data'] as Map<String, dynamic>;
  }

  /// Validates a backup payload before restoration
  Future<Map<String, dynamic>> validateBackupData(Map<String, dynamic> payload) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/backup/validate');
    final res = await _postWithRetry(url, payload);
    if (res.statusCode >= 300) {
      final err = jsonDecode(res.body);
      throw Exception(err['message'] ?? 'Backup validation failed');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// Restores verified backup into database
  Future<Map<String, dynamic>> restoreBackupData(Map<String, dynamic> payload) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/backup/restore');
    final res = await _postWithRetry(url, payload);
    if (res.statusCode >= 300) {
      final err = jsonDecode(res.body);
      throw Exception(err['message'] ?? 'Backup restore failed');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// Updates a product's full attributes (code, desc, category, prices, stock, status)
  Future<void> updateProductDetails({
    required String productCode,
    String? newCode,
    String? name,
    String? category,
    double? purchasePrice,
    double? sellingPrice,
    int? stock,
    String? status,
  }) async {
    await ensureAuth();
    final lookupUrl = Uri.parse('${SupabaseConfig.apiUrl}/products/${Uri.encodeComponent(productCode)}');
    final lookupRes = await _getWithRetry(lookupUrl);

    int? productId;
    if (lookupRes.statusCode == 200) {
      final decoded = jsonDecode(lookupRes.body);
      productId = decoded['data']?['id'];
    }

    if (productId != null) {
      final body = <String, dynamic>{};
      if (newCode != null && newCode.isNotEmpty) body['sku'] = newCode;
      if (name != null && name.isNotEmpty) body['name'] = name;
      if (category != null && category.isNotEmpty) body['brand'] = category;
      if (purchasePrice != null) body['purchase_price'] = purchasePrice;
      if (sellingPrice != null) {
        body['selling_price'] = sellingPrice;
        body['mrp'] = sellingPrice;
      }
      if (status != null) body['status'] = status.toLowerCase();

      final updateUrl = Uri.parse('${SupabaseConfig.apiUrl}/products/$productId');
      final updateRes = await _putWithRetry(updateUrl, body);
      if (updateRes.statusCode >= 300) {
        throw Exception('Failed to update product: ${updateRes.body}');
      }
    } else {
      throw Exception('Product with code "$productCode" not found.');
    }
  }

  // =========================================================================
  // EMPLOYEES & REPORTS (Direct Supabase API integration)
  // =========================================================================

  /// Fetches employees from Supabase backend
  Future<List<Map<String, dynamic>>> fetchEmployees() async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/employees');
    final res = await _getWithRetry(url);
    if (res.statusCode != 200) {
      throw Exception('Failed to load employees (HTTP ${res.statusCode}): ${res.body}');
    }
    final decoded = jsonDecode(res.body);
    final List list = decoded['data'] ?? [];
    return list.cast<Map<String, dynamic>>();
  }

  /// Adds a new employee in Supabase backend
  Future<Map<String, dynamic>> addEmployee({
    required String name,
    required String email,
    required String password,
    String? phone,
    String? role,
  }) async {
    await ensureAuth();
    final url = Uri.parse('${SupabaseConfig.apiUrl}/employees');
    final body = {
      'name': name,
      'email': email,
      'password': password,
      if (phone != null) 'phone': phone,
      if (role != null) 'role': role,
    };
    final res = await _postWithRetry(url, body);
    if (res.statusCode >= 300) {
      throw Exception('Failed to create employee (HTTP ${res.statusCode}): ${res.body}');
    }
    final decoded = jsonDecode(res.body);
    return decoded['data'] ?? {};
  }

  /// Fetches generic report data from Supabase backend
  Future<Map<String, dynamic>> fetchReport(String endpoint, {Map<String, String>? params}) async {
    await ensureAuth();
    final uri = Uri.parse('${SupabaseConfig.apiUrl}/reports/$endpoint').replace(queryParameters: params);
    final res = await _getWithRetry(uri);
    if (res.statusCode != 200) {
      throw Exception('Failed to load report (HTTP ${res.statusCode}): ${res.body}');
    }
    return jsonDecode(res.body);
  }
}
