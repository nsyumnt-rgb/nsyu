import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/customer_portal_provider.dart';
import '../../services/customer_portal_service.dart';
import '../../theme/app_theme.dart';
import 'portal_notifications_screen.dart';
import 'portal_order_detail_screen.dart';
import 'portal_bill_detail_screen.dart';
import 'portal_bills_screen.dart';
import 'portal_cart_screen.dart';

class PortalHomeScreen extends StatefulWidget {
  const PortalHomeScreen({super.key});

  @override
  State<PortalHomeScreen> createState() => _PortalHomeScreenState();
}

class _PortalHomeScreenState extends State<PortalHomeScreen> {
  final CustomerPortalService _service = CustomerPortalService();
  List<Map<String, dynamic>> _recentOrders = [];
  List<Map<String, dynamic>> _recentBills = [];
  List<Map<String, dynamic>> _recentPayments = [];
  bool _loading = true;
  int _recentTab = 0; // 0: Orders, 1: Bills, 2: Payments

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _service.listOrders(limit: 5),
        _service.listBills(limit: 5),
        _service.listPayments(),
      ]);
      if (mounted) {
        setState(() {
          _recentOrders = results[0];
          _recentBills = results[1];
          _recentPayments = results[2];
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final portal = context.watch<CustomerPortalProvider>();
    final cust = portal.customer;
    final dbMetrics = portal.dashboardData;
    final shop = (cust?['shop'] as Map<String, dynamic>?) ?? {};
    final shopName = dbMetrics?['shopName']?.toString() ?? shop['name']?.toString() ?? 'NSYU Business';
    final customerName = dbMetrics?['customerName']?.toString() ?? cust?['name']?.toString() ?? 'Customer';

    final ordersList = portal.orders.isNotEmpty ? portal.orders : _recentOrders;
    final billsList = portal.bills.isNotEmpty ? portal.bills : _recentBills;
    final paymentsList = portal.payments.isNotEmpty ? portal.payments : _recentPayments;

    final balance = parseDouble(dbMetrics?['outstandingBalance'] ?? portal.currentBalance);
    final totalBills = parseInt(dbMetrics?['totalBills'] ?? billsList.length);
    final totalOrders = parseInt(dbMetrics?['totalOrders'] ?? ordersList.length);
    final pendingOrders = parseInt(dbMetrics?['pendingOrders'] ?? ordersList.where((o) => (o['status']?.toString() ?? '').toLowerCase() == 'pending').length);
    final unread = portal.unreadNotifications;
    final cartCount = portal.cartItemCount;

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
        titleSpacing: 16,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              customerName,
              style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              shopName,
              style: const TextStyle(color: AppColors.blue100, fontSize: 12, fontWeight: FontWeight.w500),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: cartCount > 0,
              label: Text('$cartCount'),
              backgroundColor: AppColors.warning,
              child: const Icon(Icons.shopping_cart_outlined, color: Colors.white),
            ),
            tooltip: 'My Cart',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const PortalCartScreen()),
              );
            },
          ),
          IconButton(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              backgroundColor: AppColors.warning,
              child: const Icon(Icons.notifications_outlined, color: Colors.white),
            ),
            tooltip: 'Notifications',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const PortalNotificationsScreen()),
              ).then((_) => portal.refreshAll());
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.blue600,
        onRefresh: () async {
          await portal.refreshAll();
          await _loadDashboardData();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Hero Outstanding Balance Card ──
              AppCard(
                padding: const EdgeInsets.all(18),
                onTap: () => portal.switchTab(3),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Outstanding Balance',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        StatusChip(
                          label: balance > 0
                              ? 'Payment Due'
                              : (balance < 0 ? 'Advance' : 'All Cleared'),
                          variant: balance > 0
                              ? StatusChipVariant.danger
                              : (balance < 0 ? StatusChipVariant.warning : StatusChipVariant.success),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    AmountText(
                      amount: balance.abs(),
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: balance > 0
                          ? AppColors.danger
                          : (balance < 0 ? AppColors.warning : AppColors.success),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      balance > 0
                          ? 'Please clear pending dues at the shop'
                          : (balance < 0
                              ? 'You have advance deposit credit'
                              : 'No pending payments on your account'),
                      style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 14),

              // ── Summary Cards (3 Metric Badges) ──
              Row(
                children: [
                  Expanded(
                    child: _buildMetricCard(
                      title: 'Bills',
                      value: '$totalBills',
                      subtitle: 'Invoices',
                      icon: Icons.receipt_long_rounded,
                      color: AppColors.navy900,
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const PortalBillsScreen()),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildMetricCard(
                      title: 'Orders',
                      value: '$totalOrders',
                      subtitle: 'Placed',
                      icon: Icons.shopping_bag_outlined,
                      color: AppColors.blue600,
                      onTap: () => portal.switchTab(2),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildMetricCard(
                      title: 'Pending',
                      value: '$pendingOrders',
                      subtitle: 'Active',
                      icon: Icons.hourglass_top_rounded,
                      color: pendingOrders > 0 ? AppColors.warning : AppColors.textSecondary,
                      onTap: () => portal.switchTab(2),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 22),

              // ── Quick Actions ──
              const SectionHeader(title: 'Quick Actions'),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildQuickActionTile(
                      icon: Icons.account_balance_wallet_outlined,
                      title: 'My Ledger',
                      subtitle: 'Statement',
                      onTap: () => portal.switchTab(3),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildQuickActionTile(
                      icon: Icons.receipt_long_outlined,
                      title: 'My Bills',
                      subtitle: 'Invoices & PDF',
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const PortalBillsScreen()),
                        );
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildQuickActionTile(
                      icon: Icons.storefront_outlined,
                      title: 'Catalog',
                      subtitle: 'Browse Items',
                      onTap: () => portal.switchTab(1),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildQuickActionTile(
                      icon: Icons.local_shipping_outlined,
                      title: 'My Orders',
                      subtitle: 'Track Deliveries',
                      onTap: () => portal.switchTab(2),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // ── Recent Activity ──
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Recent Activity',
                    style: TextStyle(
                      fontSize: 16.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy900,
                    ),
                  ),
                  // Segmented Filter
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: AppColors.border),
                    ),
                    padding: const EdgeInsets.all(3),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildRecentTabPill(0, 'Orders'),
                        _buildRecentTabPill(1, 'Bills'),
                        _buildRecentTabPill(2, 'Payments'),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              if ((_loading || portal.loading) && ordersList.isEmpty && billsList.isEmpty && paymentsList.isEmpty)
                const SkeletonLoader(width: double.infinity, height: 160)
              else if (_recentTab == 0)
                _buildRecentOrdersView(context, ordersList)
              else if (_recentTab == 1)
                _buildRecentBillsView(context, billsList)
              else
                _buildRecentPaymentsView(context, paymentsList),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRecentTabPill(int index, String label) {
    final active = _recentTab == index;
    return GestureDetector(
      onTap: () => setState(() => _recentTab = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: active ? AppColors.blue50 : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: active ? FontWeight.bold : FontWeight.w500,
            color: active ? AppColors.navy900 : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 4),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 10.5,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return AppCard(
      padding: const EdgeInsets.all(12),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.blue50,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.navy900, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: AppColors.navy900,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentOrdersView(BuildContext context, List<Map<String, dynamic>> ordersList) {
    final items = ordersList.take(5).toList();
    if (items.isEmpty) {
      return const EmptyState(
        icon: Icons.shopping_bag_outlined,
        title: 'No Orders Yet',
        subtitle: 'Explore the catalog to place your first order!',
      );
    }
    return Column(
      children: items.map((ord) {
        final orderNum = ord['order_number']?.toString() ?? 'Order #${ord['id']}';
        final status = ord['status']?.toString() ?? 'pending';
        final total = parseDouble(ord['total_amount']);
        final dt = ord['createdAt']?.toString() ?? ord['order_date']?.toString();
        final dateStr = formatDateSafe(dt, 'dd MMM yyyy');
        final orderId = parseInt(ord['id']);

        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => PortalOrderDetailScreen(orderId: orderId),
                ),
              );
            },
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            orderNum,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.navy900),
                          ),
                          const SizedBox(width: 8),
                          _buildStatusPill(status),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        dateStr,
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                AmountText(
                  amount: total,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy900,
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, size: 18, color: AppColors.textSecondary),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildRecentBillsView(BuildContext context, List<Map<String, dynamic>> billsList) {
    final items = billsList.take(5).toList();
    if (items.isEmpty) {
      return const EmptyState(
        icon: Icons.receipt_long_outlined,
        title: 'No Bills Yet',
        subtitle: 'No bills or invoices have been issued yet.',
      );
    }
    return Column(
      children: items.map((b) {
        final invNum = b['invoice_number']?.toString() ?? 'INV-${b['id']}';
        final total = parseDouble(b['total_amount']);
        final paid = parseDouble(b['paid_amount']);
        final due = total - paid;
        final payStatus = (b['payment_status']?.toString() ?? 'unpaid').toUpperCase();
        final dt = b['date']?.toString() ?? b['createdAt']?.toString() ?? b['invoice_date']?.toString();
        final dateStr = formatDateSafe(dt, 'dd MMM yyyy');
        final billId = parseInt(b['id']);

        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => PortalBillDetailScreen(billId: billId),
                ),
              );
            },
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            invNum,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.navy900),
                          ),
                          const SizedBox(width: 8),
                          _buildBillStatusPill(payStatus),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '$dateStr · Due: ₹${due > 0 ? due.toStringAsFixed(2) : "0.00"}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                AmountText(
                  amount: total,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy900,
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, size: 18, color: AppColors.textSecondary),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildRecentPaymentsView(BuildContext context, List<Map<String, dynamic>> paymentsList) {
    final items = paymentsList.take(5).toList();
    if (items.isEmpty) {
      return const EmptyState(
        icon: Icons.payments_outlined,
        title: 'No Payments Yet',
        subtitle: 'No payment receipts recorded yet.',
      );
    }
    return Column(
      children: items.map((p) {
        final pNum = p['payment_number']?.toString() ?? 'PAY-${p['id']}';
        final amt = parseDouble(p['amount']);
        final mode = (p['payment_mode'] ?? p['payment_method'] ?? 'CASH').toString().toUpperCase();
        final dt = p['payment_date']?.toString() ?? p['createdAt']?.toString();
        final dateStr = formatDateSafe(dt, 'dd MMM yyyy');

        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.successBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.check_circle_outline, color: AppColors.success, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        pNum,
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.navy900),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$dateStr · $mode',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                AmountText(
                  amount: amt,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.success,
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildStatusPill(String status) {
    final s = status.toLowerCase();
    if (s == 'pending') {
      return const StatusChip(label: 'PENDING', variant: StatusChipVariant.warning);
    } else if (s == 'confirmed' || s == 'processing' || s == 'ready') {
      return const StatusChip(label: 'CONFIRMED', variant: StatusChipVariant.info);
    } else if (s == 'delivered' || s == 'completed' || s == 'billed') {
      return const StatusChip(label: 'DELIVERED', variant: StatusChipVariant.success);
    } else if (s == 'cancelled' || s == 'rejected') {
      return const StatusChip(label: 'CANCELLED', variant: StatusChipVariant.danger);
    }
    return StatusChip(label: status.toUpperCase(), variant: StatusChipVariant.neutral);
  }

  Widget _buildBillStatusPill(String status) {
    final s = status.toLowerCase();
    if (s == 'paid') {
      return const StatusChip(label: 'PAID', variant: StatusChipVariant.success);
    } else if (s == 'partial') {
      return const StatusChip(label: 'PARTIAL', variant: StatusChipVariant.warning);
    }
    return const StatusChip(label: 'UNPAID', variant: StatusChipVariant.danger);
  }
}
