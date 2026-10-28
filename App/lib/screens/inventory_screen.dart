import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/product.dart';
import '../providers/auth_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/settings_provider.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';
import '../utils/category_icon_helper.dart';
import '../widgets/skeleton_loader.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final _searchCtrl = TextEditingController();
  bool _showSearch = false;
  String _selectedCategory = 'ALL';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<CatalogProvider>();
      if (provider.totalProductCount == 0) provider.loadProducts();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _showInventorySettingsDialog() {
    final catalog = context.read<CatalogProvider>();
    final settingsProvider = context.read<SettingsProvider>();
    final auth = context.read<AuthProvider>();

    final marginCtrl = TextEditingController(
      text: settingsProvider.settings.marginPrice.toStringAsFixed(2),
    );
    bool localShowPrice = catalog.showPrice;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.tune_rounded, color: Color(0xFF1565C0)),
              SizedBox(width: 8),
              Text('Inventory Settings'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (auth.canViewPurchasePrice) ...[
                  SwitchListTile(
                    title: const Text('Show Purchase Price', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: const Text('Display cost price and margin calculations in cards', style: TextStyle(fontSize: 12)),
                    value: localShowPrice,
                    contentPadding: EdgeInsets.zero,
                    onChanged: (val) {
                      setDialogState(() => localShowPrice = val);
                      catalog.toggleShowPrice(val);
                    },
                  ),
                  const Divider(),
                ],
                const SizedBox(height: 8),
                const Text('Default Margin Price (₹)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                TextField(
                  controller: marginCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    prefixText: '₹ ',
                    border: OutlineInputBorder(),
                    hintText: '10.00',
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Default margin price is applied when creating new products or calculating bulk prices.',
                  style: TextStyle(fontSize: 11.5, color: AppColors.muted),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close'),
            ),
            FilledButton(
              onPressed: () async {
                final newMargin = double.tryParse(marginCtrl.text.trim()) ?? 0;
                settingsProvider.settings.marginPrice = newMargin;
                Navigator.pop(ctx);
                showAppSnackBar(context, 'Inventory preferences saved');
              },
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF1565C0)),
              child: const Text('Save Settings'),
            ),
          ],
        ),
      ),
    );
  }

  void _showCategoryIconPicker(String category) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Select Icon for "$category"'),
        content: SizedBox(
          width: double.maxFinite,
          height: 320,
          child: GridView.builder(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.0,
            ),
            itemCount: CategoryIconHelper.availableIcons.length,
            itemBuilder: (ctx, i) {
              final def = CategoryIconHelper.availableIcons[i];
              return InkWell(
                onTap: () async {
                  await CategoryIconHelper.setCategoryIcon(category, def.key);
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  setState(() {});
                  showAppSnackBar(context, 'Category icon updated to ${def.label}');
                },
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(def.icon, color: const Color(0xFF1565C0), size: 28),
                      const SizedBox(height: 4),
                      Text(
                        def.label.split('/').first.trim(),
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w500),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final catalog = context.watch<CatalogProvider>();
    final auth = context.watch<AuthProvider>();
    final canViewPurchase = auth.canViewPurchasePrice && catalog.showPrice;

    final categories = ['ALL', ...catalog.categories];

    final filtered = catalog.products.where((p) {
      final matchesQuery = p.matchesQuery(catalog.searchQuery);
      final matchesCategory = _selectedCategory == 'ALL' || p.category == _selectedCategory;
      return matchesQuery && matchesCategory;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: const Text('Inventory', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(_showSearch ? Icons.close : Icons.search),
            onPressed: () {
              setState(() {
                _showSearch = !_showSearch;
                if (!_showSearch) {
                  _searchCtrl.clear();
                  catalog.setSearch('');
                }
              });
            },
            tooltip: 'Search',
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (val) {
              if (val == 'settings') {
                _showInventorySettingsDialog();
              } else if (val == 'toggle_price') {
                catalog.toggleShowPrice(!catalog.showPrice);
              } else if (val == 'refresh') {
                catalog.loadProducts();
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'settings',
                child: Row(
                  children: [
                    Icon(Icons.settings_outlined, size: 20),
                    SizedBox(width: 10),
                    Text('Inventory Settings'),
                  ],
                ),
              ),
              if (auth.canViewPurchasePrice)
                PopupMenuItem(
                  value: 'toggle_price',
                  child: Row(
                    children: [
                      Icon(catalog.showPrice ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
                      SizedBox(width: 10),
                      Text(catalog.showPrice ? 'Hide Purchase Price' : 'Show Purchase Price'),
                    ],
                  ),
                ),
              const PopupMenuItem(
                value: 'refresh',
                child: Row(
                  children: [
                    Icon(Icons.refresh, size: 20),
                    SizedBox(width: 10),
                    Text('Refresh Catalog'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: catalog.loadProducts,
        child: Column(
          children: [
            if (_showSearch)
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: TextField(
                  controller: _searchCtrl,
                  autofocus: true,
                  onChanged: catalog.setSearch,
                  decoration: InputDecoration(
                    hintText: 'Search by SKU code, description, brand...',
                    prefixIcon: const Icon(Icons.search),
                    filled: true,
                    fillColor: const Color(0xFFF1F5F9),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            // Header Bar matching Image 1: "Showing X of Y products" + Category dropdown chip
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: Colors.white,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Showing ${filtered.length} of ${catalog.totalProductCount} products',
                      style: const TextStyle(fontSize: 13, color: AppColors.muted, fontWeight: FontWeight.w500),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFF93C5FD)),
                      borderRadius: BorderRadius.circular(8),
                      color: const Color(0xFFEFF6FF),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: categories.contains(_selectedCategory) ? _selectedCategory : 'ALL',
                        isDense: true,
                        icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF1D4ED8), size: 20),
                        style: const TextStyle(
                          color: Color(0xFF1D4ED8),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _selectedCategory = val);
                          }
                        },
                        items: categories.map((c) {
                          return DropdownMenuItem<String>(
                            value: c,
                            child: Text(
                              c.length > 25 ? '${c.substring(0, 22)}...' : c,
                              overflow: TextOverflow.ellipsis,
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),
            Expanded(
              child: _buildProductList(filtered, canViewPurchase),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductList(List<Product> products, bool canViewPurchase) {
    final catalog = context.watch<CatalogProvider>();
    if (catalog.status == LoadStatus.loading && products.isEmpty) {
      return const ProductGridSkeleton();
    }

    if (products.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 80),
          Icon(Icons.inventory_2_outlined, size: 54, color: AppColors.muted),
          SizedBox(height: 16),
          Center(
            child: Text('No products found matching criteria.', style: TextStyle(color: AppColors.muted, fontSize: 14)),
          ),
        ],
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: products.length,
      itemBuilder: (context, index) {
        final product = products[index];
        return _EditableProductCard(
          key: ValueKey(product.code),
          product: product,
          canViewPurchase: canViewPurchase,
          onChangeIcon: () => _showCategoryIconPicker(product.category),
        );
      },
    );
  }
}

class _EditableProductCard extends StatefulWidget {
  final Product product;
  final bool canViewPurchase;
  final VoidCallback onChangeIcon;

  const _EditableProductCard({
    super.key,
    required this.product,
    required this.canViewPurchase,
    required this.onChangeIcon,
  });

  @override
  State<_EditableProductCard> createState() => _EditableProductCardState();
}

class _EditableProductCardState extends State<_EditableProductCard> {
  late TextEditingController _codeCtrl;
  late TextEditingController _stockCtrl;
  late TextEditingController _purchaseCtrl;
  late TextEditingController _marginCtrl;
  late TextEditingController _sellingCtrl;

  late String _category;
  String _status = 'Active';
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _initFields();
  }

  @override
  void didUpdateWidget(covariant _EditableProductCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.product != widget.product) {
      _initFields();
    }
  }

  void _initFields() {
    final p = widget.product;
    _codeCtrl = TextEditingController(text: p.code);
    _stockCtrl = TextEditingController(text: '${p.stock}');
    _purchaseCtrl = TextEditingController(text: p.purchase.toStringAsFixed(2));
    _marginCtrl = TextEditingController(text: p.marginAmount.toStringAsFixed(2));
    _sellingCtrl = TextEditingController(text: p.sellingPrice.toStringAsFixed(2));
    _category = p.category.isNotEmpty ? p.category : 'General';
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    _stockCtrl.dispose();
    _purchaseCtrl.dispose();
    _marginCtrl.dispose();
    _sellingCtrl.dispose();
    super.dispose();
  }

  void _onPurchaseOrMarginChanged() {
    final purchase = double.tryParse(_purchaseCtrl.text.trim()) ?? 0;
    final margin = double.tryParse(_marginCtrl.text.trim()) ?? 0;
    final selling = purchase + margin;
    _sellingCtrl.text = selling.toStringAsFixed(2);
    setState(() {});
  }

  void _cancelChanges() {
    _initFields();
    setState(() {});
  }

  Future<void> _saveChanges() async {
    setState(() => _isSaving = true);
    final code = _codeCtrl.text.trim();
    final stock = int.tryParse(_stockCtrl.text.trim()) ?? widget.product.stock;
    final purchase = double.tryParse(_purchaseCtrl.text.trim()) ?? widget.product.purchase;
    final margin = double.tryParse(_marginCtrl.text.trim()) ?? widget.product.marginAmount;
    final selling = purchase + margin;

    try {
      await SupabaseService().updateProductDetails(
        productCode: widget.product.code,
        newCode: code,
        name: widget.product.desc,
        category: _category,
        purchasePrice: purchase,
        sellingPrice: selling,
        stock: stock,
        status: _status,
      );

      if (!mounted) return;
      setState(() => _isSaving = false);

      // Refresh catalog provider immediately
      context.read<CatalogProvider>().loadProducts();
      showAppSnackBar(context, 'Changes saved for ${widget.product.desc}');
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      showAppSnackBar(context, 'Failed to save changes: $e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final purchase = double.tryParse(_purchaseCtrl.text.trim()) ?? p.purchase;
    final margin = double.tryParse(_marginCtrl.text.trim()) ?? p.marginAmount;
    final selling = purchase + margin;
    final marginPercent = selling > 0 ? ((margin / selling) * 100) : 0.0;
    final catIcon = CategoryIconHelper.getIconForCategory(p.category, p.desc, p.code);

    final catalog = context.watch<CatalogProvider>();
    final categories = catalog.categories.isEmpty ? ['General'] : catalog.categories;
    if (!categories.contains(_category)) {
      _category = categories.first;
    }

    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Section matching Image 1: Image + Specs + Category pill + "Change Icon" button
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Thumbnail with blue camera badge
                Stack(
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Center(
                        child: Icon(catIcon, size: 36, color: const Color(0xFF64748B)),
                      ),
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Color(0xFF1976D2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.camera_alt, color: Colors.white, size: 14),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                // Title and Specs
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.desc,
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (p.spec.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          p.spec,
                          style: const TextStyle(fontSize: 12, color: AppColors.muted),
                        ),
                      ],
                      const SizedBox(height: 6),
                      // Category pill button with folder and edit icon
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.folder_open, size: 13, color: Color(0xFF2563EB)),
                            const SizedBox(width: 4),
                            Text(
                              p.category,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.edit, size: 11, color: Color(0xFF2563EB)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                // Change Icon button on top right matching Image 1
                InkWell(
                  onTap: widget.onChangeIcon,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(catIcon, color: const Color(0xFF0F172A), size: 22),
                        const SizedBox(height: 2),
                        const Text(
                          'Change\nIcon',
                          style: TextStyle(fontSize: 9.5, color: Color(0xFF1976D2), fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Form Fields Grid matching Image 1 (2 Columns)
            Row(
              children: [
                Expanded(
                  child: _textField(
                    label: 'Code *',
                    controller: _codeCtrl,
                    suffixIcon: Icons.qr_code_scanner,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _textField(
                    label: 'Stock *',
                    controller: _stockCtrl,
                    isNumeric: true,
                    suffixIcon: Icons.all_inbox_rounded,
                  ),
                ),
              ],
            ),

            if (widget.canViewPurchase) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _textField(
                      label: 'Purchase Price (₹) *',
                      controller: _purchaseCtrl,
                      isNumeric: true,
                      suffixText: '₹',
                      onChanged: (_) => _onPurchaseOrMarginChanged(),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _textField(
                      label: 'Margin (₹) *',
                      controller: _marginCtrl,
                      isNumeric: true,
                      suffixText: '₹',
                      onChanged: (_) => _onPurchaseOrMarginChanged(),
                    ),
                  ),
                ],
              ),
            ],

            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _readOnlyField(
                    label: 'Selling Price (₹)\n(Auto Calculated)',
                    value: selling.toStringAsFixed(2),
                    suffixText: '₹',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _readOnlyField(
                    label: 'Margin (%)\n(Auto Calculated)',
                    value: marginPercent.toStringAsFixed(2),
                    suffixText: '%',
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Category *', style: TextStyle(fontSize: 11.5, color: AppColors.muted, fontWeight: FontWeight.w500)),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: categories.contains(_category) ? _category : categories.first,
                            isExpanded: true,
                            icon: const Icon(Icons.keyboard_arrow_down, size: 18),
                            items: categories.map((c) => DropdownMenuItem(value: c, child: Text(c, style: const TextStyle(fontSize: 12.5), overflow: TextOverflow.ellipsis))).toList(),
                            onChanged: (val) {
                              if (val != null) setState(() => _category = val);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Status', style: TextStyle(fontSize: 11.5, color: AppColors.muted, fontWeight: FontWeight.w500)),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _status,
                            isExpanded: true,
                            icon: const Icon(Icons.keyboard_arrow_down, size: 18),
                            items: const [
                              DropdownMenuItem(
                                value: 'Active',
                                child: Row(
                                  children: [
                                    Icon(Icons.circle, size: 10, color: Color(0xFF16A34A)),
                                    SizedBox(width: 6),
                                    Text('Active', style: TextStyle(fontSize: 12.5)),
                                  ],
                                ),
                              ),
                              DropdownMenuItem(
                                value: 'Inactive',
                                child: Row(
                                  children: [
                                    Icon(Icons.circle, size: 10, color: Color(0xFFDC2626)),
                                    SizedBox(width: 6),
                                    Text('Inactive', style: TextStyle(fontSize: 12.5)),
                                  ],
                                ),
                              ),
                            ],
                            onChanged: (val) {
                              if (val != null) setState(() => _status = val);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Action Buttons matching Image 1: Cancel and Save Changes
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _cancelChanges,
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Cancel'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF2563EB),
                      side: const BorderSide(color: Color(0xFF2563EB)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _isSaving ? null : _saveChanges,
                    icon: _isSaving
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Icon(Icons.save_outlined, size: 18),
                    label: Text(_isSaving ? 'Saving...' : 'Save Changes'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1565C0),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _textField({
    required String label,
    required TextEditingController controller,
    bool isNumeric = false,
    IconData? suffixIcon,
    String? suffixText,
    ValueChanged<String>? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.muted, fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        Container(
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  keyboardType: isNumeric ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  onChanged: onChanged,
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    isDense: true,
                  ),
                ),
              ),
              if (suffixIcon != null)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Icon(suffixIcon, size: 18, color: const Color(0xFF3B82F6)),
                ),
              if (suffixText != null)
                Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: Text(suffixText, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _readOnlyField({
    required String label,
    required String value,
    String? suffixText,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10.5, color: AppColors.muted, height: 1.1)),
        const SizedBox(height: 4),
        Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
              if (suffixText != null)
                Text(suffixText, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
            ],
          ),
        ),
      ],
    );
  }
}
