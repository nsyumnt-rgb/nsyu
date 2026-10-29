import 'package:flutter/foundation.dart' show debugPrint;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Centralized Configuration for the Supabase Integration.
/// Supports both:
/// 1. Direct Supabase Client SDK (`supabase_flutter`) using the Project URL & Publishable Key
/// 2. The high-performance Node.js API backend connected to the Supabase PostgreSQL database
class SupabaseConfig {
  /// Existing Supabase Project URL
  static const String defaultSupabaseUrl =
      'https://lggjtxzannywecuvwqbl.supabase.co';

  /// Supabase publishable / anon key (configurable via compile-time define or runtime prefs)
  static const String defaultPublishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
    defaultValue: String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: ''),
  );

  /// Live 24/7 Cloud API URL hosted on Render
  static const String liveCloudApiUrl = 'https://nsyu-backend-api.onrender.com/api';

  /// Default API base URL connected to the Supabase PostgreSQL database
  static String get defaultApiUrl => liveCloudApiUrl;

  static const String _prefApiUrlKey = 'nsyu_supabase_api_url';
  static const String _prefSupabaseUrlKey = 'nsyu_supabase_url';
  static const String _prefAnonKey = 'nsyu_supabase_anon_key';
  static const String _prefTokenKey = 'nsyu_supabase_token';
  static const String _prefOwnerIdKey = 'nsyu_owner_id';
  static const String _prefShopIdKey = 'nsyu_shop_id';

  static String _apiUrl = defaultApiUrl;
  static String _supabaseUrl = defaultSupabaseUrl;
  static String _publishableKey = defaultPublishableKey;
  static String? _authToken;
  static int _ownerId = 1;
  static int _shopId = 1;
  static bool _isClientInitialized = false;

  static String get apiUrl => _apiUrl;
  static String get supabaseUrl => _supabaseUrl;
  static String get publishableKey => _publishableKey;
  static String get anonKey => _publishableKey;
  static String? get authToken => _authToken;
  static int get ownerId => _ownerId;
  static int get shopId => _shopId;
  static bool get isClientInitialized => _isClientInitialized;

  /// Global Supabase Client instance (available after Supabase.initialize)
  static SupabaseClient? get client {
    if (!_isClientInitialized) {
      try {
        return Supabase.instance.client;
      } catch (_) {
        return null;
      }
    }
    try {
      return Supabase.instance.client;
    } catch (_) {
      return null;
    }
  }

  /// Loads persisted configuration from SharedPreferences and initializes Supabase client if key exists
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final savedApiUrl = prefs.getString(_prefApiUrlKey);
    // If the saved URL is empty, localhost, or android emulator 10.0.2.2,
    // automatically migrate to the 24/7 live cloud backend URL on Render!
    if (savedApiUrl == null ||
        savedApiUrl.isEmpty ||
        savedApiUrl.contains('localhost') ||
        savedApiUrl.contains('10.0.2.2')) {
      _apiUrl = liveCloudApiUrl;
      await prefs.setString(_prefApiUrlKey, _apiUrl);
    } else {
      _apiUrl = savedApiUrl;
    }
    _supabaseUrl = prefs.getString(_prefSupabaseUrlKey) ?? defaultSupabaseUrl;
    _publishableKey = prefs.getString(_prefAnonKey) ?? defaultPublishableKey;
    _authToken = prefs.getString(_prefTokenKey);
    _ownerId = prefs.getInt(_prefOwnerIdKey) ?? 1;
    _shopId = prefs.getInt(_prefShopIdKey) ?? 1;

    // Automatically initialize the official Supabase client SDK if a publishable key is present
    if (_publishableKey.isNotEmpty && _supabaseUrl.isNotEmpty) {
      await initClient();
    }
  }

  /// Initializes or re-initializes the official Supabase Flutter Client
  static Future<bool> initClient() async {
    if (_publishableKey.isEmpty || _supabaseUrl.isEmpty) {
      return false;
    }

    try {
      await Supabase.initialize(
        url: _supabaseUrl,
        publishableKey: _publishableKey,
      );
      _isClientInitialized = true;
      return true;
    } catch (e) {
      try {
        // If already initialized in this process
        final _ = Supabase.instance.client;
        _isClientInitialized = true;
        return true;
      } catch (_) {
        debugPrint('Supabase client initialization notice: $e');
        return false;
      }
    }
  }

  /// Saves updated API and Supabase configuration
  static Future<void> updateConfig({
    String? apiUrl,
    String? supabaseUrl,
    String? publishableKey,
    String? anonKey,
    String? authToken,
    int? ownerId,
    int? shopId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    if (apiUrl != null) {
      _apiUrl = apiUrl.trim();
      await prefs.setString(_prefApiUrlKey, _apiUrl);
    }
    if (supabaseUrl != null) {
      _supabaseUrl = supabaseUrl.trim();
      await prefs.setString(_prefSupabaseUrlKey, _supabaseUrl);
    }
    final keyToSet = publishableKey ?? anonKey;
    if (keyToSet != null) {
      _publishableKey = keyToSet.trim();
      await prefs.setString(_prefAnonKey, _publishableKey);
      if (_publishableKey.isNotEmpty) {
        await initClient();
      }
    }
    if (authToken != null) {
      _authToken = authToken;
      await prefs.setString(_prefTokenKey, authToken);
    }
    if (ownerId != null) {
      _ownerId = ownerId;
      await prefs.setInt(_prefOwnerIdKey, ownerId);
    }
    if (shopId != null) {
      _shopId = shopId;
      await prefs.setInt(_prefShopIdKey, shopId);
    }
  }

  /// Clears stored authentication token on logout
  static Future<void> clearAuth() async {
    _authToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefTokenKey);
  }
}

/// Global convenience accessor for the Supabase Client
SupabaseClient? get supabase => SupabaseConfig.client;
