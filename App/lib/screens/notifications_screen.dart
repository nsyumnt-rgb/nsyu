import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/saved_bill.dart';
import '../models/saved_order.dart';
import '../navigation/app_navigation.dart';
import '../providers/bills_provider.dart';
import '../providers/notifications_provider.dart';
import '../providers/orders_provider.dart';

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
          'color': const Color(0xFF2563EB),
          'bg': const Color(0xFFEFF6FF),
          'border': const Color(0xFFBFDBFE),
          'category': 'bills',
        };
      case 'sale_cancelled':
      case 'bill_cancelled':
        return {
          'icon': Icons.cancel_outlined,
          'color': const Color(0xFFEF4444),
          'bg': const Color(0xFFFEF2F2),
          'border': const Color(0xFFFECACA),
          'category': 'bills',
        };
      case 'payment_received':
        return {
          'icon': Icons.payments_rounded,
          'color': const Color(0xFF10B981),
          'bg': const Color(0xFFECFDF5),
          'border': const Color(0xFFA7F3D0),
          'category': 'payments',
        };
      case 'low_stock':
        return {
          'icon': Icons.warning_amber_rounded,
          'color': const Color(0xFFF59E0B),
          'bg': const Color(0xFFFFFBEB),
          'border': const Color(0xFFFDE68A),
          'category': 'alerts',
        };
      case 'order_placed':
      case 'order_status_changed':
      case 'order_updated':
        return {
          'icon': Icons.shopping_bag_outlined,
          'color': const Color(0xFF6366F1),
          'bg': const Color(0xFFEEF2FF),
          'border': const Color(0xFFC7D2FE),
          'category': 'orders',
        };
      case 'emi_overdue':
        return {
          'icon': Icons.alarm_on_rounded,
          'color': const Color(0xFFDC2626),
          'bg': const Color(0xFFFEF2F2),
          'border': const Color(0xFFFECACA),
          'category': 'alerts',
        };
      default:
        return {
          'icon': Icons.notifications_none_rounded,
          'color': const Color(0xFF64748B),
          'bg': const Color(0xFFF8FAFC),
          'border': const Color(0xFFE2E8F0),
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
      // Extract invoice number from title e.g. "New Bill: INV-NSYU-000031"
      final invMatch = RegExp(r'(INV-[A-Z0-9-]+|B-[0-9]+)').firstMatch('$title $msg');
      final invNo = invMatch?.group(1);
      final SavedBill? bill = billsProvider.bills.where(
        (b) => (invNo != null && b.billNumber == invNo) || b.id.toString() == refId,
      ).firstOrNull ?? (billsProvider.bills.isNotEmpty ? billsProvider.bills.first : null);
      if (bill != null) {
        AppNavigation.openBillDetails(context, bill: bill, invoiceNo: invNo);
        return;
      }
    }

    // 2. Order Navigation
    if (type.contains('order') || refType == 'order') {
      final ordersProvider = context.read<OrdersProvider>();
      final ordMatch = RegExp(r'(ORD-[0-9]+)').firstMatch('$title $msg');
      final ordNo = ordMatch?.group(1);
      final SavedOrder? order = ordersProvider.orders.where(
        (o) => (ordNo != null && o.orderNumber == ordNo) || o.id.toString() == refId,
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
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            const Text(
              'Notifications',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E293B),
              ),
            ),
            if (unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Text(
                  '$unreadCount new',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1D4ED8),
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
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF2563EB),
                ),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20, color: Color(0xFF64748B)),
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
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
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
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: Color(0xFF2563EB),
              ),
            )
          : RefreshIndicator(
              onRefresh: () => notifsProvider.loadNotifications(force: true),
              color: const Color(0xFF2563EB),
              child: displayedList.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                        Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: const Icon(
                                  Icons.notifications_off_outlined,
                                  size: 26,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                _activeTab == 'unread'
                                    ? 'No unread notifications'
                                    : 'No notifications in this tab',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF475569),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _activeTab == 'unread'
                                    ? 'You have caught up with all updates.'
                                    : 'New bills, payments and stock alerts will appear here.',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
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

                        return InkWell(
                          onTap: () => _handleTapNotification(n, notifsProvider),
                          borderRadius: BorderRadius.circular(14),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isRead ? Colors.white : const Color(0xFFF0F7FF),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: isRead ? const Color(0xFFE2E8F0) : const Color(0xFFBFDBFE),
                                width: isRead ? 1 : 1.2,
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x06000000),
                                  blurRadius: 4,
                                  offset: Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Icon
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
                                                fontSize: 13,
                                                fontWeight: isRead ? FontWeight.w600 : FontWeight.w700,
                                                color: isRead ? const Color(0xFF334155) : const Color(0xFF0F172A),
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
                                                fontSize: 10,
                                                color: Color(0xFF94A3B8),
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
                                          fontSize: 12,
                                          height: 1.35,
                                          color: isRead ? const Color(0xFF64748B) : const Color(0xFF334155),
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
                                      color: Color(0xFF2563EB),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ],
                              ],
                            ),
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
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(8),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }
}
