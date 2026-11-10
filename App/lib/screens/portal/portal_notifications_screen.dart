import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/customer_portal_service.dart';

class PortalNotificationsScreen extends StatefulWidget {
  const PortalNotificationsScreen({super.key});

  @override
  State<PortalNotificationsScreen> createState() => _PortalNotificationsScreenState();
}

class _PortalNotificationsScreenState extends State<PortalNotificationsScreen> {
  final CustomerPortalService _service = CustomerPortalService();
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() => _loading = true);
    try {
      final list = await _service.listNotifications();
      if (mounted) setState(() => _notifications = list);
    } catch (_) {
      if (mounted) setState(() => _notifications = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markAllRead() async {
    await _service.markAllNotificationsRead();
    await _loadNotifications();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF047857),
        elevation: 0,
        title: const Text(
          'Notifications',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        actions: [
          if (_notifications.any((n) => n['is_read'] != true))
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark All Read', style: TextStyle(color: Colors.white, fontSize: 12)),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
              ? const Center(
                  child: Text('No notifications.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                )
              : RefreshIndicator(
                  onRefresh: _loadNotifications,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _notifications.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, idx) {
                      final n = _notifications[idx];
                      final id = int.tryParse(n['id']?.toString() ?? '0') ?? 0;
                      final title = n['title']?.toString() ?? 'Notification';
                      final msg = n['message']?.toString() ?? '';
                      final isRead = n['is_read'] == true;
                      final dt = n['createdAt']?.toString() ?? n['created_at']?.toString();
                      String dateStr = '';
                      if (dt != null && dt.isNotEmpty) {
                        try {
                          dateStr = DateFormat('dd MMM, hh:mm a').format(DateTime.parse(dt).toLocal());
                        } catch (_) {}
                      }

                      return InkWell(
                        onTap: () async {
                          if (!isRead) {
                            await _service.markNotificationRead(id);
                            _loadNotifications();
                          }
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isRead ? Colors.white : const Color(0xFFECFDF5),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: isRead ? const Color(0xFFE2E8F0) : const Color(0xFFA7F3D0)),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: isRead ? const Color(0xFFF1F5F9) : const Color(0xFFD1FAE5),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  Icons.notifications,
                                  size: 18,
                                  color: isRead ? const Color(0xFF94A3B8) : const Color(0xFF047857),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            title,
                                            style: TextStyle(
                                              fontSize: 13,
                                              fontWeight: isRead ? FontWeight.w600 : FontWeight.bold,
                                              color: const Color(0xFF0F172A),
                                            ),
                                          ),
                                        ),
                                        Text(dateStr, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(msg, style: const TextStyle(fontSize: 11, color: Color(0xFF475569))),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

