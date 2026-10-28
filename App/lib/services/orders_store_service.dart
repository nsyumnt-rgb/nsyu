import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/saved_order.dart';

/// Saves/loads the order history locally on the device (SharedPreferences,
/// as a JSON blob) — same pattern as [BillsStoreService].
class OrdersStoreService {
  static const _key = 'nsyu_saved_orders_v1';

  Future<List<SavedOrder>> loadOrders() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .map((e) => SavedOrder.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveOrders(List<SavedOrder> orders) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = jsonEncode(orders.map((o) => o.toJson()).toList());
    await prefs.setString(_key, raw);
  }
}
