import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/visibility_settings.dart';
import '../providers/auth_provider.dart';
import '../providers/visibility_provider.dart';

class VisibilitySettingsScreen extends StatefulWidget {
  const VisibilitySettingsScreen({super.key});

  @override
  State<VisibilitySettingsScreen> createState() => _VisibilitySettingsScreenState();
}

class _VisibilitySettingsScreenState extends State<VisibilitySettingsScreen> {
  late VisibilitySettings _current;
  bool _hasChanges = false;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final provider = context.read<VisibilityProvider>();
    _current = provider.settings;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _update(VisibilitySettings Function(VisibilitySettings) fn) {
    setState(() {
      _current = fn(_current);
      _hasChanges = true;
    });
  }

  Future<void> _save() async {
    final provider = context.read<VisibilityProvider>();
    final success = await provider.save(_current);

    if (!mounted) return;
    if (success) {
      setState(() => _hasChanges = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.check_circle, color: Colors.white),
              SizedBox(width: 8),
              Text('Visibility settings saved successfully.'),
            ],
          ),
          backgroundColor: Color(0xFF16A34A),
          duration: Duration(seconds: 2),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error ?? 'Failed to save settings.'),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
    }
  }

  Future<void> _confirmReset() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.restore, color: Color(0xFF1565C0)),
            SizedBox(width: 8),
            Text('Reset to Default?'),
          ],
        ),
        content: const Text(
          'This will restore all business information, modules, product fields, and bottom navigation toggles to standard defaults.\n\nYour existing business records and database data will not be affected.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF1565C0)),
            child: const Text('Reset to Default'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      final provider = context.read<VisibilityProvider>();
      final ok = await provider.resetToDefaults();
      if (!mounted) return;
      if (ok) {
        setState(() {
          _current = provider.settings;
          _hasChanges = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Settings restored to standard defaults.'),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
      }
    }
  }

  Future<bool> _onWillPop() async {
    if (!_hasChanges) return true;
    final discard = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Discard Unsaved Changes?'),
        content: const Text('You have unsaved visibility changes. Leaving will discard them.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Editing'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    return discard ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final visibility = context.watch<VisibilityProvider>();
    final canEdit = auth.isOwner;

    return PopScope(
      canPop: !_hasChanges,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldPop = await _onWillPop();
        if (shouldPop && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF4F6F9),
        appBar: AppBar(
          title: const Text(
            'Visibility & Display Settings',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
          ),
          backgroundColor: Colors.white,
          foregroundColor: const Color(0xFF0F172A),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
            onPressed: () async {
              if (await _onWillPop() && context.mounted) {
                Navigator.of(context).pop();
              }
            },
          ),
          actions: [
            if (_hasChanges)
              TextButton(
                onPressed: _save,
                child: const Text('Save', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF1D4ED8))),
              ),
          ],
        ),
        body: Column(
          children: [
            if (!canEdit)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                color: const Color(0xFFFEF3C7),
                child: const Row(
                  children: [
                    Icon(Icons.lock_outline, color: Color(0xFFB45309), size: 18),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Read-only: Visibility settings are configured by the business owner.',
                        style: TextStyle(color: Color(0xFF92400E), fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),

            // Search Filter Bar
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              color: Colors.white,
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search visibility settings...',
                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
                  prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B), size: 20),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: const Color(0xFFF1F5F9),
                  contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                ),
                onChanged: (val) => setState(() => _searchQuery = val.trim().toLowerCase()),
              ),
            ),

            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  _buildSectionCard(
                    title: 'Business Information',
                    subtitle: 'Control sensitive prices, margins, stock and profit displays',
                    icon: Icons.business_center_outlined,
                    children: [
                      _buildSwitchTile(
                        icon: Icons.payments_outlined,
                        title: 'Purchase Price',
                        subtitle: 'Supplier purchase rate on products & transactions',
                        value: _current.showPurchasePrice,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(showPurchasePrice: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.trending_up,
                        title: 'Margin Amount & Percentage',
                        subtitle: 'Calculated margin indicators and profit spreads',
                        value: _current.showMargin,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(showMargin: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.price_change_outlined,
                        title: 'Product Cost Price',
                        subtitle: 'Internal inventory valuation cost price',
                        value: _current.showCostPrice,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(showCostPrice: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.inventory_2_outlined,
                        title: 'Stock Quantity',
                        subtitle: 'In-stock unit counts and availability badges',
                        value: _current.showStockQuantity,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(showStockQuantity: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.account_balance_wallet_outlined,
                        title: 'Customer Outstanding',
                        subtitle: 'Customer ledger debit balance & outstanding summaries',
                        value: _current.showCustomerOutstanding,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(showCustomerOutstanding: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.insights_outlined,
                        title: 'Profit & Profit Reports',
                        subtitle: 'Gross profit figures, profit charts & margin reports',
                        value: _current.showProfit,
                        enabled: canEdit,
                        isDefaultHidden: true,
                        onChanged: (val) => _update((s) => s.copyWith(showProfit: val)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  _buildSectionCard(
                    title: 'App Modules',
                    subtitle: 'Show or hide operational business modules across the app',
                    icon: Icons.dashboard_customize_outlined,
                    children: [
                      _buildSwitchTile(
                        icon: Icons.inventory_outlined,
                        title: 'Inventory',
                        subtitle: 'Stock tracking, movements and transfer screens',
                        value: _current.moduleInventory,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleInventory: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.local_shipping_outlined,
                        title: 'Purchase',
                        subtitle: 'Purchase orders, supplier bills and stock inward',
                        value: _current.modulePurchase,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(modulePurchase: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.shopping_bag_outlined,
                        title: 'Sales',
                        subtitle: 'Sales orders, customer invoices and returns',
                        value: _current.moduleSales,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleSales: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.point_of_sale_outlined,
                        title: 'Billing',
                        subtitle: 'Quick point-of-sale checkout and bill generation',
                        value: _current.moduleBilling,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleBilling: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.people_outline,
                        title: 'Customers',
                        subtitle: 'Customer contacts, profiles and purchase histories',
                        value: _current.moduleCustomers,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleCustomers: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.business_outlined,
                        title: 'Suppliers',
                        subtitle: 'Wholesale vendors and supplier balance summaries',
                        value: _current.moduleSuppliers,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleSuppliers: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.receipt_long_outlined,
                        title: 'Payments',
                        subtitle: 'Inward & outward payment receipts and vouchers',
                        value: _current.modulePayments,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(modulePayments: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.menu_book_outlined,
                        title: 'Customer Ledger',
                        subtitle: 'Running financial debit/credit statements per customer',
                        value: _current.moduleCustomerLedger,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleCustomerLedger: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.calendar_month_outlined,
                        title: 'EMI / Installments',
                        subtitle: 'Financed payment plans and installment tracking',
                        value: _current.moduleEmi,
                        enabled: canEdit,
                        isDefaultHidden: true,
                        onChanged: (val) => _update((s) => s.copyWith(moduleEmi: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.badge_outlined,
                        title: 'Employees',
                        subtitle: 'Staff management, roles and shop assignments',
                        value: _current.moduleEmployees,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleEmployees: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.how_to_reg_outlined,
                        title: 'Attendance',
                        subtitle: 'Daily check-in / check-out and attendance register',
                        value: _current.moduleAttendance,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleAttendance: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.account_balance_outlined,
                        title: 'Salary / Payroll',
                        subtitle: 'Salary runs, advance deductions and payroll records',
                        value: _current.modulePayroll,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(modulePayroll: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.bar_chart_outlined,
                        title: 'Reports',
                        subtitle: 'Business analytics, sales reports and exports',
                        value: _current.moduleReports,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleReports: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.store_mall_directory_outlined,
                        title: 'Shops',
                        subtitle: 'Multi-shop branch switching and shop profiles',
                        value: _current.moduleShops,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleShops: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.admin_panel_settings_outlined,
                        title: 'Roles & Permissions',
                        subtitle: 'Granular access control and permission tiers',
                        value: _current.moduleRoles,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(moduleRoles: val)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  _buildSectionCard(
                    title: 'Product Display',
                    subtitle: 'Configure product attributes shown in catalog and billing',
                    icon: Icons.style_outlined,
                    children: [
                      _buildSwitchTile(
                        icon: Icons.tag,
                        title: 'Product SKU / Code',
                        subtitle: 'Internal reference code and SKU label',
                        value: _current.productSku,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(productSku: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.qr_code_scanner,
                        title: 'Barcode',
                        subtitle: 'Barcode number and scanning identifier',
                        value: _current.productBarcode,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(productBarcode: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.category_outlined,
                        title: 'Category Icon',
                        subtitle: 'Visual category badge & icon representation',
                        value: _current.productCategoryIcon,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(productCategoryIcon: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.branding_watermark_outlined,
                        title: 'Brand',
                        subtitle: 'Manufacturer or brand name on product card',
                        value: _current.productBrand,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(productBrand: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.description_outlined,
                        title: 'Product Description',
                        subtitle: 'Detailed description text in product list',
                        value: _current.productDescription,
                        enabled: canEdit,
                        isDefaultHidden: true,
                        onChanged: (val) => _update((s) => s.copyWith(productDescription: val)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  _buildSectionCard(
                    title: 'Bottom Navigation',
                    subtitle: 'Choose which destinations appear in the primary bottom bar',
                    icon: Icons.navigation_outlined,
                    children: [
                      _buildSwitchTile(
                        icon: Icons.home_outlined,
                        title: 'Home',
                        subtitle: 'Main dashboard with KPI cards and shortcuts',
                        value: _current.navHome,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(navHome: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.receipt_long_outlined,
                        title: 'Bills',
                        subtitle: 'Invoices list and billing history',
                        value: _current.navBills,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(navBills: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.menu_book_outlined,
                        title: 'Ledger',
                        subtitle: 'Customer ledger records and statements',
                        value: _current.navLedger,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(navLedger: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.inventory_2_outlined,
                        title: 'Catalog',
                        subtitle: 'Product catalog, pricing and stock status',
                        value: _current.navCatalog,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(navCatalog: val)),
                      ),
                      _buildSwitchTile(
                        icon: Icons.article_outlined,
                        title: 'Orders',
                        subtitle: 'Sales orders and processing stages',
                        value: _current.navOrders,
                        enabled: canEdit,
                        onChanged: (val) => _update((s) => s.copyWith(navOrders: val)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: canEdit
            ? Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 10,
                      offset: const Offset(0, -3),
                    ),
                  ],
                ),
                child: SafeArea(
                  top: false,
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: visibility.saving ? null : _confirmReset,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF475569),
                            side: const BorderSide(color: Color(0xFFCBD5E1)),
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('Reset to Default', style: TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: (visibility.saving || !_hasChanges) ? null : _save,
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF1565C0),
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: visibility.saving
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            : null,
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.015),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: children.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 62, color: Color(0xFFF1F5F9)),
            itemBuilder: (_, i) => children[i],
          ),
        ),
      ],
    );
  }

  Widget _buildSwitchTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required bool enabled,
    required ValueChanged<bool> onChanged,
    bool isDefaultHidden = false,
  }) {
    if (_searchQuery.isNotEmpty) {
      final matches = title.toLowerCase().contains(_searchQuery) ||
          subtitle.toLowerCase().contains(_searchQuery);
      if (!matches) return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              icon,
              size: 20,
              color: const Color(0xFF475569),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0F172A),
              ),
            ),
          ),
          Switch(
            value: value,
            onChanged: enabled ? onChanged : null,
            activeThumbColor: Colors.white,
            activeTrackColor: const Color(0xFF1D4ED8),
            inactiveThumbColor: Colors.white,
            inactiveTrackColor: const Color(0xFFCBD5E1),
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ],
      ),
    );
  }
}