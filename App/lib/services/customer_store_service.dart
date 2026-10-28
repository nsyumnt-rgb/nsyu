import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/customer.dart';

/// Local (device) persistence for customers — same "Customer.xlsx" shape
/// (ID | Customer | Mobile) that will later sync to Google Drive.
class CustomerStoreService {
  static const _key = 'nsyu_customers_v1';

  Future<List<Customer>> loadCustomers() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list
          .map((e) => Customer.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveCustomers(List<Customer> customers) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = jsonEncode(customers.map((c) => c.toJson()).toList());
    await prefs.setString(_key, raw);
  }
}
