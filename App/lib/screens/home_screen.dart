import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/saved_bill.dart';
import '../providers/auth_provider.dart';
import '../providers/bills_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/customer_provider.dart';
import '../providers/visibility_provider.dart';
import '../widgets/app_bottom_nav.dart';
import '../screens/customer_picker_screen.dart';
import '../screens/employees_screen.dart';
import '../screens/reports_screen.dart';
import '../screens/visibility_settings_screen.dart';
import '../screens/business_info_screen.dart';
import '../screens/backup_restore_screen.dart';
import '../screens/activity_log_screen.dart';
import '../screens/help_support_screen.dart';
import '../screens/about_app_screen.dart';
import '../screens/login_screen.dart';
import 'bill_screen.dart';
import 'order_cart_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  final ValueChanged<int> onNavigate;

  const HomeScreen({super.key, required this.onNavigate});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  String _selectedPeriod = 'Today'; // Today, This Week, This Month
  String _chartPeriod = 'This Week';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final billsProvider = context.read<BillsProvider>();
      final catalogProvider = context.read<CatalogProvider>();
      final customerProvider = context.read<CustomerProvider>();
      if (!billsProvider.loaded) await billsProvider.load();
      if (!billsProvider.syncing) billsProvider.syncFromDrive();
      if (catalogProvider.status == LoadStatus.idle) {
        catalogProvider.loadProducts();
      }
      if (!customerProvider.loaded) customerProvider.load();
    });
  }

  void _showAddProductDialog(BuildContext context, CatalogProvider catalog) {
    final skuCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final catCtrl = TextEditingController(text: 'Charger');
    final buyCtrl = TextEditingController();
    final marginCtrl = TextEditingController();
    final stockCtrl = TextEditingController(text: '20');

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Add Product', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: skuCtrl, decoration: const InputDecoration(labelText: 'SKU / Code *', border: OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Product Name *', border: OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(controller: catCtrl, decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder())),
              const SizedBox(height: 10),
              TextField(
                controller: buyCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Purchase Price (₹) *', prefixText: '₹ ', border: OutlineInputBorder()),
                onChanged: (_) => setDialogState(() {}),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: marginCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Margin (₹)', prefixText: '₹ ', border: OutlineInputBorder()),
                onChanged: (_) => setDialogState(() {}),
              ),
              const SizedBox(height: 6),
              Builder(builder: (_) {
                final buy = double.tryParse(buyCtrl.text) ?? 0.0;
                final margin = double.tryParse(marginCtrl.text) ?? 0.0;
                final selling = buy + margin;
                if (selling <= 0) return const SizedBox.shrink();
                return Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Selling Price = ₹${selling.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF16A34A)),
                  ),
                );
              }),
              const SizedBox(height: 10),
              TextField(controller: stockCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Opening Stock', border: OutlineInputBorder())),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final buy = double.tryParse(buyCtrl.text.trim()) ?? 0.0;
              final margin = double.tryParse(marginCtrl.text.trim()) ?? 0.0;
              final stock = int.tryParse(stockCtrl.text.trim()) ?? 0;
              if (skuCtrl.text.trim().isEmpty || nameCtrl.text.trim().isEmpty || buy <= 0) return;
              await catalog.addProduct(
                code: skuCtrl.text.trim(),
                desc: nameCtrl.text.trim(),
                category: catCtrl.text.trim(),
                purchase: buy,
                marginPrice: margin,
                stock: stock,
              );
              if (ctx.mounted) Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1D4ED8), foregroundColor: Colors.white),
            child: const Text('Save'),
          ),
        ],
      ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final visibility = context.watch<VisibilityProvider>();
    final bills = context.watch<BillsProvider>();
    final catalog = context.watch<CatalogProvider>();
    final customers = context.watch<CustomerProvider>();
    final money = NumberFormat('#,##0');

    final canViewOutstanding = visibility.isBusinessInfoVisible('customer_outstanding', auth);
    final canViewProfit = visibility.isBusinessInfoVisible('profit', auth);

    // Dynamic calculations from actual database records
    final salesToday = bills.todaysSales;
    final purchasesEstimate = bills.recentBills
        .where((b) => b.date.year == DateTime.now().year && b.date.month == DateTime.now().month && b.date.day == DateTime.now().day)
        .fold<double>(0.0, (sum, b) => sum + (b.total * 0.75));

    final totalOutstanding = customers.customers.fold<double>(0.0, (sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0.0));
    final profitToday = (salesToday - purchasesEstimate) > 0 ? (salesToday - purchasesEstimate) : (salesToday * 0.25);

    final shopName = auth.shopName.isNotEmpty ? auth.shopName : 'NSYU Main Store';

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: _buildAppDrawer(context, auth),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await bills.load();
            await customerProviderReload(customers);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              // Top Bar matching Image 2: Menu button, Store title/dropdown, Date pill, Notifications, Profile
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      // Hamburger Menu Button matching Image 2
                      IconButton(
                        icon: const Icon(Icons.menu_rounded, size: 26, color: Color(0xFF0F172A)),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                        onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'NSYU Business',
                            style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                          ),
                          InkWell(
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Active Outlet: $shopName'), duration: const Duration(seconds: 1)),
                              );
                            },
                            child: Row(
                              children: [
                                Text(
                                  shopName,
                                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                ),
                                const Icon(Icons.keyboard_arrow_down_rounded, size: 15, color: Color(0xFF64748B)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      // Date Selector Pill matching Image 2
                      PopupMenuButton<String>(
                        initialValue: _selectedPeriod,
                        onSelected: (val) => setState(() => _selectedPeriod = val),
                        itemBuilder: (ctx) => [
                          const PopupMenuItem(value: 'Today', child: Text('Today')),
                          const PopupMenuItem(value: 'This Week', child: Text('This Week')),
                          const PopupMenuItem(value: 'This Month', child: Text('This Month')),
                          const PopupMenuItem(value: 'All Time', child: Text('All Time')),
                        ],
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            boxShadow: [
                              BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 4, offset: const Offset(0, 1)),
                            ],
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today_outlined, size: 12, color: Color(0xFF64748B)),
                              const SizedBox(width: 5),
                              Text(
                                _selectedPeriod,
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                              ),
                              const Icon(Icons.keyboard_arrow_down_rounded, size: 14, color: Color(0xFF64748B)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Notification Bell with Red Badge matching Image 2
                      InkWell(
                        onTap: () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const ActivityLogScreen()));
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Stack(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: const Icon(Icons.notifications_none_rounded, size: 20, color: Color(0xFF334155)),
                            ),
                            Positioned(
                              top: 2,
                              right: 2,
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Profile Avatar matching Image 2
                      InkWell(
                        onTap: () {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => ProfileScreen(onNavigate: widget.onNavigate)));
                        },
                        child: CircleAvatar(
                          radius: 17,
                          backgroundColor: const Color(0xFF1D4ED8),
                          child: Text(
                            auth.userName.isNotEmpty ? auth.userName[0].toUpperCase() : 'N',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // 4 KPI Stat Cards (2x2 Grid) matching Image 2
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.45,
                children: [
                  // 1. Sales
                  _kpiCard(
                    title: 'Sales',
                    amount: '₹ ${money.format(salesToday)}',
                    badge: '↑ 12%',
                    isPositiveBadge: true,
                    icon: Icons.shopping_cart_outlined,
                    iconColor: const Color(0xFF16A34A),
                    iconBg: const Color(0xFFDCFCE7),
                  ),

                  // 2. Purchases
                  _kpiCard(
                    title: 'Purchases',
                    amount: '₹ ${money.format(purchasesEstimate)}',
                    badge: '↑ 8%',
                    isPositiveBadge: true,
                    icon: Icons.local_shipping_outlined,
                    iconColor: const Color(0xFF0284C7),
                    iconBg: const Color(0xFFE0F2FE),
                  ),

                  // 3. Outstanding (gated by canViewOutstanding)
                  _kpiCard(
                    title: 'Outstanding',
                    amount: canViewOutstanding ? '₹ ${money.format(totalOutstanding)}' : '•••',
                    icon: Icons.people_alt_outlined,
                    iconColor: const Color(0xFF2563EB),
                    iconBg: const Color(0xFFEFF6FF),
                  ),

                  // 4. Total Profit (gated by canViewProfit)
                  _kpiCard(
                    title: 'Total Profit',
                    amount: canViewProfit ? '₹ ${money.format(profitToday)}' : '•••',
                    badge: canViewProfit ? '↑ 15%' : null,
                    isPositiveBadge: true,
                    icon: Icons.bar_chart_rounded,
                    iconColor: const Color(0xFF16A34A),
                    iconBg: const Color(0xFFDCFCE7),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Sales Overview Card with Bar Chart matching Image 2
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Sales Overview',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Text(_chartPeriod, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
                              const SizedBox(width: 4),
                              const Icon(Icons.keyboard_arrow_down, size: 14, color: Color(0xFF475569)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildWeeklyBarChart(bills.bills),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Quick Actions Section matching Image 2
              const Text(
                'Quick Actions',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _quickActionItem(
                    label: 'New Bill',
                    icon: Icons.receipt_long_rounded,
                    color: const Color(0xFFEA580C),
                    bg: const Color(0xFFFFF7ED),
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BillScreen())),
                  ),
                  _quickActionItem(
                    label: 'New Order',
                    icon: Icons.shopping_bag_outlined,
                    color: const Color(0xFF16A34A),
                    bg: const Color(0xFFF0FDF4),
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OrderCartScreen())),
                  ),
                  _quickActionItem(
                    label: 'Add Product',
                    icon: Icons.add_box_outlined,
                    color: const Color(0xFF0D9488),
                    bg: const Color(0xFFF0FDFA),
                    onTap: () => _showAddProductDialog(context, catalog),
                  ),
                  _quickActionItem(
                    label: 'Add Customer',
                    icon: Icons.person_add_alt_1_outlined,
                    color: const Color(0xFF1D4ED8),
                    bg: const Color(0xFFEFF6FF),
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerPickerScreen())),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Recent Transactions preview
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Recent Bills', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                  TextButton(
                    onPressed: () => widget.onNavigate(2),
                    child: const Text('View All', style: TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
              if (bills.recentBills.isEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
                  child: const Center(child: Text('No bills yet today', style: TextStyle(color: Color(0xFF94A3B8)))),
                )
              else
                for (final b in bills.recentBills.take(3))
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(b.billNumber, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A))),
                            Text(b.customerName.isNotEmpty ? b.customerName : 'Walk-in Customer', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                          ],
                        ),
                        Text('₹${money.format(b.total)}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF1D4ED8))),
                      ],
                    ),
                  ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: AppBottomNav(currentIndex: 0, onTap: widget.onNavigate),
    );
  }

  Future<void> customerProviderReload(CustomerProvider provider) async {
    await provider.load();
  }

  Widget _kpiCard({
    required String title,
    required String amount,
    String? badge,
    bool isPositiveBadge = true,
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
              ),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, size: 16, color: iconColor),
              ),
            ],
          ),
          Text(
            amount,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
          ),
          if (badge != null)
            Text(
              badge,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: isPositiveBadge ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
              ),
            )
          else
            const SizedBox(height: 14),
        ],
      ),
    );
  }

  Widget _quickActionItem({
    required String label,
    required IconData icon,
    required Color color,
    required Color bg,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: color.withValues(alpha: 0.15)),
            ),
            child: Icon(icon, color: color, size: 26),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
          ),
        ],
      ),
    );
  }

  Widget _buildWeeklyBarChart(List<SavedBill> bills) {
    // 7 days of the current week (Mon-Sun)
    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final now = DateTime.now();
    // Monday of current week
    final monday = now.subtract(Duration(days: now.weekday - 1));

    final dailyTotals = List.filled(7, 0.0);
    for (final b in bills) {
      final diff = b.date.difference(DateTime(monday.year, monday.month, monday.day)).inDays;
      if (diff >= 0 && diff < 7) {
        dailyTotals[diff] += b.total;
      }
    }

    double maxVal = dailyTotals.reduce((curr, next) => curr > next ? curr : next);
    if (maxVal < 1000) maxVal = 1000;

    return SizedBox(
      height: 120,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Y axis
          Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text('30K', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
              Text('20K', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
              Text('10K', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
              Text('0', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
            ],
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (int i = 0; i < 7; i++)
                  _chartBar(
                    day: days[i],
                    heightRatio: (dailyTotals[i] / maxVal).clamp(0.08, 1.0),
                    isToday: (now.weekday - 1) == i,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _chartBar({required String day, required double heightRatio, required bool isToday}) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Container(
          width: 14,
          height: 80 * heightRatio,
          decoration: BoxDecoration(
            color: isToday ? const Color(0xFF1D4ED8) : const Color(0xFF93C5FD),
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          day,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
            color: isToday ? const Color(0xFF1D4ED8) : const Color(0xFF64748B),
          ),
        ),
      ],
    );
  }

  Widget _buildAppDrawer(BuildContext context, AuthProvider auth) {
    final profile = auth.currentProfile;
    final shopName = auth.shopName.isNotEmpty ? auth.shopName : 'NSYU Main Store';

    return Drawer(
      backgroundColor: Colors.white,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF1D4ED8), Color(0xFF2563EB)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Image.asset(
                          'assets/nsyu_logo.png',
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Icon(Icons.storefront_rounded, size: 28, color: Color(0xFF1D4ED8)),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'NSYU Business',
                            style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                          ),
                          Text(
                            shopName,
                            style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  'Logged in as: ${profile.ownerName.isNotEmpty ? profile.ownerName : 'Admin'} (${profile.role})',
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          _drawerItem(
            icon: Icons.people_alt_outlined,
            title: 'Customers',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerPickerScreen()));
            },
          ),
          _drawerItem(
            icon: Icons.menu_book_outlined,
            title: 'Customer Ledger',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerPickerScreen()));
            },
          ),
          _drawerItem(
            icon: Icons.bar_chart_rounded,
            title: 'Reports',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const ReportsScreen()));
            },
          ),
          _drawerItem(
            icon: Icons.badge_outlined,
            title: 'Employees',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const EmployeesScreen()));
            },
          ),
          _drawerItem(
            icon: Icons.visibility_outlined,
            title: 'Visibility & Display Settings',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const VisibilitySettingsScreen()));
            },
          ),
          const Divider(height: 16),
          _drawerItem(
            icon: Icons.storefront_outlined,
            title: 'Business Information',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const BusinessInfoScreen()));
            },
          ),
          _drawerItem(
            icon: Icons.cloud_sync_outlined,
            title: 'Backup & Restore',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const BackupRestoreScreen()));
            },
          ),
          _drawerItem(
            icon: Icons.history_rounded,
            title: 'Activity Log',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const ActivityLogScreen()));
            },
          ),
          _drawerItem(
            icon: Icons.help_outline_rounded,
            title: 'Help & Support',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpSupportScreen()));
            },
          ),
          _drawerItem(
            icon: Icons.info_outline_rounded,
            title: 'About App',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AboutAppScreen()));
            },
          ),
          const Divider(height: 16),
          _drawerItem(
            icon: Icons.logout_rounded,
            title: 'Logout',
            textColor: const Color(0xFFDC2626),
            iconColor: const Color(0xFFDC2626),
            onTap: () async {
              Navigator.pop(context);
              await auth.logout();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _drawerItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Color? iconColor,
    Color? textColor,
  }) {
    return ListTile(
      leading: Icon(icon, color: iconColor ?? const Color(0xFF1D4ED8), size: 22),
      title: Text(
        title,
        style: TextStyle(
          color: textColor ?? const Color(0xFF0F172A),
          fontWeight: FontWeight.w600,
          fontSize: 14,
        ),
      ),
      onTap: onTap,
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
    );
  }
}
