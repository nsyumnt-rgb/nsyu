import 'package:flutter/foundation.dart';

import '../models/saved_bill.dart';
import '../models/saved_order.dart';
import '../services/orders_store_service.dart';
import '../services/supabase_service.dart';

class OrdersProvider extends ChangeNotifier {
  final OrdersStoreService _store = OrdersStoreService();
  final SupabaseService _supabaseService = SupabaseService();

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
    debugPrint('✅ Order Created: ${order.orderNumber}');
    notifyListeners();
    try {
      final created = await _supabaseService.createOrder(order);
      if (created.id != null) {
        final idx = orders.indexWhere((o) => o.orderNumber == order.orderNumber);
        if (idx != -1) {
          orders[idx] = created;
          await _store.saveOrders(orders);
          notifyListeners();
        }
      }
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
    if (target.isBilled) {
      throw Exception('Order #${target.orderNumber} is already billed and cannot be modified.');
    }
    final prevStatus = target.status;
    target.status = status;
    debugPrint('🔄 Order Status Updated: ${target.orderNumber} -> ${status.label}');
    await _store.saveOrders(orders);
    notifyListeners();
    try {
      await _supabaseService.updateOrderStatus(target.id ?? orderNumber, status);
    } catch (e) {
      target.status = prevStatus;
      await _store.saveOrders(orders);
      notifyListeners();
      lastDriveSyncError = e.toString();
      rethrow;
    }
  }

  /// Atomically converts [order] into a bill on the backend (strictly one-time).
  Future<SavedBill?> convertOrderToBill(
    SavedOrder order, {
    double? paidAmount,
    String paymentMethod = 'cash',
    String? notes,
  }) async {
    if (order.isBilled) {
      throw Exception('Order #${order.orderNumber} has already been converted to a bill.');
    }
    int? orderId = order.id;
    if (orderId == null) {
      await syncFromSupabase();
      final refreshed = orders.cast<SavedOrder?>().firstWhere(
            (o) => o != null && o.orderNumber == order.orderNumber,
            orElse: () => null,
          );
      if (refreshed != null) {
        if (refreshed.isBilled) {
          throw Exception('Order #${order.orderNumber} has already been converted to a bill.');
        }
        orderId = refreshed.id;
      }
    }
    if (orderId == null) {
      throw Exception('Order #${order.orderNumber} is not yet synced with the server.');
    }

    final result = await _supabaseService.convertOrderToBill(
      orderId,
      paidAmount: paidAmount,
      paymentMethod: paymentMethod,
      notes: notes,
    );

    final updatedOrder = result['order'] as SavedOrder?;
    final createdBill = result['bill'] as SavedBill?;

    final idx = orders.indexWhere(
      (o) => o.id == orderId || o.orderNumber == order.orderNumber,
    );
    if (idx != -1) {
      orders[idx] = updatedOrder ??
          SavedOrder(
            id: order.id,
            orderNumber: order.orderNumber,
            date: order.date,
            expectedDeliveryDate: order.expectedDeliveryDate,
            customerId: order.customerId,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerAddress: order.customerAddress,
            items: order.items,
            subtotal: order.subtotal,
            discountAmount: order.discountAmount,
            taxAmount: order.taxAmount,
            totalAmount: order.totalAmount,
            remarks: order.remarks,
            convertedSaleId: createdBill?.id,
            billedBillId: createdBill?.id,
            billedAt: DateTime.now(),
            status: OrderStatus.convertedToBill,
          );
      await _store.saveOrders(orders);
      notifyListeners();
    }

    return createdBill;
  }

  Future<void> updateOrderStatus(String orderNumber, OrderStatus status) => setStatus(orderNumber, status);

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
