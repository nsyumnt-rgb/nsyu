import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/supabase_config.dart';
import '../models/business_profile.dart';
import '../services/supabase_service.dart';

class AuthProvider extends ChangeNotifier {
  static const _mobileKey = 'nsyu_owner_mobile';
  static const _loggedInKey = 'nsyu_logged_in';
  static const _userNameKey = 'nsyu_user_name';
  static const _userEmailKey = 'nsyu_user_email';
  static const _roleNameKey = 'nsyu_role_name';
  static const _accountTypeKey = 'nsyu_account_type';
  static const _shopNameKey = 'nsyu_shop_name';
  static const _shopCodeKey = 'nsyu_shop_code';
  static const _shopAddressKey = 'nsyu_shop_address';
  static const _shopPhoneKey = 'nsyu_shop_phone';
  static const _shopEmailKey = 'nsyu_shop_email';
  static const _shopLogoKey = 'nsyu_shop_logo';

  String? _registeredMobile;
  bool _isLoggedIn = false;
  bool loaded = false;

  String _userName = 'NSYU';
  String _userEmail = 'nsyu.mnt@gmail.com';
  final String _password = 'Nsyu@12345';
  String _roleName = 'Owner';
  String _accountType = 'owner';
  int _shopId = 1;
  String _shopName = 'NSYU';
  String _shopCode = 'NSYU';
  String _shopAddress = 'Jasola Vihar, New Delhi, India - 110025';
  String _shopPhone = '+918800503662';
  String _shopEmail = 'nsyu.mnt@gmail.com';
  String _shopLogo = '';
  Map<String, bool> _fieldPermissions = {};
  bool _loadingProfile = false;

  String? get registeredMobile => _registeredMobile;
  bool get isLoggedIn => _isLoggedIn;
  bool get hasAccount => _registeredMobile != null && _registeredMobile!.isNotEmpty;
  String get userName => _userName;
  String get userEmail => _userEmail;
  String get password => _password;
  String get roleName => _roleName;
  String get accountType => _accountType;
  int get shopId => _shopId;
  String get shopName => _shopName;
  String get shopCode => _shopCode;
  String get shopAddress => _shopAddress;
  String get shopPhone => _shopPhone;
  String get shopEmail => _shopEmail;
  String get shopLogo => _shopLogo;
  bool get isOwner => _accountType == 'owner' || _roleName.toLowerCase() == 'owner';
  bool get canViewPurchasePrice => isOwner || (_fieldPermissions['purchase_price'] ?? false);
  bool get loadingProfile => _loadingProfile;

  BusinessProfile get currentProfile => BusinessProfile(
        businessName: _shopName.isNotEmpty ? _shopName : 'NSYU Traders',
        shopCode: _shopCode,
        ownerName: _userName.isNotEmpty ? _userName : 'Owner',
        role: _roleName.isNotEmpty ? _roleName : (isOwner ? 'Owner' : 'Staff'),
        phone: _registeredMobile ?? (_shopPhone.isNotEmpty ? _shopPhone : '8800503662'),
        email: _userEmail.isNotEmpty ? _userEmail : _shopEmail,
        address: _shopAddress,
        profileImage: _shopLogo,
        isOwner: isOwner,
      );

  /// The password is simply the last 5 digits of the registered mobile number.
  String get expectedPassword {
    final m = _registeredMobile ?? '';
    return m.length <= 5 ? m : m.substring(m.length - 5);
  }

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _registeredMobile = prefs.getString(_mobileKey);

    if (_registeredMobile == null || _registeredMobile!.isEmpty) {
      _registeredMobile = '8800503662';
      await prefs.setString(_mobileKey, _registeredMobile!);
    }

    _isLoggedIn = prefs.getBool(_loggedInKey) ?? false;
    _userName = prefs.getString(_userNameKey) ?? 'NSYU';
    _userEmail = prefs.getString(_userEmailKey) ?? 'nsyu.mnt@gmail.com';
    _roleName = prefs.getString(_roleNameKey) ?? 'Owner';
    _accountType = prefs.getString(_accountTypeKey) ?? 'owner';
    _shopName = prefs.getString(_shopNameKey) ?? 'NSYU';
    _shopCode = prefs.getString(_shopCodeKey) ?? 'NSYU';
    _shopAddress = prefs.getString(_shopAddressKey) ?? 'Ghaziabad, Uttar Pradesh';
    _shopPhone = prefs.getString(_shopPhoneKey) ?? '9810000001';
    _shopEmail = prefs.getString(_shopEmailKey) ?? 'nsyu.mnt@gmail.com';
    _shopLogo = prefs.getString(_shopLogoKey) ?? '';

    loaded = true;
    notifyListeners();

    if (_isLoggedIn) {
      refreshProfile();
    }
  }

  /// Pulls fresh authenticated user profile and shop details from Supabase PostgreSQL
  Future<void> refreshProfile() async {
    if (_loadingProfile) return;
    _loadingProfile = true;

    try {
      final me = await SupabaseService().fetchCurrentUserProfile();
      if (me != null) {
        _accountType = me['accountType']?.toString() ?? 'owner';
        _roleName = me['roleName']?.toString() ?? (isOwner ? 'Owner' : 'Staff');
        _shopId = me['shopId'] ?? SupabaseConfig.shopId;

        if (me['fieldPermissions'] is Map) {
          _fieldPermissions = (me['fieldPermissions'] as Map).map(
            (k, v) => MapEntry(k.toString(), v == true),
          );
        }

        final actor = me['owner'] ?? me['employee'];
        if (actor is Map) {
          if (actor['name'] != null) _userName = actor['name'].toString();
          if (actor['email'] != null) _userEmail = actor['email'].toString();
          if (actor['phone'] != null && actor['phone'].toString().isNotEmpty) {
            _registeredMobile = actor['phone'].toString();
          }
        }

        // Fetch current shop details
        final shop = await SupabaseService().fetchShopDetails(_shopId);
        if (shop != null) {
          _shopName = shop['name']?.toString() ?? _shopName;
          _shopCode = shop['code']?.toString() ?? _shopCode;
          _shopAddress = shop['address']?.toString() ?? _shopAddress;
          _shopPhone = shop['phone']?.toString() ?? _shopPhone;
          _shopEmail = shop['email']?.toString() ?? _shopEmail;
          _shopLogo = shop['logo']?.toString() ?? _shopLogo;
        }

        // Persist to SharedPreferences for fast subsequent offline startups
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_userNameKey, _userName);
        await prefs.setString(_userEmailKey, _userEmail);
        await prefs.setString(_roleNameKey, _roleName);
        await prefs.setString(_accountTypeKey, _accountType);
        await prefs.setString(_shopNameKey, _shopName);
        await prefs.setString(_shopCodeKey, _shopCode);
        await prefs.setString(_shopAddressKey, _shopAddress);
        await prefs.setString(_shopPhoneKey, _shopPhone);
        await prefs.setString(_shopEmailKey, _shopEmail);
        await prefs.setString(_shopLogoKey, _shopLogo);
        if (_registeredMobile != null) {
          await prefs.setString(_mobileKey, _registeredMobile!);
        }
      }
    } catch (_) {}

    _loadingProfile = false;
    notifyListeners();
  }

  /// Updates business / shop information in database and refreshes local state
  Future<String?> updateBusinessInfo({
    required String name,
    required String code,
    required String phone,
    String email = '',
    String address = '',
    String logo = '',
  }) async {
    if (!isOwner) {
      return 'Permission denied: Only business Owner can modify business information.';
    }

    try {
      final updated = await SupabaseService().updateShopDetails(_shopId, {
        'name': name.trim(),
        'code': code.trim().toUpperCase(),
        'phone': phone.trim(),
        'email': email.trim(),
        'address': address.trim(),
        'logo': logo.trim(),
      });

      _shopName = updated['name']?.toString() ?? name;
      _shopCode = updated['code']?.toString() ?? code;
      _shopPhone = updated['phone']?.toString() ?? phone;
      _shopEmail = updated['email']?.toString() ?? email;
      _shopAddress = updated['address']?.toString() ?? address;
      _shopLogo = updated['logo']?.toString() ?? logo;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_shopNameKey, _shopName);
      await prefs.setString(_shopCodeKey, _shopCode);
      await prefs.setString(_shopPhoneKey, _shopPhone);
      await prefs.setString(_shopEmailKey, _shopEmail);
      await prefs.setString(_shopAddressKey, _shopAddress);
      await prefs.setString(_shopLogoKey, _shopLogo);

      notifyListeners();
      return null;
    } catch (e) {
      return e.toString().replaceAll('Exception: ', '');
    }
  }

  /// First-time setup: register the business mobile number and log in.
  Future<String> register(String mobile) async {
    final prefs = await SharedPreferences.getInstance();
    _registeredMobile = mobile.trim();
    _isLoggedIn = true;
    await prefs.setString(_mobileKey, _registeredMobile!);
    await prefs.setBool(_loggedInKey, true);
    await SupabaseService().ensureAuth(force: true, mobile: _registeredMobile!);
    await refreshProfile();
    notifyListeners();
    return expectedPassword;
  }

  /// Returns true and logs in if mobile/email + password match database.
  Future<bool> login(String input, String password) async {
    final trimmed = input.trim();
    final trimmedPass = password.trim();

    // Authenticate with the Supabase / backend API
    final token = await SupabaseService().ensureAuth(
      force: true,
      mobile: trimmed,
      password: trimmedPass,
    );

    if (token != null) {
      final prefs = await SharedPreferences.getInstance();
      _isLoggedIn = true;
      _userEmail = trimmed;
      await prefs.setString(_userEmailKey, _userEmail);
      await prefs.setBool(_loggedInKey, true);
      await refreshProfile();
      notifyListeners();
      return true;
    }
    return false;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    _isLoggedIn = false;
    await prefs.setBool(_loggedInKey, false);
    await SupabaseConfig.clearAuth();
    _fieldPermissions.clear();
    notifyListeners();
  }
}
