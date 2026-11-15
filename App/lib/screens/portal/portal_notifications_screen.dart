import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/customer_portal_service.dart';
import '../../theme/app_theme.dart';

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

  IconData _getIconForNotification(String title, String msg) {
    final combined = '${title.toLowerCase()} ${msg.toLowerCase()}';
    if (combined.contains('order')) {
      return Icons.local_shipping_outlined;
    } else if (combined.contains('bill') || combined.contains('invoice')) {
      return Icons.receipt_long_rounded;
    } else if (combined.contains('payment') || combined.contains('paid') || combined.contains('received')) {
      return Icons.account_balance_wallet_outlined;
    } else if (combined.contains('reminder') || combined.contains('due')) {
      return Icons.notifications_active_outlined;
    }
    return Icons.notifications_outlined;
  }

  Color _getIconBgColor(String title, String msg) {
    final combined = '${title.toLowerCase()} ${msg.toLowerCase()}';
    if (combined.contains('order')) {
      return AppColors.blue50;
    } else if (combined.contains('bill') || combined.contains('invoice')) {
      return const Color(0xFFEDE9FE); // soft purple
    } else if (combined.contains('payment') || combined.contains('paid') || combined.contains('received')) {
      return AppColors.successBg;
    } else if (combined.contains('reminder') || combined.contains('due')) {
      return AppColors.warningBg;
    }
    return AppColors.blue50;
  }

  Color _getIconColor(String title, String msg) {
    final combined = '${title.toLowerCase()} ${msg.toLowerCase()}';
    if (combined.contains('order')) {
      return AppColors.blue600;
    } else if (combined.contains('bill') || combined.contains('invoice')) {
      return const Color(0xFF7C3AED); // purple
    } else if (combined.contains('payment') || combined.contains('paid') || combined.contains('received')) {
      return AppColors.success;
    } else if (combined.contains('reminder') || combined.contains('due')) {
      return AppColors.warning;
    }
    return AppColors.navy900;
  }

  @override
  Widget build(BuildContext context) {
    final hasUnread = _notifications.any((n) => n['is_read'] != true);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.navy900, AppColors.navy700],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Notifications',
          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: _markAllRead,
              child: const Text(
                'Mark All Read',
                style: TextStyle(color: AppColors.blue100, fontSize: 12.5, fontWeight: FontWeight.w600),
              ),
            ),
        ],
      ),
      body: _loading
          ? Padding(
              padding: const EdgeInsets.all(16),
              child: SkeletonLoader.list(count: 5),
            )
          : _notifications.isEmpty
              ? Center(
                  child: EmptyState(
                    icon: Icons.notifications_none_rounded,
                    title: 'No Notifications Yet',
                    subtitle: 'You will receive updates when orders are placed, bills are generated, or payments are confirmed.',
                    buttonLabel: 'Refresh',
                    onButtonPressed: _loadNotifications,
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.blue600,
                  onRefresh: _loadNotifications,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _notifications.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
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

                      final icon = _getIconForNotification(title, msg);
                      final iconBg = _getIconBgColor(title, msg);
                      final iconFg = _getIconColor(title, msg);

                      return AppCard(
                        padding: const EdgeInsets.all(14),
                        color: isRead ? Colors.white : const Color(0xFFFBFDFF),
                        border: Border.all(
                          color: isRead ? AppColors.border : AppColors.blue100,
                          width: isRead ? 1 : 1.5,
                        ),
                        onTap: () async {
                          if (!isRead && id > 0) {
                            await _service.markNotificationRead(id);
                            _loadNotifications();
                          }
                        },
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: iconBg,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(icon, size: 20, color: iconFg),
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
                                            fontSize: 13.5,
                                            fontWeight: isRead ? FontWeight.w600 : FontWeight.w800,
                                            color: AppColors.navy900,
                                          ),
                                        ),
                                      ),
                                      if (!isRead)
                                        Container(
                                          width: 8,
                                          height: 8,
                                          margin: const EdgeInsets.only(left: 6),
                                          decoration: const BoxDecoration(
                                            color: AppColors.blue600,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    msg,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: isRead ? AppColors.textSecondary : AppColors.textPrimary,
                                      height: 1.35,
                                    ),
                                  ),
                                  if (dateStr.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Text(
                                      dateStr,
                                      style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
