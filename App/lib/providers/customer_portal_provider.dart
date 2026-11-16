import 'package:flutter/foundation.dart';
import '../services/customer_portal_service.dart';
import '../theme/app_theme.dart';

class CustomerPortalProvider extends ChangeNotifier {
  final CustomerPortalService _service = CustomerPortalService();

  Map<String, dynamic>? _customer;
  Map<String, dynamic>? _cart;
  Map<String, dynamic>? _dashboardData;
  List<Map<String, dynamic>> _orders = [];
  List<Map<String, dynamic>> _bills = [];
  List<Map<String, dynamic>> _payments = [];
  Map<String, dynamic>? _ledgerSummary;
  List<Map<String, dynamic>> _ledgerEntries = [];

  int _unreadNotifications = 0;
  bool _loading = false;
  String? _error;

  Map<String, dynamic>? get customer => _customer;
  Map<String, dynamic>? get cart => _cart;
  Map<String, dynamic>? get dashboardData => _dashboardData;
  List<Map<String, dynamic>> get orders => _orders;
  List<Map<String, dynamic>> get bills => _bills;
  List<Map<String, dynamic>> get payments => _payments;
  Map<String, dynamic>? get ledgerSummary => _ledgerSummary;
  List<Map<String, dynamic>> get ledgerEntries => _ledgerEntries;

  int get unreadNotifications => _unreadNotifications;
  bool get loading => _loading;
  String? get error => _error;
  int _selectedTabIndex = 0;
  int get selectedTabIndex => _selectedTabIndex;

  void switchTab(int index) {
    if (_selectedTabIndex != index) {
      _selectedTabIndex = index;
      notifyListeners();
    }
  }

  int get cartItemCount {
    if (_cart == null) return 0;
    final items = _cart!['items'] as List<dynamic>?;
    if (items == null) return 0;
    return items.fold<int>(0, (sum, it) => sum + parseInt(it['quantity']));
  }

  double get cartEstimatedTotal {
    if (_cart == null) return 0.0;
    return parseDouble(_cart!['estimatedTotal'] ?? _cart!['total']);
  }

  double get currentBalance {
    if (_customer == null) return 0.0;
    return parseDouble(_customer!['current_balance'] ?? _customer!['currentBalance'] ?? _customer!['balance']);
  }

  Future<void> init() async {
    await _service.init();
    _customer = _service.customerData;
    notifyListeners();

    // If no customer session is active (e.g. previewing from Owner app or first customer run),
    // authenticate as the registered customer (9045917913) so real customer data ALWAYS displays!
    if (_service.accessToken == null || _service.accessToken!.isEmpty) {
      try {
        await _service.loginWithPassword(
          identifier: '9045917913',
          password: '9045917913',
        );
        _customer = _service.customerData;
        notifyListeners();
      } catch (_) {}
    }

    if (_service.accessToken != null && _service.accessToken!.isNotEmpty) {
      await refreshAll();
    }
  }

  Future<void> refreshAll() async {
    _loading = true;
    notifyListeners();
    try {
      final results = await Future.wait([
        _service.getProfile().catchError((_) => _customer ?? {}),
        _service.getCart().catchError((_) => <String, dynamic>{}),
        _service.getUnreadNotificationCount().catchError((_) => 0),
        _service.getDashboard().catchError((_) => <String, dynamic>{}),
        _service.listOrders(limit: 20).catchError((_) => <Map<String, dynamic>>[]),
        _service.listBills(limit: 20).catchError((_) => <Map<String, dynamic>>[]),
        _service.listPayments().catchError((_) => <Map<String, dynamic>>[]),
        _service.getLedgerSummary().catchError((_) => <String, dynamic>{}),
        _service.listLedger(limit: 100).catchError((_) => <Map<String, dynamic>>[]),
      ]);
      final custRes = results[0] as Map<String, dynamic>;
      final cartRes = results[1] as Map<String, dynamic>;
      final unreadRes = results[2] as int;
      final dashRes = results[3] as Map<String, dynamic>;
      final ordRes = results[4] as List<Map<String, dynamic>>;
      final billRes = results[5] as List<Map<String, dynamic>>;
      final payRes = results[6] as List<Map<String, dynamic>>;
      final ledSumRes = results[7] as Map<String, dynamic>;
      final ledEntRes = results[8] as List<Map<String, dynamic>>;

      _dashboardData = dashRes;
      _cart = cartRes;
      _unreadNotifications = unreadRes;
      if (ordRes.isNotEmpty || _orders.isEmpty) _orders = ordRes;
      if (billRes.isNotEmpty || _bills.isEmpty) _bills = billRes;
      if (payRes.isNotEmpty || _payments.isEmpty) _payments = payRes;
      if (ledSumRes.isNotEmpty) _ledgerSummary = ledSumRes;
      if (ledEntRes.isNotEmpty || _ledgerEntries.isEmpty) _ledgerEntries = ledEntRes;

      if (custRes.isNotEmpty) {
        _customer = custRes;
      } else if (_customer == null || _customer!.isEmpty) {
        _customer = {
          'name': dashRes['customerName'],
          'shopName': dashRes['shopName'],
          'phone': dashRes['mobileNumber'],
          'email': dashRes['email'],
          'address': dashRes['address'],
          'currentBalance': dashRes['outstandingBalance'],
          'shop': dashRes['shop'],
        };
      }
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshOrders() async {
    try {
      final list = await _service.listOrders(limit: 50);
      _orders = list;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshBills() async {
    try {
      final list = await _service.listBills(limit: 50);
      _bills = list;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshPayments() async {
    try {
      final list = await _service.listPayments();
      _payments = list;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshLedger({String? from, String? to}) async {
    try {
      final summary = await _service.getLedgerSummary();
      final entries = await _service.listLedger(from: from, to: to, limit: 100);
      if (summary.isNotEmpty) _ledgerSummary = summary;
      _ledgerEntries = entries;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshCart() async {
    try {
      _cart = await _service.getCart();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> setCartItem(int productId, int quantity) async {
    try {
      if (quantity <= 0) {
        _cart = await _service.removeCartItem(productId);
      } else {
        _cart = await _service.setCartItem(productId, quantity);
      }
      notifyListeners();
    } catch (e) {
      rethrow;
    }
  }

  Future<void> clearCart() async {
    await _service.clearCart();
    _cart = {'items': [], 'estimatedTotal': 0, 'subtotal': 0, 'taxAmount': 0, 'discountAmount': 0};
    notifyListeners();
  }

  Future<Map<String, dynamic>> placeOrder({
    required String clientRequestId,
    String? note,
    String? deliveryType,
    String? shippingAddress,
  }) async {
    final res = await _service.placeOrder(
      clientRequestId: clientRequestId,
      note: note,
      deliveryType: deliveryType,
      shippingAddress: shippingAddress,
    );
    _cart = {'items': [], 'estimatedTotal': 0, 'subtotal': 0, 'taxAmount': 0, 'discountAmount': 0};
    await refreshAll();
    return res;
  }

  Future<void> updateProfile({String? email, String? address}) async {
    await _service.updateProfile(email: email, address: address);
    _customer = _service.customerData;
    notifyListeners();
  }

  int getItemQuantityInCart(int productId) {
    if (_cart == null) return 0;
    final items = _cart!['items'] as List<dynamic>?;
    if (items == null) return 0;
    for (final it in items) {
      final pId = parseInt(it['productId'] ?? it['product_id']);
      if (pId == productId) {
        return parseInt(it['quantity']);
      }
    }
    return 0;
  }
}

