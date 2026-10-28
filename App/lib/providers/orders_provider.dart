import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

import '../models/saved_order.dart';
import '../services/orders_store_service.dart';
import '../services/supabase_service.dart';

class OrdersProvider extends ChangeNotifier {
  final OrdersStoreService _store = OrdersStoreService();
  final SupabaseService _supabaseService = SupabaseService();
  static final _dateFmt = DateFormat('yyyy-MM-dd');

  String? lastDriveSyncError;
  bool syncing = false;
  String? syncError;

  List<SavedOrder> orders = [];
  bool loaded = false;

  Future<void> load() async {
    orders = await _store.loadOrders();
    orders.sort((a, b) => b.date.compareTo(a.date));
    loaded = true;
    notifyListeners();
    syncFromSupabase();
  }

  /// Pulls orders from Supabase PostgreSQL
  Future<void> syncFromSupabase() async {
    syncing = true;
    syncError = null;
    notifyListeners();
    try {
      final supabaseOrders = await _supabaseService.fetchOrders();
      if (supabaseOrders.isNotEmpty) {
        final localByNumber = {for (final o in orders) o.orderNumber: o};
        final merged = <SavedOrder>[];
        for (final so in supabaseOrders) {
          localByNumber.remove(so.orderNumber);
          merged.add(so);
        }
        merged.addAll(localByNumber.values);
        orders = merged;
        orders.sort((a, b) => b.date.compareTo(a.date));
        await _store.saveOrders(orders);
      }
      syncError = null;
    } catch (e) {
      syncError = e.toString();
    }
    syncing = false;
    loaded = true;
    notifyListeners();
  }

  /// Backward-compatible alias for syncFromDrive()
  Future<void> syncFromDrive() => syncFromSupabase();

  Future<void> addOrder(SavedOrder order) async {
    orders.insert(0, order);
    await _store.saveOrders(orders);
    print('✅ Order Created: ${order.orderNumber}');
    notifyListeners();
    try {
      await _supabaseService.createOrder(order);
    } catch (e) {
      lastDriveSyncError = e.toString();
    }
  }

  Future<void> setStatus(String orderNumber, OrderStatus status) async {
    SavedOrder? target;
    for (final o in orders) {
      if (o.orderNumber == orderNumber) {
        target = o;
        break;
      }
    }
    if (target == null) return;
    target.status = status;
    print('🔄 Order Status Updated: ${target.orderNumber} -> ${status.label}');
    await _store.saveOrders(orders);
    notifyListeners();
    try {
      await _supabaseService.updateOrderStatus(orderNumber, status);
    } catch (e) {
      lastDriveSyncError = e.toString();
    }
  }

  Future<void> deleteOrder(String orderNumber) async {
    orders.removeWhere((o) => o.orderNumber == orderNumber);
    await _store.saveOrders(orders);
    notifyListeners();
  }

  // ---- Orders list (All / Ordered / Delivered / Cancelled) ----

  List<SavedOrder> ordersByStatus(OrderStatus? status) {
    if (status == null) return orders;
    return orders.where((o) => o.status == status).toList();
  }

  List<SavedOrder> search(List<SavedOrder> source, String query) {
    if (query.trim().isEmpty) return source;
    final q = query.toLowerCase();
    return source
        .where((o) =>
            o.orderNumber.toLowerCase().contains(q) ||
            o.customerName.toLowerCase().contains(q))
        .toList();
  }

  int get pendingCount =>
      orders.where((o) => o.status == OrderStatus.pending).length;

  int get deliveredCount =>
      orders.where((o) => o.status == OrderStatus.delivered).length;
}
