import 'package:flutter/foundation.dart';
import '../services/customer_portal_service.dart';

class CustomerPortalProvider extends ChangeNotifier {
  final CustomerPortalService _service = CustomerPortalService();

  Map<String, dynamic>? _customer;
  Map<String, dynamic>? _cart;
  int _unreadNotifications = 0;
  bool _loading = false;
  String? _error;

  Map<String, dynamic>? get customer => _customer;
  Map<String, dynamic>? get cart => _cart;
  int get unreadNotifications => _unreadNotifications;
  bool get loading => _loading;
  String? get error => _error;

  int get cartItemCount {
    if (_cart == null) return 0;
    final items = _cart!['items'] as List<dynamic>?;
    if (items == null) return 0;
    return items.fold<int>(0, (sum, it) => sum + ((it['quantity'] as num?)?.toInt() ?? 0));
  }

  double get cartEstimatedTotal {
    if (_cart == null) return 0.0;
    return ((_cart!['estimatedTotal'] ?? _cart!['total']) as num?)?.toDouble() ?? 0.0;
  }

  double get currentBalance {
    if (_customer == null) return 0.0;
    return ((_customer!['currentBalance'] ?? _customer!['balance']) as num?)?.toDouble() ?? 0.0;
  }

  Future<void> init() async {
    await _service.init();
    _customer = _service.customerData;
    notifyListeners();
    if (_service.accessToken != null) {
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
      ]);
      _customer = results[0] as Map<String, dynamic>;
      _cart = results[1] as Map<String, dynamic>;
      _unreadNotifications = results[2] as int;
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
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
      if (it['productId'] == productId || it['product_id'] == productId) {
        return (it['quantity'] as num?)?.toInt() ?? 0;
      }
    }
    return 0;
  }
}

