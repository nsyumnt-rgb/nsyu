import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CategoryIconDef {
  final String key;
  final String label;
  final IconData icon;

  const CategoryIconDef({
    required this.key,
    required this.label,
    required this.icon,
  });
}

/// Central registry of category icons with persistence and smart keyword matching.
class CategoryIconHelper {
  static const _prefsKey = 'nsyu_category_icons_map_v1';

  static final List<CategoryIconDef> availableIcons = [
    const CategoryIconDef(key: 'headphones', label: 'Audio / Headphones', icon: Icons.headphones_rounded),
    const CategoryIconDef(key: 'earbuds', label: 'TWS / Wireless Earbuds', icon: Icons.headset_mic_rounded),
    const CategoryIconDef(key: 'charger', label: 'Chargers / Adapters', icon: Icons.power_rounded),
    const CategoryIconDef(key: 'cable', label: 'Cables / Data Wires', icon: Icons.cable_rounded),
    const CategoryIconDef(key: 'powerbank', label: 'Power Banks / Battery', icon: Icons.battery_charging_full_rounded),
    const CategoryIconDef(key: 'case', label: 'Cases / Back Covers', icon: Icons.phone_android_rounded),
    const CategoryIconDef(key: 'glass', label: 'Tempered Glass / Screen', icon: Icons.screen_lock_portrait_rounded),
    const CategoryIconDef(key: 'holder', label: 'Car Mounts / Holders', icon: Icons.directions_car_rounded),
    const CategoryIconDef(key: 'speaker', label: 'Bluetooth Speakers', icon: Icons.speaker_rounded),
    const CategoryIconDef(key: 'watch', label: 'Smartwatches', icon: Icons.watch_rounded),
    const CategoryIconDef(key: 'monitor', label: 'Monitors / Displays', icon: Icons.desktop_windows_rounded),
    const CategoryIconDef(key: 'laptop', label: 'Laptops / Tech', icon: Icons.laptop_chromebook_rounded),
    const CategoryIconDef(key: 'adapter', label: 'OTG / USB Converters', icon: Icons.usb_rounded),
    const CategoryIconDef(key: 'memory', label: 'Memory / SD Cards', icon: Icons.sd_storage_rounded),
    const CategoryIconDef(key: 'devices', label: 'Mobile Accessories', icon: Icons.devices_other_rounded),
  ];

  static Map<String, String> _customIcons = {};
  static bool _loaded = false;

  /// Loads custom assigned category icons from local storage.
  static Future<void> init() async {
    if (_loaded) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_prefsKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw) as Map<String, dynamic>;
        _customIcons = decoded.map((k, v) => MapEntry(k, v.toString()));
      }
      _loaded = true;
    } catch (_) {}
  }

  /// Sets an icon identifier for a specific category and persists it.
  static Future<void> setCategoryIcon(String category, String iconKey) async {
    _customIcons[category.trim().toLowerCase()] = iconKey;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefsKey, jsonEncode(_customIcons));
    } catch (_) {}
  }

  /// Retrieves the icon identifier assigned to a category.
  static String? getCategoryIconKey(String category) {
    return _customIcons[category.trim().toLowerCase()];
  }

  /// Retrieves the IconData for a given category.
  static IconData getIconForCategory(String category, [String? desc, String? code]) {
    final catKey = category.trim().toLowerCase();
    if (_customIcons.containsKey(catKey)) {
      final key = _customIcons[catKey];
      final match = availableIcons.firstWhere(
        (def) => def.key == key,
        orElse: () => availableIcons.last,
      );
      return match.icon;
    }

    // Default smart keyword matching
    final d = '$category ${desc ?? ''} ${code ?? ''}'.toLowerCase();
    if (d.contains('earphone') || d.contains('headphone')) return Icons.headphones_rounded;
    if (d.contains('earbud') || d.contains('tws') || d.contains('airpod')) return Icons.headset_mic_rounded;
    if (d.contains('charger') || d.contains('chg') || d.contains('adapter')) return Icons.power_rounded;
    if (d.contains('cable') || d.contains('cbl') || d.contains('wire')) return Icons.cable_rounded;
    if (d.contains('power') || d.contains('pwr') || d.contains('battery')) return Icons.battery_charging_full_rounded;
    if (d.contains('case') || d.contains('cover')) return Icons.phone_android_rounded;
    if (d.contains('glass') || d.contains('screen')) return Icons.screen_lock_portrait_rounded;
    if (d.contains('holder') || d.contains('mount') || d.contains('stand')) return Icons.directions_car_rounded;
    if (d.contains('speaker') || d.contains('sound')) return Icons.speaker_rounded;
    if (d.contains('watch') || d.contains('band')) return Icons.watch_rounded;
    if (d.contains('monitor') || d.contains('display')) return Icons.desktop_windows_rounded;
    if (d.contains('laptop') || d.contains('macbook')) return Icons.laptop_chromebook_rounded;
    if (d.contains('otg') || d.contains('usb')) return Icons.usb_rounded;
    if (d.contains('memory') || d.contains('sd') || d.contains('card')) return Icons.sd_storage_rounded;
    return Icons.devices_other_rounded;
  }

  /// Retrieves a distinct theme color for a given category.
  static Color getColorForCategory(String category) {
    final d = category.trim().toLowerCase();
    if (d.contains('earphone') || d.contains('audio')) return const Color(0xFF2563EB);
    if (d.contains('charger')) return const Color(0xFFD97706);
    if (d.contains('cable')) return const Color(0xFF475569);
    if (d.contains('power') || d.contains('battery')) return const Color(0xFF059669);
    if (d.contains('case') || d.contains('cover')) return const Color(0xFF7C3AED);
    if (d.contains('glass') || d.contains('screen')) return const Color(0xFF0891B2);
    if (d.contains('holder') || d.contains('mount')) return const Color(0xFFDB2777);
    if (d.contains('earbud') || d.contains('tws')) return const Color(0xFF4F46E5);
    if (d.contains('speaker')) return const Color(0xFFDC2626);
    if (d.contains('watch')) return const Color(0xFF0284C7);
    return const Color(0xFF1D4ED8);
  }
}
