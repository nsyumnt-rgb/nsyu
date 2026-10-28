import 'package:flutter/foundation.dart';

import '../models/app_settings.dart';
import '../services/settings_store_service.dart';
import '../services/supabase_service.dart';

class SettingsProvider extends ChangeNotifier {
  final SettingsStoreService _store = SettingsStoreService();
  final SupabaseService _supabaseService = SupabaseService();

  AppSettings settings = AppSettings();
  bool loaded = false;
  bool syncing = false;
  String? syncError;

  Future<void> load() async {
    settings = await _store.loadSettings();
    loaded = true;
    notifyListeners();
    syncFromSupabase();
  }

  /// Pulls business profile & settings from Supabase PostgreSQL
  Future<void> syncFromSupabase() async {
    syncing = true;
    syncError = null;
    notifyListeners();
    try {
      settings = await _supabaseService.fetchSettings();
      await _store.saveSettings(settings);
    } catch (e) {
      syncError = e.toString();
    }
    syncing = false;
    notifyListeners();
  }

  /// Backward-compatible alias for syncFromDrive()
  Future<void> syncFromDrive() => syncFromSupabase();
}
