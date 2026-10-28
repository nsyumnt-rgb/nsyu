import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/saved_payment.dart';

/// Saves/loads payment collect receipts locally (SharedPreferences JSON
/// blob), same pattern as [BillsStoreService] — plus a persisted counter so
/// receipt numbers (NSYU/PC/YYYY/000123) keep incrementing across app
/// restarts.
class PaymentsStoreService {
  static const _key = 'nsyu_saved_payments_v1';
  static const _counterKey = 'nsyu_payment_receipt_counter_v1';

  Future<List<SavedPayment>> loadPayments() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .map((e) => SavedPayment.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> savePayments(List<SavedPayment> payments) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = jsonEncode(payments.map((p) => p.toJson()).toList());
    await prefs.setString(_key, raw);
  }

  /// Returns the next receipt number, e.g. `NSYU/PC/2025/000123`, and
  /// persists the incremented counter.
  Future<String> nextReceiptNumber() async {
    final prefs = await SharedPreferences.getInstance();
    final next = (prefs.getInt(_counterKey) ?? 0) + 1;
    await prefs.setInt(_counterKey, next);
    final year = DateTime.now().year;
    final padded = next.toString().padLeft(6, '0');
    return 'NSYU/PC/$year/$padded';
  }
}
