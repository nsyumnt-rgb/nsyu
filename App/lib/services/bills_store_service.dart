import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/saved_bill.dart';

/// Saves/loads the bill history locally on the device (SharedPreferences,
/// as a JSON blob). This is what powers Home dashboard stats, the Bills
/// list, and the Ledger — all derived from this one list.
class BillsStoreService {
  static const _key = 'nsyu_saved_bills_v1';

  Future<List<SavedBill>> loadBills() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .map((e) => SavedBill.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveBills(List<SavedBill> bills) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = jsonEncode(bills.map((b) => b.toJson()).toList());
    await prefs.setString(_key, raw);
  }
}
