import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/visibility_settings.dart';
import '../services/supabase_service.dart';
import 'auth_provider.dart';

class VisibilityProvider extends ChangeNotifier {
  final SupabaseService _supabase = SupabaseService();

  VisibilitySettings _settings = VisibilitySettings.defaults();
  bool _loaded = false;
  bool _saving = false;
  String? _error;
  int _currentShopId = 1;

  VisibilitySettings get settings => _settings;
  bool get loaded => _loaded;
  bool get saving => _saving;
  String? get error => _error;
  int get currentShopId => _currentShopId;

  String _cacheKey(int shopId) => 'nsyu_visibility_settings_shop_$shopId';

  Future<void> load({int? shopId}) async {
    if (shopId != null) _currentShopId = shopId;

    // 1. Fast offline load from SharedPreferences
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString(_cacheKey(_currentShopId));
    if (cached != null && cached.isNotEmpty) {
      try {
        final map = jsonDecode(cached) as Map<String, dynamic>;
        _settings = VisibilitySettings.fromJson(map);
      } catch (_) {}
    }

    _loaded = true;
    notifyListeners();

    // 2. Sync from backend PostgreSQL
    await syncFromBackend();
  }

  Future<void> syncFromBackend() async {
    try {
      final remote = await _supabase.fetchVisibilitySettings();
      _settings = remote;
      _error = null;

      // Cache locally
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey(_currentShopId), jsonEncode(_settings.toJson()));
    } catch (e) {
      _error = e.toString();
    }
    notifyListeners();
  }

  Future<bool> save(VisibilitySettings newSettings) async {
    _saving = true;
    _error = null;
    notifyListeners();

    try {
      // Validate: Ensure at least one bottom nav item remains visible
      final hasNav = newSettings.navHome ||
          newSettings.navBills ||
          newSettings.navLedger ||
          newSettings.navCatalog ||
          newSettings.navOrders;

      final validatedSettings = hasNav ? newSettings : newSettings.copyWith(navHome: true);

      final success = await _supabase.updateVisibilitySettings(validatedSettings);
      if (success) {
        _settings = validatedSettings;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_cacheKey(_currentShopId), jsonEncode(_settings.toJson()));
        _saving = false;
        notifyListeners();
        return true;
      } else {
        _error = 'Failed to save settings to server.';
      }
    } catch (e) {
      _error = e.toString();
    }

    _saving = false;
    notifyListeners();
    return false;
  }

  Future<bool> resetToDefaults() async {
    _saving = true;
    _error = null;
    notifyListeners();

    try {
      final defaults = await _supabase.resetVisibilitySettings();
      _settings = defaults;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey(_currentShopId), jsonEncode(_settings.toJson()));
      _saving = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString();
    }

    _saving = false;
    notifyListeners();
    return false;
  }

  // =========================================================================
  // EFFECTIVE VISIBILITY RULES:
  // Effective Visibility = Owner/Shop Visibility Setting AND User Permission
  // =========================================================================

  /// Business information effective visibility
  bool isBusinessInfoVisible(String key, AuthProvider auth) {
    switch (key) {
      case 'purchase_price':
        return _settings.showPurchasePrice && auth.canViewPurchasePrice;
      case 'margin':
        return _settings.showMargin && auth.canViewPurchasePrice;
      case 'cost_price':
        return _settings.showCostPrice && auth.canViewPurchasePrice;
      case 'stock_quantity':
        return _settings.showStockQuantity;
      case 'customer_outstanding':
        return _settings.showCustomerOutstanding;
      case 'profit':
        // Profit is strictly owner-level AND must have visibility toggle enabled
        return _settings.showProfit && auth.isOwner;
      default:
        return true;
    }
  }

  /// App modules effective visibility
  bool isModuleVisible(String module, AuthProvider auth) {
    switch (module) {
      case 'inventory':
        return _settings.moduleInventory;
      case 'purchase':
        return _settings.modulePurchase && auth.isOwner;
      case 'sales':
        return _settings.moduleSales;
      case 'billing':
        return _settings.moduleBilling;
      case 'customers':
        return _settings.moduleCustomers;
      case 'suppliers':
        return _settings.moduleSuppliers;
      case 'payments':
        return _settings.modulePayments;
      case 'customer_ledger':
        return _settings.moduleCustomerLedger;
      case 'emi':
        return _settings.moduleEmi;
      case 'employees':
        return _settings.moduleEmployees && auth.isOwner;
      case 'attendance':
        return _settings.moduleAttendance;
      case 'payroll':
        return _settings.modulePayroll && auth.isOwner;
      case 'reports':
        return _settings.moduleReports;
      case 'shops':
        return _settings.moduleShops && auth.isOwner;
      case 'roles':
        return _settings.moduleRoles && auth.isOwner;
      default:
        return true;
    }
  }

  /// Product field display visibility
  bool isProductFieldVisible(String field) {
    switch (field) {
      case 'sku':
        return _settings.productSku;
      case 'barcode':
        return _settings.productBarcode;
      case 'category_icon':
        return _settings.productCategoryIcon;
      case 'brand':
        return _settings.productBrand;
      case 'description':
        return _settings.productDescription;
      default:
        return true;
    }
  }

  /// Bottom navigation destination visibility
  bool isNavDestinationVisible(int tabIndex) {
    switch (tabIndex) {
      case 0:
        return _settings.navHome;
      case 1:
        return _settings.navCatalog;
      case 2:
        return _settings.navBills;
      case 3:
        return _settings.navOrders;
      case 4:
        return true;
      default:
        return true;
    }
  }

  /// Returns list of visible tab indices among [0, 1, 2, 3, 4]
  List<int> get visibleNavDestinations {
    final list = <int>[];
    if (_settings.navHome) list.add(0);
    if (_settings.navCatalog) list.add(1);
    if (_settings.navBills) list.add(2);
    if (_settings.navOrders) list.add(3);
    list.add(4); // More is always available

    // Guaranteed fallback: at least Home is available if all disabled
    if (list.isEmpty) list.add(0);
    return list;
  }
}
