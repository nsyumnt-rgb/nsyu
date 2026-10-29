import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/product.dart';
import '../navigation/app_navigation.dart';
import '../providers/catalog_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/animated_feedback_dialog.dart';
import '../widgets/app_bottom_nav.dart';
import '../widgets/skeleton_loader.dart';
import '../utils/category_icon_helper.dart';
import 'bill_screen.dart';
import 'order_cart_screen.dart';

class CatalogScreen extends StatefulWidget {
  final ValueChanged<int>? onNavigate;

  const CatalogScreen({super.key, this.onNavigate});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final searchCtrl = TextEditingController();
  final FocusNode _searchFocus = FocusNode();
  String _activePill = 'All'; // All, Category, Low Stock, Brand
  String? _selectedBrand;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CatalogProvider>().loadProducts();
    });
  }

  @override
  void dispose() {
    searchCtrl.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _showBarcodeScanDialog(BuildContext context, CatalogProvider provider) {
    final codeCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.qr_code_scanner, color: Color(0xFF1D4ED8)),
            SizedBox(width: 8),
            Text('Scan / Enter Barcode'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Enter the product SKU, barcode or code to quickly locate or inspect product details.',
              style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: codeCtrl,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Product SKU / Barcode',
                hintText: 'e.g. PCM500',
                border: OutlineInputBorder(),
              ),
              onSubmitted: (val) {
                Navigator.pop(ctx);
                _handleScannedCode(val.trim(), provider);
              },
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _handleScannedCode(codeCtrl.text.trim(), provider);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1D4ED8),
              foregroundColor: Colors.white,
            ),
            child: const Text('Search / Add'),
          ),
        ],
      ),
    );
  }

  void _handleScannedCode(String code, CatalogProvider provider) {
    if (code.isEmpty) return;
    searchCtrl.text = code;
    provider.setSearch(code);
    final match = provider.products.cast<Product?>().firstWhere(
          (p) => p != null && (p.code.toLowerCase() == code.toLowerCase() || (p.barcode != null && p.barcode!.toLowerCase() == code.toLowerCase())),
          orElse: () => null,
        );
    if (match != null) {
      AppNavigation.openProductDetails(context, product: match);
    }
  }

  void _showAddProductDialog(BuildContext context, CatalogProvider catalog) {
    final skuCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    final catCtrl = TextEditingController(text: 'General');
    final buyCtrl = TextEditingController();
    final marginCtrl = TextEditingController();
    final stockCtrl = TextEditingController(text: '50');

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
            child: const Text('Save Product'),
          ),
        ],
      ),
      ),
    );
  }

  void _openFilterSheet(BuildContext context, CatalogProvider provider) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Filter Products', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              const Text('Filter by Category', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ChoiceChip(
                    label: const Text('All Categories'),
                    selected: provider.categoryFilter == null,
                    onSelected: (val) {
                      provider.setCategory(null);
                      setSheetState(() {});
                    },
                  ),
                  ...provider.categories.map((c) => ChoiceChip(
                        label: Text(c),
                        selected: provider.categoryFilter == c,
                        onSelected: (val) {
                          provider.setCategory(val ? c : null);
                          setSheetState(() {});
                        },
                      )),
                ],
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1D4ED8), foregroundColor: Colors.white),
                  child: const Text('Apply Filter'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CatalogProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 12,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else if (widget.onNavigate != null) {
              widget.onNavigate!(0);
            }
          },
        ),
        title: const Text(
          'Products',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune_rounded, color: Color(0xFF0F172A), size: 22),
            tooltip: 'Filter',
            onPressed: () => _openFilterSheet(context, provider),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: InkWell(
              onTap: () => _showAddProductDialog(context, provider),
              borderRadius: BorderRadius.circular(18),
              child: Container(
                width: 34,
                height: 34,
                decoration: const BoxDecoration(
                  color: Color(0xFF1D4ED8),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 20),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: provider.loadProducts,
        child: _buildBody(context, provider),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _activeWorkflowBar(context, provider),
          if (widget.onNavigate != null)
            AppBottomNav(currentIndex: 1, onTap: widget.onNavigate!),
        ],
      ),
    );
  }

  Widget _activeWorkflowBar(BuildContext context, CatalogProvider provider) {
    final hasBillItems = provider.billCount > 0;
    final hasOrderItems = provider.orderCount > 0;

    if (!hasBillItems && !hasOrderItems) {
      return const SizedBox.shrink();
    }

    if (hasBillItems) {
      return Material(
        color: const Color(0xFF1D4ED8),
        child: InkWell(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const BillScreen()),
            );
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: [
                const Icon(Icons.receipt_long, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Active Bill: ${provider.billCount} items · ₹${provider.billTotal.toStringAsFixed(0)}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5),
                  ),
                ),
                const Text(
                  'View Bill',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.arrow_forward_ios, size: 12, color: Colors.white),
              ],
            ),
          ),
        ),
      );
    } else {
      return Material(
        color: const Color(0xFF0D9488),
        child: InkWell(
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const OrderCartScreen()),
            );
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: [
                const Icon(Icons.shopping_bag_outlined, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Active Order: ${provider.orderCount} items · ₹${provider.orderTotal.toStringAsFixed(0)}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5),
                  ),
                ),
                const Text(
                  'View Order',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.arrow_forward_ios, size: 12, color: Colors.white),
              ],
            ),
          ),
        ),
      );
    }
  }

  Widget _buildBody(BuildContext context, CatalogProvider provider) {
    if (provider.status == LoadStatus.loading || provider.status == LoadStatus.idle) {
      return const ProductGridSkeleton();
    }

    if (provider.status == LoadStatus.error) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 60),
          const Icon(Icons.cloud_off, size: 48, color: AppColors.muted),
          const SizedBox(height: 16),
          Text(
            provider.errorMessage,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 16),
          Center(
            child: ElevatedButton(
              onPressed: provider.loadProducts,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                foregroundColor: Colors.white,
              ),
              child: const Text('Retry'),
            ),
          ),
        ],
      );
    }

    var products = provider.filteredProducts;

    // Apply local pill filtering
    if (_activePill == 'Low Stock') {
      products = products.where((p) => p.stock <= 20).toList();
    } else if (_activePill == 'Brand' && _selectedBrand != null) {
      products = products.where((p) => p.brand?.toLowerCase() == _selectedBrand!.toLowerCase()).toList();
    }

    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        // Search bar & Filter Pills matching Image 3
        _controls(context, provider),

        if (products.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 60, horizontal: 24),
            child: Column(
              children: [
                Icon(Icons.search_off_rounded, size: 40, color: Color(0xFFCBD5E1)),
                SizedBox(height: 12),
                Text('No products found', style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                SizedBox(height: 4),
                Text(
                  'Try adjusting your search or filter pills',
                  style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          )
        else
          // List of Product Cards matching Image 3
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: products.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) => _buildProductRow(context, products[i], provider),
            ),
          ),
      ],
    );
  }

  Widget _controls(BuildContext context, CatalogProvider provider) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Search Bar matching Image 3
          Container(
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: TextField(
              controller: searchCtrl,
              focusNode: _searchFocus,
              onChanged: provider.setSearch,
              style: const TextStyle(fontSize: 13.5),
              decoration: InputDecoration(
                hintText: 'Search products, code, barcode...',
                hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
                prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.document_scanner_outlined, size: 20, color: Color(0xFF64748B)),
                  tooltip: 'Scan Barcode',
                  onPressed: () => _showBarcodeScanDialog(context, provider),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: InputBorder.none,
                isDense: true,
              ),
            ),
          ),
          const SizedBox(height: 10),

          // Horizontal Filter Pills matching Image 3: All, Category, Low Stock, Brand
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _filterPill('All', _activePill == 'All', () {
                  setState(() {
                    _activePill = 'All';
                    provider.setCategory(null);
                  });
                }),
                const SizedBox(width: 8),
                _filterPill(
                  provider.categoryFilter != null ? provider.categoryFilter! : 'Category',
                  _activePill == 'Category' || provider.categoryFilter != null,
                  () {
                    setState(() => _activePill = 'Category');
                    _openFilterSheet(context, provider);
                  },
                ),
                const SizedBox(width: 8),
                _filterPill('Low Stock', _activePill == 'Low Stock', () {
                  setState(() => _activePill = _activePill == 'Low Stock' ? 'All' : 'Low Stock');
                }),
                const SizedBox(width: 8),
                _filterPill(
                  _selectedBrand != null ? _selectedBrand! : 'Brand',
                  _activePill == 'Brand' || _selectedBrand != null,
                  () {
                    setState(() => _activePill = 'Brand');
                    _showBrandPicker(context, provider);
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterPill(String label, bool isSelected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFFE2E8F0),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }

  void _showBrandPicker(BuildContext context, CatalogProvider provider) {
    final brands = provider.products
        .map((p) => p.brand?.trim())
        .where((b) => b != null && b.isNotEmpty)
        .cast<String>()
        .toSet()
        .toList();

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Select Brand', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            if (brands.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: Text('No specific brands found in catalog.', style: TextStyle(color: Color(0xFF64748B))),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ChoiceChip(
                    label: const Text('All Brands'),
                    selected: _selectedBrand == null,
                    onSelected: (val) {
                      setState(() => _selectedBrand = null);
                      Navigator.pop(ctx);
                    },
                  ),
                  ...brands.map((b) => ChoiceChip(
                        label: Text(b),
                        selected: _selectedBrand == b,
                        onSelected: (val) {
                          setState(() => _selectedBrand = val ? b : null);
                          Navigator.pop(ctx);
                        },
                      )),
                ],
              ),
          ],
        ),
      ),
    );
  }

  // Product Card matching Image 3
  Widget _buildProductRow(BuildContext context, Product product, CatalogProvider provider) {
    final isLowStock = product.stock <= 15;
    final prdCode = 'PRD-${product.sno.toString().padLeft(4, "0")} | SKU: ${product.code}';

    return Container(
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
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => AppNavigation.openProductDetails(context, product: product),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Product Thumbnail box on left
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Center(
                    child: Icon(
                      CategoryIconHelper.getIconForCategory(product.category),
                      size: 28,
                      color: const Color(0xFF1D4ED8),
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Middle: Title, Code, Category, Price
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.desc,
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        prdCode,
                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          product.category,
                          style: const TextStyle(fontSize: 11, color: Color(0xFF475569), fontWeight: FontWeight.w500),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '₹ ${product.sellingPrice.toStringAsFixed(2)}',
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                    ],
                  ),
                ),

                // Right: 3-dots and Stock Status Pill
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.more_vert, size: 20, color: Color(0xFF94A3B8)),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onSelected: (val) {
                        if (val == 'details') {
                          AppNavigation.openProductDetails(context, product: product);
                        } else if (val == 'add_bill') {
                          provider.addToBill(product);
                          final count = provider.billItemFor(product.code)?.qty ?? 1;
                          AppToast.showAddedToBill(
                            context,
                            productName: product.desc,
                            quantity: count,
                            onViewBill: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const BillScreen()),
                              );
                            },
                          );
                        } else if (val == 'add_order') {
                          provider.addToOrder(product);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Added ${product.desc} to Order'), duration: const Duration(seconds: 1)),
                          );
                        }
                      },
                      itemBuilder: (ctx) => [
                        const PopupMenuItem(
                          value: 'details',
                          child: Row(
                            children: [
                              Icon(Icons.info_outline, size: 18, color: Color(0xFF1D4ED8)),
                              SizedBox(width: 10),
                              Text('View Details'),
                            ],
                          ),
                        ),
                        const PopupMenuItem(
                          value: 'add_bill',
                          child: Row(
                            children: [
                              Icon(Icons.receipt_long_outlined, size: 18, color: Color(0xFF16A34A)),
                              SizedBox(width: 10),
                              Text('Add to Bill'),
                            ],
                          ),
                        ),
                        const PopupMenuItem(
                          value: 'add_order',
                          child: Row(
                            children: [
                              Icon(Icons.shopping_bag_outlined, size: 18, color: Color(0xFF0D9488)),
                              SizedBox(width: 10),
                              Text('Add to Order'),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: isLowStock ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            isLowStock ? 'Low Stock' : 'In Stock',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: isLowStock ? const Color(0xFFD97706) : const Color(0xFF16A34A),
                            ),
                          ),
                          Text(
                            'Qty: ${product.stock}',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: isLowStock ? const Color(0xFFD97706) : const Color(0xFF16A34A),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
