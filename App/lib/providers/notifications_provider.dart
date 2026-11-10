import 'dart:async';
import 'package:flutter/foundation.dart';
import '../services/supabase_service.dart';

class NotificationsProvider extends ChangeNotifier {
  final SupabaseService _service = SupabaseService();

  List<Map<String, dynamic>> _notifications = [];
  int _unreadCount = 0;
  bool _loading = false;
  Timer? _pollingTimer;
  DateTime? _lastFetchTime;

  List<Map<String, dynamic>> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get loading => _loading;
  DateTime? get lastFetchTime => _lastFetchTime;

  NotificationsProvider() {
    startPeriodicSync();
  }

  /// Starts periodic background refresh (every 25 seconds while app is alive)
  void startPeriodicSync() {
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      fetchUnreadCount();
    });
  }

  void stopPeriodicSync() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  @override
  void dispose() {
    stopPeriodicSync();
    super.dispose();
  }

  /// Refreshes the unread count lightweight endpoint
  Future<void> fetchUnreadCount() async {
    try {
      final count = await _service.getUnreadNotificationCount();
      if (_unreadCount != count) {
        _unreadCount = count;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error polling unread notifications: $e');
    }
  }

  /// Fully loads notification list and updates unread count
  Future<void> loadNotifications({bool force = false}) async {
    if (_loading && !force) return;
    _loading = true;
    notifyListeners();

    try {
      final list = await _service.fetchNotifications(limit: 60);
      _notifications = list;
      _unreadCount = _notifications.where((n) => n['is_read'] != true).length;
      _lastFetchTime = DateTime.now();
    } catch (e) {
      debugPrint('Error loading notifications list: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Marks a specific notification as read both locally and in backend
  Future<void> markAsRead(dynamic id) async {
    final strId = id?.toString() ?? '';
    // Optimistic local update
    bool changed = false;
    for (final n in _notifications) {
      if (n['id']?.toString() == strId && n['is_read'] != true) {
        n['is_read'] = true;
        changed = true;
      }
    }
    if (changed) {
      _unreadCount = (_unreadCount - 1).clamp(0, 99999);
      notifyListeners();
    }

    try {
      await _service.markNotificationRead(id);
    } catch (e) {
      debugPrint('Failed to mark notification $id as read: $e');
    }
  }

  /// Marks all notifications as read
  Future<void> markAllAsRead() async {
    for (final n in _notifications) {
      n['is_read'] = true;
    }
    _unreadCount = 0;
    notifyListeners();

    try {
      await _service.markAllNotificationsRead();
    } catch (e) {
      debugPrint('Failed to mark all notifications as read: $e');
    }
  }
}

