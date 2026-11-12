import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/customer_portal_provider.dart';
import '../../services/customer_portal_service.dart';
import 'portal_notifications_screen.dart';
import 'portal_order_detail_screen.dart';
import 'portal_bill_detail_screen.dart';
import 'portal_bills_screen.dart';
import 'portal_ledger_screen.dart';

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

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Log Out', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to log out of your customer portal?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      await context.read<AuthProvider>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final portal = context.watch<CustomerPortalProvider>();
    final cust = portal.customer;
    final dbMetrics = portal.dashboardData;
    final shop = (cust?['shop'] as Map<String, dynamic>?) ?? {};
    final shopName = dbMetrics?['shopName']?.toString() ?? shop['name']?.toString() ?? 'NSYU Shop';
    final customerName = dbMetrics?['customerName']?.toString() ?? cust?['name']?.toString() ?? 'Customer';
    final balance = (dbMetrics?['outstandingBalance'] as num?)?.toDouble() ?? portal.currentBalance;
    final totalBills = (dbMetrics?['totalBills'] as num?)?.toInt() ?? _recentBills.length;
    final totalOrders = (dbMetrics?['totalOrders'] as num?)?.toInt() ?? _recentOrders.length;
    final pendingOrders = (dbMetrics?['pendingOrders'] as num?)?.toInt() ?? 0;
    final unread = portal.unreadNotifications;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D4ED8),
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              customerName,
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              shopName,
              style: const TextStyle(color: Color(0xFFDBEAFE), fontSize: 11, fontWeight: FontWeight.w500),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              backgroundColor: const Color(0xFFF59E0B),
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
          IconButton(
            icon: const Icon(Icons.account_circle_outlined, color: Colors.white),
            tooltip: 'Profile',
            onPressed: () {
              portal.switchTab(4); // Switch to Profile tab
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white),
            tooltip: 'Logout',
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: RefreshIndicator(
        color: const Color(0xFF1D4ED8),
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
              // ── Summary Cards (2x2 Grid) ──
              Row(
                children: [
                  Expanded(
                    child: _buildMetricCard(
                      title: 'OUTSTANDING BALANCE',
                      value: '₹${balance.abs().toStringAsFixed(2)}',
                      subtitle: balance > 0
                          ? 'Payment Due'
                          : balance < 0
                              ? 'Advance Deposit'
                              : 'All Cleared',
                      valueColor: balance > 0
                          ? const Color(0xFFDC2626)
                          : balance < 0
                              ? const Color(0xFF16A34A)
                              : const Color(0xFF0F172A),
                      icon: Icons.account_balance_wallet,
                      iconBg: balance > 0 ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7),
                      iconColor: balance > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const PortalLedgerScreen()),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildMetricCard(
                      title: 'TOTAL BILLS',
                      value: '$totalBills',
                      subtitle: 'Issued Invoices',
                      valueColor: const Color(0xFF1D4ED8),
                      icon: Icons.receipt_long,
                      iconBg: const Color(0xFFDBEAFE),
                      iconColor: const Color(0xFF1D4ED8),
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
                    child: _buildMetricCard(
                      title: 'TOTAL ORDERS',
                      value: '$totalOrders',
                      subtitle: 'Lifetime Placed',
                      valueColor: const Color(0xFF0F172A),
                      icon: Icons.shopping_bag_outlined,
                      iconBg: const Color(0xFFF1F5F9),
                      iconColor: const Color(0xFF475569),
                      onTap: () {
                        portal.switchTab(3); // Switch to Orders tab
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildMetricCard(
                      title: 'PENDING ORDERS',
                      value: '$pendingOrders',
                      subtitle: pendingOrders > 0 ? 'In Fulfillment' : 'No Pending',
                      valueColor: pendingOrders > 0 ? const Color(0xFFD97706) : const Color(0xFF64748B),
                      icon: Icons.hourglass_top_rounded,
                      iconBg: const Color(0xFFFEF3C7),
                      iconColor: const Color(0xFFD97706),
                      onTap: () {
                        portal.switchTab(3); // Switch to Orders tab
                      },
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // ── Quick Actions (4 Grid Items) ──
              const Text(
                'Quick Actions',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _buildQuickActionTile(
                      icon: Icons.account_balance_wallet_outlined,
                      title: 'My Ledger',
                      subtitle: 'Statement & Balance',
                      color: const Color(0xFF1D4ED8),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const PortalLedgerScreen()),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildQuickActionTile(
                      icon: Icons.receipt_long_outlined,
                      title: 'My Bills',
                      subtitle: 'Download PDFs',
                      color: const Color(0xFF2563EB),
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
                      title: 'Shop Catalog',
                      subtitle: 'Explore Products',
                      color: const Color(0xFF059669),
                      onTap: () {
                        portal.switchTab(1); // Catalog
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildQuickActionTile(
                      icon: Icons.local_shipping_outlined,
                      title: 'My Orders',
                      subtitle: 'Track Status',
                      color: const Color(0xFF7C3AED),
                      onTap: () {
                        portal.switchTab(3); // Orders
                      },
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 28),

              // ── Recent Activity ──
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Recent Activity',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  // Segmented Filter
                  Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    padding: const EdgeInsets.all(2),
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

              if (_loading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(color: Color(0xFF1D4ED8)),
                  ),
                )
              else if (_recentTab == 0)
                _buildRecentOrdersView(context)
              else if (_recentTab == 1)
                _buildRecentBillsView(context)
              else
                _buildRecentPaymentsView(context),

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
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          boxShadow: active
              ? [const BoxShadow(color: Colors.black12, blurRadius: 2, offset: Offset(0, 1))]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: active ? FontWeight.bold : FontWeight.w500,
            color: active ? const Color(0xFF1D4ED8) : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtitle,
    required Color valueColor,
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: const [
            BoxShadow(color: Color(0x06000000), blurRadius: 6, offset: Offset(0, 2)),
          ],
        ),
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
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF64748B),
                      letterSpacing: 0.3,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 16, color: iconColor),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: valueColor,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: const [
            BoxShadow(color: Color(0x05000000), blurRadius: 4, offset: Offset(0, 2)),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 10.5,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentOrdersView(BuildContext context) {
    if (_recentOrders.isEmpty) {
      return _buildEmptyActivityCard('No orders placed yet. Explore the catalog to order!');
    }
    return Column(
      children: _recentOrders.map((ord) {
        final orderNum = ord['order_number']?.toString() ?? 'Order #${ord['id']}';
        final status = ord['status']?.toString() ?? 'pending';
        final total = ((ord['total_amount'] ?? 0) as num).toDouble();
        final dt = ord['createdAt']?.toString();
        final dateStr = dt != null ? DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(dt)) : '';

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => PortalOrderDetailScreen(orderId: (ord['id'] as num).toInt()),
                ),
              );
            },
            title: Row(
              children: [
                Text(
                  orderNum,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A)),
                ),
                const SizedBox(width: 8),
                _buildStatusPill(status),
              ],
            ),
            subtitle: Text(
              dateStr,
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '₹${total.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: Color(0xFF0F172A)),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94A3B8)),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildRecentBillsView(BuildContext context) {
    if (_recentBills.isEmpty) {
      return _buildEmptyActivityCard('No bills or invoices issued yet.');
    }
    return Column(
      children: _recentBills.map((b) {
        final invNum = b['invoice_number']?.toString() ?? 'INV-${b['id']}';
        final total = ((b['total_amount'] ?? 0) as num).toDouble();
        final paid = ((b['paid_amount'] ?? 0) as num).toDouble();
        final due = total - paid;
        final payStatus = (b['payment_status']?.toString() ?? 'unpaid').toUpperCase();
        final dt = b['date']?.toString() ?? b['createdAt']?.toString();
        final dateStr = dt != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(dt)) : '';

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => PortalBillDetailScreen(billId: (b['id'] as num).toInt()),
                ),
              );
            },
            title: Row(
              children: [
                Text(
                  invNum,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A)),
                ),
                const SizedBox(width: 8),
                _buildBillStatusPill(payStatus),
              ],
            ),
            subtitle: Text(
              '$dateStr • Due: ₹${due > 0 ? due.toStringAsFixed(2) : "0.00"}',
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '₹${total.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: Color(0xFF0F172A)),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94A3B8)),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildRecentPaymentsView(BuildContext context) {
    if (_recentPayments.isEmpty) {
      return _buildEmptyActivityCard('No payments recorded yet.');
    }
    return Column(
      children: _recentPayments.map((p) {
        final pNum = p['payment_number']?.toString() ?? 'PAY-${p['id']}';
        final amt = ((p['amount'] ?? 0) as num).toDouble();
        final mode = (p['payment_mode'] ?? p['payment_method'] ?? 'CASH').toString().toUpperCase();
        final dt = p['payment_date']?.toString() ?? p['createdAt']?.toString();
        final dateStr = dt != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(dt)) : '';

        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            leading: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.check_circle_outline, color: Color(0xFF16A34A), size: 18),
            ),
            title: Text(
              pNum,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A)),
            ),
            subtitle: Text(
              '$dateStr • $mode',
              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
            ),
            trailing: Text(
              '₹${amt.toStringAsFixed(2)}',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF16A34A)),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildEmptyActivityCard(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Center(
        child: Text(
          message,
          style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  Widget _buildStatusPill(String status) {
    Color bg = const Color(0xFFF1F5F9);
    Color text = const Color(0xFF475569);
    final s = status.toLowerCase();
    if (s == 'pending') {
      bg = const Color(0xFFFEF3C7);
      text = const Color(0xFFB45309);
    } else if (s == 'confirmed' || s == 'processing' || s == 'ready') {
      bg = const Color(0xFFDBEAFE);
      text = const Color(0xFF1D4ED8);
    } else if (s == 'delivered' || s == 'completed' || s == 'billed') {
      bg = const Color(0xFFDCFCE7);
      text = const Color(0xFF16A34A);
    } else if (s == 'cancelled' || s == 'rejected') {
      bg = const Color(0xFFFEE2E2);
      text = const Color(0xFFDC2626);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(color: text, fontSize: 9.5, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildBillStatusPill(String status) {
    Color bg = const Color(0xFFFEE2E2);
    Color text = const Color(0xFFDC2626);
    final s = status.toLowerCase();
    if (s == 'paid') {
      bg = const Color(0xFFDCFCE7);
      text = const Color(0xFF16A34A);
    } else if (s == 'partial') {
      bg = const Color(0xFFFEF3C7);
      text = const Color(0xFFB45309);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(color: text, fontSize: 9.5, fontWeight: FontWeight.bold),
      ),
    );
  }
}
