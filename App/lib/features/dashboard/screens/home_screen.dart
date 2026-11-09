import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../providers/auth_provider.dart';
import '../../../providers/bills_provider.dart';
import '../../../providers/catalog_provider.dart';
import '../../../providers/customer_provider.dart';
import '../../../providers/visibility_provider.dart';
import '../../../services/supabase_service.dart';
import '../../../widgets/app_bottom_nav.dart';
import '../../bills/screens/bill_screen.dart';
import '../../orders/screens/order_cart_screen.dart';
import '../../../screens/customer_picker_screen.dart';
import '../../../screens/notifications_screen.dart';
import '../../../screens/profile_screen.dart';
import '../widgets/dashboard_drawer.dart';
import '../widgets/dashboard_kpi_card.dart';
import '../widgets/dashboard_weekly_chart.dart';

class HomeScreen extends StatefulWidget {
  final ValueChanged<int> onNavigate;

  const HomeScreen({super.key, required this.onNavigate});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  String _selectedPeriod = 'Today';
  final String _chartPeriod = 'This Week';
  int _unreadNotifs = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      final billsProvider = context.read<BillsProvider>();
      final catalogProvider = context.read<CatalogProvider>();
      final customerProvider = context.read<CustomerProvider>();
      if (!billsProvider.loaded) await billsProvider.load();
      if (!billsProvider.syncing) billsProvider.syncFromSupabase();
      if (catalogProvider.status == LoadStatus.idle) {
        catalogProvider.loadProducts();
      }
      if (!customerProvider.loaded) customerProvider.load();
      _loadUnreadNotifs();
    });
  }

  Future<void> _loadUnreadNotifs() async {
    try {
      final count = await SupabaseService().getUnreadNotificationCount();
      if (mounted) setState(() => _unreadNotifs = count);
    } catch (_) {}
  }

  void _showAddProductDialog(CatalogProvider catalog) {
    showDialog(
      context: context,
      builder: (ctx) => _DashboardAddProductDialog(catalog: catalog),
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

    final canViewOutstanding =
        visibility.isBusinessInfoVisible('customer_outstanding', auth);
    final canViewProfit = visibility.isBusinessInfoVisible('profit', auth);

    final salesToday = bills.todaysSales;
    const purchasesToday = 0.0;
    final totalOutstanding = customers.customers.fold<double>(
        0.0, (sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0.0));
    final profitToday = salesToday > 0 ? (salesToday - purchasesToday) : 0.0;

    final shopName =
        auth.shopName.isNotEmpty ? auth.shopName : 'NSYU Main Store';

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFF8FAFC),
      drawer: DashboardDrawer(auth: auth),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await bills.load();
            await customers.load();
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              // Top Bar
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.menu_rounded,
                            size: 26, color: Color(0xFF0F172A)),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(
                            minWidth: 36, minHeight: 36),
                        onPressed: () =>
                            _scaffoldKey.currentState?.openDrawer(),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'NSYU Business',
                            style: TextStyle(
                                fontSize: 16.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A)),
                          ),
                          InkWell(
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                    content: Text('Active Outlet: $shopName'),
                                    duration: const Duration(seconds: 1)),
                              );
                            },
                            child: Row(
                              children: [
                                Text(
                                  shopName,
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF64748B),
                                      fontWeight: FontWeight.w500),
                                ),
                                const Icon(Icons.keyboard_arrow_down_rounded,
                                    size: 15, color: Color(0xFF64748B)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      // Date Selector Pill
                      PopupMenuButton<String>(
                        initialValue: _selectedPeriod,
                        onSelected: (val) =>
                            setState(() => _selectedPeriod = val),
                        itemBuilder: (ctx) => const [
                          PopupMenuItem(value: 'Today', child: Text('Today')),
                          PopupMenuItem(
                              value: 'This Week', child: Text('This Week')),
                          PopupMenuItem(
                              value: 'This Month', child: Text('This Month')),
                          PopupMenuItem(
                              value: 'All Time', child: Text('All Time')),
                        ],
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            boxShadow: [
                              BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.02),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1)),
                            ],
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today_outlined,
                                  size: 12, color: Color(0xFF64748B)),
                              const SizedBox(width: 5),
                              Text(
                                _selectedPeriod,
                                style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF334155)),
                              ),
                              const Icon(Icons.keyboard_arrow_down_rounded,
                                  size: 14, color: Color(0xFF64748B)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Notification Bell with Red Badge
                      InkWell(
                        onTap: () async {
                          await Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const NotificationsScreen()));
                          _loadUnreadNotifs();
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Stack(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(7),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: const Icon(Icons.notifications_none_rounded,
                                  size: 20, color: Color(0xFF334155)),
                            ),
                            if (_unreadNotifs > 0)
                              Positioned(
                                top: 2,
                                right: 2,
                                child: Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                      color: Color(0xFFEF4444),
                                      shape: BoxShape.circle),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Profile Avatar
                      InkWell(
                        onTap: () {
                          Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => ProfileScreen(
                                      onNavigate: widget.onNavigate)));
                        },
                        child: CircleAvatar(
                          radius: 17,
                          backgroundColor: const Color(0xFF1D4ED8),
                          child: Text(
                            auth.userName.isNotEmpty
                                ? auth.userName[0].toUpperCase()
                                : 'N',
                            style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // 4 KPI Stat Cards (2x2 Grid)
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.45,
                children: [
                  DashboardKpiCard(
                    title: 'Sales',
                    amount: '₹ ${money.format(salesToday)}',
                    icon: Icons.shopping_cart_outlined,
                    iconColor: const Color(0xFF16A34A),
                    iconBg: const Color(0xFFDCFCE7),
                  ),
                  DashboardKpiCard(
                    title: 'Purchases',
                    amount: '₹ ${money.format(purchasesToday)}',
                    icon: Icons.local_shipping_outlined,
                    iconColor: const Color(0xFF0284C7),
                    iconBg: const Color(0xFFE0F2FE),
                  ),
                  DashboardKpiCard(
                    title: 'Outstanding',
                    amount: canViewOutstanding
                        ? '₹ ${money.format(totalOutstanding)}'
                        : '•••',
                    icon: Icons.people_alt_outlined,
                    iconColor: const Color(0xFF2563EB),
                    iconBg: const Color(0xFFEFF6FF),
                  ),
                  DashboardKpiCard(
                    title: 'Total Profit',
                    amount:
                        canViewProfit ? '₹ ${money.format(profitToday)}' : '•••',
                    icon: Icons.bar_chart_rounded,
                    iconColor: const Color(0xFF16A34A),
                    iconBg: const Color(0xFFDCFCE7),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Sales Overview Card with Bar Chart
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
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A)),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Text(_chartPeriod,
                                  style: const TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF475569))),
                              const SizedBox(width: 4),
                              const Icon(Icons.keyboard_arrow_down,
                                  size: 14, color: Color(0xFF475569)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    DashboardWeeklyChart(bills: bills.bills),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Quick Actions Section
              const Text(
                'Quick Actions',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  DashboardQuickActionItem(
                    label: 'New Bill',
                    icon: Icons.receipt_long_rounded,
                    color: const Color(0xFFEA580C),
                    bg: const Color(0xFFFFF7ED),
                    onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const BillScreen())),
                  ),
                  DashboardQuickActionItem(
                    label: 'New Order',
                    icon: Icons.shopping_bag_outlined,
                    color: const Color(0xFF16A34A),
                    bg: const Color(0xFFF0FDF4),
                    onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const OrderCartScreen())),
                  ),
                  DashboardQuickActionItem(
                    label: 'Add Product',
                    icon: Icons.add_box_outlined,
                    color: const Color(0xFF0D9488),
                    bg: const Color(0xFFF0FDFA),
                    onTap: () => _showAddProductDialog(catalog),
                  ),
                  DashboardQuickActionItem(
                    label: 'Add Customer',
                    icon: Icons.person_add_alt_1_outlined,
                    color: const Color(0xFF1D4ED8),
                    bg: const Color(0xFFEFF6FF),
                    onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const CustomerPickerScreen())),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Recent Transactions preview
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Recent Bills',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A))),
                  TextButton(
                    onPressed: () => widget.onNavigate(2),
                    child: const Text('View All',
                        style: TextStyle(
                            color: Color(0xFF1D4ED8),
                            fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
              if (bills.recentBills.isEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0))),
                  child: const Center(
                      child: Text('No bills yet today',
                          style: TextStyle(color: Color(0xFF94A3B8)))),
                )
              else
                for (final b in bills.recentBills.take(3))
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
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
                            Text(b.billNumber,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                    color: Color(0xFF0F172A))),
                            Text(
                                b.customerName.isNotEmpty
                                    ? b.customerName
                                    : 'Walk-in Customer',
                                style: const TextStyle(
                                    fontSize: 11.5,
                                    color: Color(0xFF64748B))),
                          ],
                        ),
                        Text('₹${money.format(b.total)}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                color: Color(0xFF1D4ED8))),
                      ],
                    ),
                  ),
            ],
          ),
        ),
      ),
      bottomNavigationBar:
          AppBottomNav(currentIndex: 0, onTap: widget.onNavigate),
    );
  }
}

class _DashboardAddProductDialog extends StatefulWidget {
  final CatalogProvider catalog;

  const _DashboardAddProductDialog({required this.catalog});

  @override
  State<_DashboardAddProductDialog> createState() =>
      _DashboardAddProductDialogState();
}

class _DashboardAddProductDialogState
    extends State<_DashboardAddProductDialog> {
  late final TextEditingController _skuCtrl;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _catCtrl;
  late final TextEditingController _buyCtrl;
  late final TextEditingController _marginCtrl;
  late final TextEditingController _stockCtrl;

  @override
  void initState() {
    super.initState();
    _skuCtrl = TextEditingController();
    _nameCtrl = TextEditingController();
    _catCtrl = TextEditingController(text: 'Charger');
    _buyCtrl = TextEditingController();
    _marginCtrl = TextEditingController();
    _stockCtrl = TextEditingController(text: '20');
  }

  @override
  void dispose() {
    _skuCtrl.dispose();
    _nameCtrl.dispose();
    _catCtrl.dispose();
    _buyCtrl.dispose();
    _marginCtrl.dispose();
    _stockCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('Add Product',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: _skuCtrl,
                decoration: const InputDecoration(
                    labelText: 'SKU / Code *', border: OutlineInputBorder())),
            const SizedBox(height: 10),
            TextField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                    labelText: 'Product Name *', border: OutlineInputBorder())),
            const SizedBox(height: 10),
            TextField(
                controller: _catCtrl,
                decoration: const InputDecoration(
                    labelText: 'Category', border: OutlineInputBorder())),
            const SizedBox(height: 10),
            TextField(
              controller: _buyCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: 'Purchase Price (₹) *',
                  prefixText: '₹ ',
                  border: OutlineInputBorder()),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _marginCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                  labelText: 'Margin (₹)',
                  prefixText: '₹ ',
                  border: OutlineInputBorder()),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 6),
            Builder(builder: (_) {
              final buy = double.tryParse(_buyCtrl.text) ?? 0.0;
              final margin = double.tryParse(_marginCtrl.text) ?? 0.0;
              final selling = buy + margin;
              if (selling <= 0) return const SizedBox.shrink();
              return Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Selling Price = ₹${selling.toStringAsFixed(2)}',
                  style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF16A34A)),
                ),
              );
            }),
            const SizedBox(height: 10),
            TextField(
                controller: _stockCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Opening Stock', border: OutlineInputBorder())),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: () async {
            final buy = double.tryParse(_buyCtrl.text.trim()) ?? 0.0;
            final margin = double.tryParse(_marginCtrl.text.trim()) ?? 0.0;
            final stock = int.tryParse(_stockCtrl.text.trim()) ?? 0;
            if (_skuCtrl.text.trim().isEmpty ||
                _nameCtrl.text.trim().isEmpty ||
                buy <= 0) {
              return;
            }
            await widget.catalog.addProduct(
              code: _skuCtrl.text.trim(),
              desc: _nameCtrl.text.trim(),
              category: _catCtrl.text.trim(),
              purchase: buy,
              marginPrice: margin,
              stock: stock,
            );
            if (context.mounted) {
              Navigator.pop(context);
            }
          },
          style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1D4ED8),
              foregroundColor: Colors.white),
          child: const Text('Save'),
        ),
      ],
    );
  }
}
