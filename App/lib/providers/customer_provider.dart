import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/customer.dart';
import '../services/contact_import_service.dart';
import '../services/customer_store_service.dart';
import '../services/supabase_service.dart';

class CustomerProvider extends ChangeNotifier {
  final CustomerStoreService _store = CustomerStoreService();
  final SupabaseService _supabaseService = SupabaseService();

  bool loaded = false;
  bool syncing = false;
  String? syncError;
  List<Customer> _customers = [];

  List<Customer> get customers => List.unmodifiable(_customers);

  Future<void> load() async {
    _customers = await _store.loadCustomers();
    loaded = true;
    notifyListeners();
    // Asynchronously refresh from Supabase
    syncFromSupabase();
  }

  List<Customer> search(String query) {
    if (query.trim().isEmpty) return customers;
    final q = query.toLowerCase();
    return _customers
        .where((c) =>
            c.name.toLowerCase().contains(q) || c.mobile.contains(q))
        .toList();
  }

  /// Finds an existing customer whose mobile number matches [mobile] once
  /// both sides are normalized the same way (spaces/dashes/+91 prefix
  /// stripped) — used by the "Import from Contacts" flow so it never
  /// creates a duplicate customer.
  Customer? findByMobile(String mobile) {
    final target = ContactImportService.normalizePhone(mobile);
    if (target.isEmpty) return null;
    for (final c in _customers) {
      if (ContactImportService.normalizePhone(c.mobile) == target) return c;
    }
    return null;
  }

  /// Adds a new customer/supplier in Supabase PostgreSQL and persists it locally.
  Future<Customer> addCustomer(
    String name,
    String mobile, {
    String address = '',
    double openingBalance = 0.0,
    bool isSupplier = false,
  }) async {
    Customer created;
    try {
      created = await _supabaseService.addCustomer(
        name: name,
        mobile: mobile,
        address: address,
        openingBalance: openingBalance,
      ).timeout(const Duration(seconds: 2));
      created.isSupplier = isSupplier;
    } catch (_) {
      final nextNum = _customers.length + 1;
      final id = isSupplier ? 'S${nextNum.toString().padLeft(3, '0')}' : 'C${nextNum.toString().padLeft(3, '0')}';
      created = Customer(
        id: id,
        name: name.trim(),
        mobile: mobile.trim(),
        address: address.trim(),
        openingBalance: openingBalance,
        currentBalance: openingBalance,
        isSupplier: isSupplier,
      );
    }
    _customers.add(created);
    await _store.saveCustomers(_customers);
    notifyListeners();
    return created;
  }

  Future<void> updateCustomer(Customer customer) async {
    final idx = _customers.indexWhere((c) => c.id == customer.id);
    if (idx != -1) {
      _customers[idx] = customer;
      await _store.saveCustomers(_customers);
      notifyListeners();
      try {
        await _supabaseService.updateCustomer(customer);
      } catch (_) {}
    }
  }

  Future<void> deleteCustomer(String id) async {
    _customers.removeWhere((c) => c.id == id);
    await _store.saveCustomers(_customers);
    notifyListeners();
    try {
      await _supabaseService.deleteCustomer(id);
    } catch (_) {}
  }

  /// Pulls customers from Supabase PostgreSQL and merges into the local list.
  Future<void> syncFromSupabase() async {
    syncing = true;
    syncError = null;
    notifyListeners();
    try {
      final supabaseCustomers = await _supabaseService.fetchCustomers();
      if (supabaseCustomers.isNotEmpty) {
        final localById = {for (final c in _customers) c.id: c};
        final merged = <Customer>[];
        for (final sc in supabaseCustomers) {
          localById.remove(sc.id);
          merged.add(sc);
        }
        merged.addAll(localById.values);
        _customers = merged;
        await _store.saveCustomers(_customers);
      }
      syncError = null;
    } catch (e) {
      syncError = e.toString();
    }
    syncing = false;
    loaded = true;
    notifyListeners();
  }

  /// Backward-compatible alias for UI components calling syncFromDrive()
  Future<void> syncFromDrive() => syncFromSupabase();
}
