import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../models/saved_payment.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/bills_provider.dart';
import '../../../providers/catalog_provider.dart';
import '../../../providers/customer_provider.dart';
import '../../../providers/notifications_provider.dart';
import '../../../providers/visibility_provider.dart';
import '../../../screens/collect_payment_screen.dart';
import '../../../screens/customer_picker_screen.dart';
import '../../../screens/notifications_screen.dart';
import '../../../screens/profile_screen.dart';
import '../../../theme/app_theme.dart';
import '../../bills/screens/bill_screen.dart';
import '../widgets/dashboard_drawer.dart';

class HomeScreen extends StatefulWidget {
  final ValueChanged<int> onNavigate;

  const HomeScreen({super.key, required this.onNavigate});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  String _selectedPeriod = 'Today';

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
      if (mounted) {
        context.read<NotificationsProvider>().fetchUnreadCount();
      }
    } catch (_) {}
  }

  void _showAddProductDialog(CatalogProvider catalog) {
    final nameCtrl = TextEditingController();
    final skuCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final stockCtrl = TextEditingController(text: '10');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Quick Add Product', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: nameCtrl,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Product Name *', hintText: 'e.g. Back Cover 15 Pro'),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: skuCtrl,
                    decoration: const InputDecoration(labelText: 'SKU / Code', hintText: 'e.g. BC-15P'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: priceCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Price (₹) *', prefixText: '₹ '),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: stockCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Initial Stock', hintText: '10'),
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: 'Save Product',
              onPressed: () async {
                final name = nameCtrl.text.trim();
                final price = double.tryParse(priceCtrl.text.trim()) ?? 0.0;
                final sku = skuCtrl.text.trim().isNotEmpty ? skuCtrl.text.trim() : 'PRD-${DateTime.now().millisecondsSinceEpoch % 10000}';
                final stock = int.tryParse(stockCtrl.text.trim()) ?? 0;

                if (name.isEmpty || price <= 0) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please enter name and valid price')),
                  );
                  return;
                }

                Navigator.pop(ctx);
                await catalog.addProduct(code: sku, desc: name, purchase: price, stock: stock);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('$name added successfully!')),
                  );
                }
              },
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
    final notifs = context.watch<NotificationsProvider>();

    final canViewOutstanding = visibility.isBusinessInfoVisible('customer_outstanding', auth);
    final shopName = auth.shopName.isNotEmpty ? auth.shopName : 'NSYU Main Store';

    // Real Computations from Supabase APIs
    final customersList = customers.customers.where((c) => !c.isSupplier).toList();
    final suppliersList = customers.customers.where((c) => c.isSupplier).toList();

    final totalReceivable = customersList.fold<double>(
      0.0,
      (sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0.0),
    );
    final totalPayable = suppliersList.fold<double>(
      0.0,
      (sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0.0),
    );

    // Compute due today from bills
    final now = DateTime.now();
    final dueTodayBills = bills.bills.where((b) {
      if (b.due <= 0) return false;
      return b.date.year == now.year && b.date.month == now.month && b.date.day == now.day;
    }).toList();
    final dueTodayTotal = dueTodayBills.fold<double>(0.0, (sum, b) => sum + b.due);

    // Recent payments from bills
    final recentPayments = bills.paymentReceipts.take(4).toList();

    final isLoading = !bills.loaded || !customers.loaded;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.bg,
      drawer: DashboardDrawer(auth: auth),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.blue600,
          onRefresh: () async {
            await Future.wait([
              bills.syncFromSupabase(),
              customers.syncFromSupabase(),
              notifs.fetchUnreadCount(),
            ]);
          },
          child: ListView(
            padding: EdgeInsets.zero,
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              // ── 1. Navy Gradient Header matching Specification ──
              Container(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.navy900, AppColors.navy700],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(24)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Left: Hamburger Menu & Business Title
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.menu_rounded, size: 24, color: Colors.white),
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
                                  style: TextStyle(
                                    fontSize: 16.5,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                    letterSpacing: -0.2,
                                  ),
                                ),
                                Row(
                                  children: [
                                    Text(
                                      shopName,
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.white.withValues(alpha: 0.8),
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    const SizedBox(width: 3),
                                    Icon(Icons.check_circle, size: 12, color: Colors.white.withValues(alpha: 0.85)),
                                  ],
                                ),
                              ],
                            ),
                          ],
                        ),

                        // Right: Period Selector, Notification Bell & Profile Avatar
                        Row(
                          children: [
                            // Date Selector Pill
                            PopupMenuButton<String>(
                              initialValue: _selectedPeriod,
                              onSelected: (val) => setState(() => _selectedPeriod = val),
                              itemBuilder: (ctx) => const [
                                PopupMenuItem(value: 'Today', child: Text('Today')),
                                PopupMenuItem(value: 'This Week', child: Text('This Week')),
                                PopupMenuItem(value: 'This Month', child: Text('This Month')),
                                PopupMenuItem(value: 'All Time', child: Text('All Time')),
                              ],
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.calendar_today_outlined, size: 11, color: Colors.white),
                                    const SizedBox(width: 5),
                                    Text(
                                      _selectedPeriod,
                                      style: const TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.white,
                                      ),
                                    ),
                                    const Icon(Icons.keyboard_arrow_down_rounded, size: 13, color: Colors.white),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),

                            // Notification Bell with Badge
                            InkWell(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                                ).then((_) => notifs.fetchUnreadCount());
                              },
                              borderRadius: BorderRadius.circular(20),
                              child: Stack(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(7),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.15),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.notifications_outlined, size: 20, color: Colors.white),
                                  ),
                                  if (notifs.unreadCount > 0)
                                    Positioned(
                                      top: 2,
                                      right: 2,
                                      child: Container(
                                        width: 8,
                                        height: 8,
                                        decoration: const BoxDecoration(
                                          color: AppColors.danger,
                                          shape: BoxShape.circle,
                                        ),
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
                                  MaterialPageRoute(builder: (_) => ProfileScreen(onNavigate: widget.onNavigate)),
                                );
                              },
                              child: Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.25),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: Colors.white, width: 1.2),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  auth.userName.isNotEmpty ? auth.userName[0].toUpperCase() : 'N',
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── 2. Hero Card: Total Receivable with You Get / You Give split ──
                    if (isLoading)
                      const SkeletonLoader(width: double.infinity, height: 160, radius: 16)
                    else
                      AppCard(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Total Receivable',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                StatusChip(
                                  label: '${customersList.length} Accounts',
                                  variant: StatusChipVariant.info,
                                  fontSize: 11,
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            canViewOutstanding
                                ? AmountText(
                                    amount: totalReceivable,
                                    fontSize: 28,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.navy900,
                                  )
                                : const Text(
                                    '••••••',
                                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.navy900),
                                  ),
                            const SizedBox(height: 14),
                            const Divider(height: 1, color: AppColors.border),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                // You Get (Receivable)
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Row(
                                        children: [
                                          Icon(Icons.arrow_downward_rounded, size: 14, color: AppColors.success),
                                          SizedBox(width: 4),
                                          Text(
                                            'You will get',
                                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textSecondary),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      canViewOutstanding
                                          ? AmountText(
                                              amount: totalReceivable,
                                              fontSize: 15,
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.success,
                                            )
                                          : const Text('•••'),
                                    ],
                                  ),
                                ),
                                Container(width: 1, height: 32, color: AppColors.border),
                                const SizedBox(width: 14),
                                // You Give (Payable to suppliers)
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Row(
                                        children: [
                                          Icon(Icons.arrow_upward_rounded, size: 14, color: AppColors.warning),
                                          SizedBox(width: 4),
                                          Text(
                                            'You will give',
                                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.textSecondary),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      canViewOutstanding
                                          ? AmountText(
                                              amount: totalPayable,
                                              fontSize: 15,
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.warning,
                                            )
                                          : const Text('•••'),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 14),

                    // ── 3. Due-Today Strip ──
                    if (dueTodayBills.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.warningBg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFFDE68A)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.alarm_on_rounded, size: 20, color: AppColors.warning),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${dueTodayBills.length} payment(s) due today',
                                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF92400E)),
                                  ),
                                  Text(
                                    'Total due: ₹${NumberFormat('#,##0').format(dueTodayTotal)}',
                                    style: const TextStyle(fontSize: 11.5, color: Color(0xFFB45309)),
                                  ),
                                ],
                              ),
                            ),
                            TextButton(
                              onPressed: () => widget.onNavigate(0), // Ledger tab
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                visualDensity: VisualDensity.compact,
                              ),
                              child: const Text('View', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF92400E))),
                            ),
                          ],
                        ),
                      ),
                    if (dueTodayBills.isNotEmpty) const SizedBox(height: 16),

                    // ── 4. Quick Action Buttons ──
                    const SectionHeader(title: 'Quick Actions'),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        _buildQuickActionBtn(
                          icon: Icons.receipt_long_rounded,
                          label: 'New Bill',
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const BillScreen())),
                        ),
                        const SizedBox(width: 10),
                        _buildQuickActionBtn(
                          icon: Icons.payment_rounded,
                          label: 'Add Payment',
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CollectPaymentScreen())),
                        ),
                        const SizedBox(width: 10),
                        _buildQuickActionBtn(
                          icon: Icons.person_add_alt_1_rounded,
                          label: 'Add Customer',
                          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerPickerScreen())),
                        ),
                        const SizedBox(width: 10),
                        _buildQuickActionBtn(
                          icon: Icons.add_box_outlined,
                          label: 'Add Product',
                          onTap: () => _showAddProductDialog(catalog),
                        ),
                      ],
                    ),
                    const SizedBox(height: 22),

                    // ── 5. Recent Invoices ──
                    SectionHeader(
                      title: 'Recent Bills',
                      count: bills.bills.length,
                      actionLabel: 'View All',
                      onAction: () => widget.onNavigate(1),
                    ),
                    const SizedBox(height: 10),
                    if (isLoading)
                      SkeletonLoader.list(count: 3)
                    else if (bills.recentBills.isEmpty)
                      const AppCard(
                        padding: EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                        child: EmptyState(
                          icon: Icons.receipt_long_outlined,
                          title: 'No Bills Created Yet',
                          subtitle: 'Create your first invoice in seconds to start tracking sales.',
                        ),
                      )
                    else
                      ...bills.recentBills.take(4).map((b) => _buildRecentBillTile(b)),

                    const SizedBox(height: 22),

                    // ── 6. Recent Payments ──
                    SectionHeader(
                      title: 'Recent Payments',
                      count: bills.paymentReceipts.length,
                      actionLabel: 'View All',
                      onAction: () => widget.onNavigate(0),
                    ),
                    const SizedBox(height: 10),
                    if (isLoading)
                      SkeletonLoader.list(count: 2)
                    else if (recentPayments.isEmpty)
                      const AppCard(
                        padding: EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                        child: EmptyState(
                          icon: Icons.payments_outlined,
                          title: 'No Payments Recorded',
                          subtitle: 'Collected payments and receipts will appear here.',
                        ),
                      )
                    else
                      ...recentPayments.map((p) => _buildRecentPaymentTile(p)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickActionBtn({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A0B1F4B),
                blurRadius: 10,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.blue50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.blue100),
                ),
                child: Center(
                  child: Icon(icon, size: 21, color: AppColors.blue600),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRecentBillTile(dynamic b) {
    final dateFormat = DateFormat('dd MMM');
    final isPaid = b.due <= 0;
    final isPartial = b.due > 0 && b.due < b.total;

    StatusChipVariant variant;
    String statusText;
    if (isPaid) {
      variant = StatusChipVariant.success;
      statusText = 'PAID';
    } else if (isPartial) {
      variant = StatusChipVariant.warning;
      statusText = 'PARTIAL';
    } else {
      variant = StatusChipVariant.danger;
      statusText = 'UNPAID';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        padding: const EdgeInsets.all(12),
        onTap: () => widget.onNavigate(1),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.blue50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.blue100),
              ),
              child: const Icon(Icons.description_outlined, size: 20, color: AppColors.blue600),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    b.billNumber,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${b.customerName.isNotEmpty ? b.customerName : "Walk-in"} • ${dateFormat.format(b.date)}',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                AmountText(amount: b.total, fontSize: 14.5, fontWeight: FontWeight.w800),
                const SizedBox(height: 3),
                StatusChip(label: statusText, variant: variant, fontSize: 10),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentPaymentTile(SavedPayment p) {
    final dateFormat = DateFormat('dd MMM');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        padding: const EdgeInsets.all(12),
        onTap: () => widget.onNavigate(0),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.successBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              child: const Icon(Icons.arrow_downward_rounded, size: 20, color: AppColors.success),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    p.customerName.isNotEmpty ? p.customerName : 'Customer',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.textPrimary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${p.method.label} • ${dateFormat.format(p.date)}',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            AmountText(
              amount: p.amount,
              fontSize: 14.5,
              fontWeight: FontWeight.w800,
              color: AppColors.success,
              prefix: '+ ',
            ),
          ],
        ),
      ),
    );
  }
}
