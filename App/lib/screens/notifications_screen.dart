import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/saved_bill.dart';
import '../models/saved_order.dart';
import '../navigation/app_navigation.dart';
import '../providers/bills_provider.dart';
import '../providers/notifications_provider.dart';
import '../providers/orders_provider.dart';
import '../theme/app_theme.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  String _activeTab = 'all'; // all, unread, bills, orders, payments, alerts

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationsProvider>().loadNotifications(force: true);
    });
  }

  Map<String, dynamic> _getVisuals(String? type) {
    switch (type) {
      case 'bill_created':
        return {
          'icon': Icons.receipt_long_rounded,
          'color': AppColors.navy900,
          'bg': AppColors.blue50,
          'border': AppColors.blue100,
          'category': 'bills',
        };
      case 'sale_cancelled':
      case 'bill_cancelled':
        return {
          'icon': Icons.cancel_outlined,
          'color': AppColors.danger,
          'bg': AppColors.dangerBg,
          'border': const Color(0xFFFECACA),
          'category': 'bills',
        };
      case 'payment_received':
        return {
          'icon': Icons.payments_rounded,
          'color': AppColors.success,
          'bg': AppColors.successBg,
          'border': const Color(0xFFBBF7D0),
          'category': 'payments',
        };
      case 'low_stock':
        return {
          'icon': Icons.warning_amber_rounded,
          'color': AppColors.warning,
          'bg': AppColors.warningBg,
          'border': const Color(0xFFFDE68A),
          'category': 'alerts',
        };
      case 'order_placed':
      case 'order_status_changed':
      case 'order_updated':
        return {
          'icon': Icons.shopping_bag_outlined,
          'color': AppColors.blue600,
          'bg': AppColors.blue50,
          'border': AppColors.blue100,
          'category': 'orders',
        };
      case 'emi_overdue':
        return {
          'icon': Icons.alarm_on_rounded,
          'color': AppColors.danger,
          'bg': AppColors.dangerBg,
          'border': const Color(0xFFFECACA),
          'category': 'alerts',
        };
      default:
        return {
          'icon': Icons.notifications_none_rounded,
          'color': AppColors.textSecondary,
          'bg': AppColors.bg,
          'border': AppColors.border,
          'category': 'all',
        };
    }
  }

  void _handleTapNotification(Map<String, dynamic> n, NotificationsProvider provider) {
    final id = n['id'];
    final isRead = n['is_read'] == true;
    if (!isRead) {
      provider.markAsRead(id);
    }

    final type = n['type']?.toString() ?? '';
    final refType = n['reference_type']?.toString().toLowerCase() ?? '';
    final refId = n['reference_id']?.toString() ?? '';
    final title = n['title']?.toString() ?? '';
    final msg = n['message']?.toString() ?? '';

    // 1. Bill Navigation
    if (type == 'bill_created' || refType == 'sale' || refType == 'bill') {
      final billsProvider = context.read<BillsProvider>();
      final invMatch = RegExp(r'#?(INV-?[A-Z0-9]+|B-[0-9]+)', caseSensitive: false).firstMatch('$title $msg');
      final invNo = invMatch?.group(1);
      final cleanInv = invNo?.replaceAll('#', '').replaceAll('-', '').toLowerCase();
      final SavedBill? bill = billsProvider.bills.where(
        (b) {
          if (b.id.toString() == refId) return true;
          if (invNo == null) return false;
          final bClean = b.billNumber.replaceAll('#', '').replaceAll('-', '').toLowerCase();
          final bDispClean = b.displayBillNumber.replaceAll('#', '').replaceAll('-', '').toLowerCase();
          return b.billNumber.toLowerCase() == invNo.toLowerCase() ||
              b.displayBillNumber.toLowerCase() == invNo.toLowerCase() ||
              bClean == cleanInv ||
              bDispClean == cleanInv;
        },
      ).firstOrNull ?? (billsProvider.bills.isNotEmpty ? billsProvider.bills.first : null);
      if (bill != null) {
        AppNavigation.openBillDetails(context, bill: bill, invoiceNo: invNo);
        return;
      }
    }

    // 2. Order Navigation
    if (type.contains('order') || refType == 'order') {
      final ordersProvider = context.read<OrdersProvider>();
      final ordMatch = RegExp(r'#?(ORD-?[0-9]+)', caseSensitive: false).firstMatch('$title $msg');
      final ordNo = ordMatch?.group(1);
      final cleanOrd = ordNo?.replaceAll('#', '').replaceAll('-', '').toLowerCase();
      final SavedOrder? order = ordersProvider.orders.where(
        (o) {
          if (o.id.toString() == refId) return true;
          if (ordNo == null) return false;
          final oClean = o.orderNumber.replaceAll('#', '').replaceAll('-', '').toLowerCase();
          final oDispClean = o.displayOrderNumber.replaceAll('#', '').replaceAll('-', '').toLowerCase();
          return o.orderNumber.toLowerCase() == ordNo.toLowerCase() ||
              o.displayOrderNumber.toLowerCase() == ordNo.toLowerCase() ||
              oClean == cleanOrd ||
              oDispClean == cleanOrd;
        },
      ).firstOrNull ?? (ordersProvider.orders.isNotEmpty ? ordersProvider.orders.first : null);
      if (order != null) {
        AppNavigation.openOrderDetails(context, order: order, orderNo: ordNo);
        return;
      }
    }

    // 3. Low stock Navigation -> Catalog
    if (type == 'low_stock' || refType == 'product') {
      AppNavigation.toTab(context, 3);
      return;
    }

    // 4. Payment Navigation -> Ledger
    if (type == 'payment_received' || refType == 'payment') {
      AppNavigation.toTab(context, 0);
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final notifsProvider = context.watch<NotificationsProvider>();
    final allNotifs = notifsProvider.notifications;
    final unreadCount = notifsProvider.unreadCount;
    final loading = notifsProvider.loading;

    final displayedList = allNotifs.where((n) {
      if (_activeTab == 'unread') return n['is_read'] != true;
      if (_activeTab == 'bills') {
        final t = n['type']?.toString() ?? '';
        return t == 'bill_created' || t == 'sale_cancelled' || t == 'bill_cancelled';
      }
      if (_activeTab == 'orders') {
        final t = n['type']?.toString() ?? '';
        return t.contains('order');
      }
      if (_activeTab == 'payments') {
        return (n['type']?.toString() ?? '') == 'payment_received';
      }
      if (_activeTab == 'alerts') {
        final t = n['type']?.toString() ?? '';
        return t == 'low_stock' || t == 'emi_overdue' || t == 'approval_needed';
      }
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, size: 22, color: AppColors.navy900),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            const Text(
              'Notifications',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.navy900,
              ),
            ),
            if (unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.blue50,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.blue100),
                ),
                child: Text(
                  '$unreadCount new',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.blue600,
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          if (unreadCount > 0)
            TextButton(
              onPressed: () => notifsProvider.markAllAsRead(),
              child: const Text(
                'Mark All Read',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.blue600,
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.textSecondary),
            onPressed: () => notifsProvider.loadNotifications(force: true),
            tooltip: 'Refresh Notifications',
          ),
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              children: [
                _buildTab('all', 'All (${allNotifs.length})'),
                const SizedBox(width: 8),
                _buildTab('unread', 'Unread ($unreadCount)'),
                const SizedBox(width: 8),
                _buildTab('bills', 'Bills'),
                const SizedBox(width: 8),
                _buildTab('orders', 'Orders'),
                const SizedBox(width: 8),
                _buildTab('payments', 'Payments'),
                const SizedBox(width: 8),
                _buildTab('alerts', 'Alerts'),
              ],
            ),
          ),
        ),
      ),
      body: loading && allNotifs.isEmpty
          ? Padding(
              padding: const EdgeInsets.all(16),
              child: SkeletonLoader.list(count: 6),
            )
          : RefreshIndicator(
              onRefresh: () => notifsProvider.loadNotifications(force: true),
              color: AppColors.blue600,
              child: displayedList.isEmpty
                  ? Center(
                      child: EmptyState(
                        icon: Icons.notifications_none_rounded,
                        title: _activeTab == 'unread'
                            ? 'No Unread Notifications'
                            : 'No Notifications Here',
                        subtitle: _activeTab == 'unread'
                            ? 'You have caught up with all business updates.'
                            : 'New bills, orders, and payments will appear here.',
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      itemCount: displayedList.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final n = displayedList[index];
                        final isRead = n['is_read'] == true;
                        final type = n['type']?.toString();
                        final title = n['title']?.toString() ?? 'Notification';
                        final message = n['message']?.toString() ?? '';
                        final visuals = _getVisuals(type);

                        String timeStr = '';
                        final createdAt = n['createdAt'] ?? n['created_at'];
                        if (createdAt != null) {
                          try {
                            final dt = DateTime.parse(createdAt.toString());
                            timeStr = DateFormat('dd MMM, hh:mm a').format(dt.toLocal());
                          } catch (_) {}
                        }

                        return AppCard(
                          padding: const EdgeInsets.all(12),
                          onTap: () => _handleTapNotification(n, notifsProvider),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Icon container
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: visuals['bg'] as Color,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: visuals['border'] as Color),
                                ),
                                child: Icon(
                                  visuals['icon'] as IconData,
                                  size: 20,
                                  color: visuals['color'] as Color,
                                ),
                              ),
                              const SizedBox(width: 12),

                              // Title, message, time
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
                                              fontWeight: isRead ? FontWeight.w600 : FontWeight.w700,
                                              color: isRead ? AppColors.textPrimary : AppColors.navy900,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        if (timeStr.isNotEmpty) ...[
                                          const SizedBox(width: 6),
                                          Text(
                                            timeStr,
                                            style: const TextStyle(
                                              fontSize: 10.5,
                                              color: AppColors.textSecondary,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      message,
                                      style: TextStyle(
                                        fontSize: 12.5,
                                        height: 1.35,
                                        color: isRead ? AppColors.textSecondary : AppColors.textPrimary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              // Unread dot indicator
                              if (!isRead) ...[
                                const SizedBox(width: 8),
                                Container(
                                  margin: const EdgeInsets.only(top: 4),
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: AppColors.blue600,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }

  Widget _buildTab(String key, String label) {
    final isSelected = _activeTab == key;
    return InkWell(
      onTap: () => setState(() => _activeTab = key),
      borderRadius: BorderRadius.circular(999),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.blue50 : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: isSelected ? AppColors.blue600 : AppColors.border,
            width: isSelected ? 1.4 : 1.0,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? AppColors.navy900 : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
