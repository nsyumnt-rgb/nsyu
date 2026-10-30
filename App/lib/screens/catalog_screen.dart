import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/product.dart';
import '../providers/catalog_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bottom_nav.dart';
import 'edit_product_screen.dart';
import 'order_cart_screen.dart';

/// Product Catalog Screen matching Reference Design:
/// - Forest Green Header (#006837) with Back, Box icon, Product Catalog title, All Products (N), Barcode trigger, + Add Product, Cart icon with badge (3)
/// - Integrated Search & Filter row with in-field barcode trigger
/// - Category Chips: All (125), Mobile Accessories, Chargers, Cables, Stationery, Others
/// - Rich Product Card:
///   - Hero image with In Stock badge & Wishlist Heart icon
///   - Code badge (TC001), Product Name, Short Description/Specs
///   - Meta rows: Category, Brand, Unit, HSN/SAC
///   - Packaging Metrics Strip: STD. P KG. 20 | QTY. 10
///   - 3-Item Pricing Row: Margin 10.00 | SLPrice ₹77.00 | Price (Incl. GST) ₹67.00
///   - Quantity input with clear button & solid green [ 🛒 Add to Cart ] button
///   - Product Description card
///   - Pager Navigation: < 1 of 125 >
/// - Bottom Navigation Bar (Ledger | Bill | Catalog [Active] | More)
class CatalogScreen extends StatefulWidget {
  final ValueChanged<int>? onNavigate;

  const CatalogScreen({super.key, this.onNavigate});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _qtyCtrl = TextEditingController(text: '1');
  final NumberFormat _money = NumberFormat('#,##0.00');

  String _selectedCategory = 'All';
  int _currentIndex = 0;
  bool _isFavorite = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<CatalogProvider>();
      if (provider.products.isEmpty) {
        provider.loadProducts();
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _qtyCtrl.dispose();
    super.dispose();
  }

  void _onCategorySelected(String cat) {
    setState(() {
      _selectedCategory = cat;
      _currentIndex = 0;
    });
  }

  void _goToPrevProduct(int total) {
    if (total <= 1) return;
    setState(() {
      _currentIndex = (_currentIndex - 1 + total) % total;
      _qtyCtrl.text = '1';
    });
  }

  void _goToNextProduct(int total) {
    if (total <= 1) return;
    setState(() {
      _currentIndex = (_currentIndex + 1) % total;
      _qtyCtrl.text = '1';
    });
  }

  void _openBarcodeDialog() {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.qr_code_scanner, color: Color(0xFF006837)),
            SizedBox(width: 8),
            Text('Scan / Search SKU', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Product SKU or Barcode',
            hintText: 'e.g. TC001',
            border: OutlineInputBorder(),
          ),
          onSubmitted: (val) {
            Navigator.pop(ctx);
            if (val.trim().isNotEmpty) {
              _searchCtrl.text = val.trim();
              setState(() => _currentIndex = 0);
            }
          },
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF006837),
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.pop(ctx);
              if (ctrl.text.trim().isNotEmpty) {
                _searchCtrl.text = ctrl.text.trim();
                setState(() => _currentIndex = 0);
              }
            },
            child: const Text('Search'),
          ),
        ],
      ),
    );
  }

  void _openFilterSheet(BuildContext context, CatalogProvider provider) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Filter Catalog', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              const Text('Filter by Category', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ChoiceChip(
                    label: const Text('All Categories'),
                    selected: _selectedCategory.startsWith('All') || _selectedCategory.isEmpty,
                    onSelected: (val) {
                      _onCategorySelected('All');
                      Navigator.pop(ctx);
                    },
                  ),
                  ...provider.categories.map((c) => ChoiceChip(
                        label: Text(c),
                        selected: _selectedCategory.toLowerCase() == c.toLowerCase(),
                        onSelected: (val) {
                          _onCategorySelected(val ? c : 'All');
                          Navigator.pop(ctx);
                        },
                      )),
                ],
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF006837),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Close'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAddProductDialog() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const EditProductScreen()),
    );
  }

  void _addToCart(Product product, CatalogProvider provider) {
    final qty = int.tryParse(_qtyCtrl.text.trim()) ?? 1;
    if (qty <= 0) {
      showAppSnackBar(context, 'Please enter a valid quantity', isError: true);
      return;
    }

    provider.addToOrder(product, qty: qty);
    showAppSnackBar(
      context,
      'Added ${qty}x ${product.desc} to Cart',
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CatalogProvider>();
    final allProducts = provider.products;

    // Filter by search & category
    final query = _searchCtrl.text.toLowerCase().trim();
    final filtered = allProducts.where((p) {
      if (query.isNotEmpty) {
        final matches = p.desc.toLowerCase().contains(query) ||
            p.code.toLowerCase().contains(query) ||
            p.spec.toLowerCase().contains(query) ||
            p.category.toLowerCase().contains(query) ||
            (p.brand != null && p.brand!.toLowerCase().contains(query));
        if (!matches) return false;
      }
      if (_selectedCategory.startsWith('All') || _selectedCategory.isEmpty) {
        return true;
      }
      return p.category.toLowerCase() == _selectedCategory.toLowerCase();
    }).toList();

    final totalItems = filtered.length;
    if (_currentIndex >= totalItems && totalItems > 0) {
      _currentIndex = 0;
    }
    final activeProduct = totalItems > 0 ? filtered[_currentIndex] : null;

    final dynamicCategories = <String>['All (${allProducts.length})'];
    for (final c in provider.categories) {
      if (c.isNotEmpty && !dynamicCategories.contains(c)) {
        dynamicCategories.add(c);
      }
    }
    if (dynamicCategories.length == 1) {
      dynamicCategories.addAll(['Mobile Accessories', 'Chargers', 'Cables', 'Stationery', 'Others']);
    }

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            // =========================================================================
            // 1. TOP HEADER & APPBAR (FOREST GREEN #006837 matching screenshot)
            // =========================================================================
            Container(
              color: const Color(0xFF006837),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 12),
                  child: Column(
                    children: [
                      // Top Row: Back, Box Icon, Title, Actions (+ Add Product & Cart)
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.arrow_back, color: Colors.white, size: 24),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                            onPressed: () {
                              if (widget.onNavigate != null) {
                                widget.onNavigate!(0); // Navigate to Ledger
                              } else if (Navigator.of(context).canPop()) {
                                Navigator.of(context).pop();
                              }
                            },
                          ),
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: const Color(0xFF00522B),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.inventory_2_outlined, color: Colors.white, size: 19),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text(
                                  'Product Catalog',
                                  style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800, color: Colors.white),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  'All Products (${allProducts.length})',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.white70),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),

                          // Barcode Scanner Icon in Header
                          IconButton(
                            icon: const Icon(Icons.qr_code_scanner, color: Colors.white, size: 22),
                            tooltip: 'Scan Barcode',
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                            onPressed: _openBarcodeDialog,
                          ),

                          // + Add Product Pill Button
                          InkWell(
                            onTap: _showAddProductDialog,
                            borderRadius: BorderRadius.circular(18),
                            child: Container(
                              height: 32,
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(18),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.add, size: 16, color: Color(0xFF006837)),
                                  SizedBox(width: 4),
                                  Text(
                                    'Add Product',
                                    style: TextStyle(
                                      color: Color(0xFF006837),
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(width: 6),

                          // Cart Icon with Dynamic Badge Count
                          InkWell(
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                              );
                            },
                            borderRadius: BorderRadius.circular(20),
                            child: Container(
                              width: 38,
                              height: 38,
                              padding: const EdgeInsets.all(4),
                              child: Stack(
                                alignment: Alignment.center,
                                children: [
                                  const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 24),
                                  if (provider.totalCartQty > 0)
                                    Positioned(
                                      right: 0,
                                      top: 0,
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFE11D48),
                                          borderRadius: BorderRadius.circular(10),
                                          border: Border.all(color: Colors.white, width: 1.5),
                                        ),
                                        constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                                        child: Text(
                                          '${provider.totalCartQty}',
                                          textAlign: TextAlign.center,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.w900,
                                            height: 1,
                                          ),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Search & Filter Row
                      Row(
                        children: [
                          Expanded(
                            child: Container(
                              height: 38,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  const Padding(
                                    padding: EdgeInsets.symmetric(horizontal: 9),
                                    child: Icon(Icons.search, size: 18, color: Color(0xFF64748B)),
                                  ),
                                  Expanded(
                                    child: TextField(
                                      controller: _searchCtrl,
                                      onChanged: (v) => setState(() => _currentIndex = 0),
                                      style: const TextStyle(fontSize: 12.5, color: Color(0xFF0F172A)),
                                      decoration: const InputDecoration(
                                        hintText: 'Search product name, code or barcode...',
                                        hintStyle: TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                                        border: InputBorder.none,
                                        isDense: true,
                                        contentPadding: EdgeInsets.symmetric(vertical: 8),
                                      ),
                                    ),
                                  ),
                                  InkWell(
                                    onTap: _openBarcodeDialog,
                                    child: const Padding(
                                      padding: EdgeInsets.symmetric(horizontal: 10),
                                      child: Icon(Icons.qr_code_scanner, size: 18, color: Color(0xFF006837)),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          InkWell(
                            onTap: () => _openFilterSheet(context, provider),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              height: 38,
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.tune_rounded, size: 17, color: Color(0xFF006837)),
                                  SizedBox(width: 4),
                                  Text(
                                    'Filter',
                                    style: TextStyle(
                                      color: Color(0xFF006837),
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // =========================================================================
            // 2. CATEGORY CHIPS STRIP (Horizontal scrolling)
            // =========================================================================
            Container(
              height: 48,
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9), width: 1)),
              ),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                itemCount: dynamicCategories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (ctx, i) {
                  final cat = dynamicCategories[i];
                  final isSelected = (_selectedCategory.startsWith('All') && i == 0) ||
                      (_selectedCategory.toLowerCase() == cat.toLowerCase());
                  return InkWell(
                    onTap: () => _onCategorySelected(cat),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF006837) : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF006837) : const Color(0xFFE2E8F0),
                          width: 1,
                        ),
                      ),
                      child: Text(
                        cat,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                          color: isSelected ? Colors.white : const Color(0xFF475569),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            // =========================================================================
            // 3. MAIN PRODUCT DETAILS CARD
            // =========================================================================
            Expanded(
              child: activeProduct == null
                  ? _buildEmptyState()
                  : SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
                      child: _buildProductCard(context, activeProduct, totalItems, provider),
                    ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: widget.onNavigate != null
          ? AppBottomNav(currentIndex: 2, onTap: widget.onNavigate!)
          : null,
    );
  }

  Widget _buildProductCard(
    BuildContext context,
    Product item,
    int totalItems,
    CatalogProvider provider,
  ) {
    final marginVal = item.marginAmount.toStringAsFixed(2);
    final inStock = item.stock > 0;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Section 1: Hero Image (Left) & Product Details (Right) ──
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product Image
              Container(
                width: 135,
                height: 145,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Center(
                    child: Transform.scale(
                      scale: 1.25,
                      child: const _ChargerIllustration(),
                    ),
                  ),
                ),
              ),

              const SizedBox(width: 12),

              // Product Info & Meta
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Row with In Stock & Favorite Heart
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: inStock ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: inStock ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.inventory_2_outlined,
                                size: 12,
                                color: inStock ? const Color(0xFF15803D) : const Color(0xFFDC2626),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                inStock ? 'In Stock' : 'Out of Stock',
                                style: TextStyle(
                                  color: inStock ? const Color(0xFF15803D) : const Color(0xFFDC2626),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Wishlist Favorite Heart
                        InkWell(
                          onTap: () => setState(() => _isFavorite = !_isFavorite),
                          borderRadius: BorderRadius.circular(16),
                          child: Padding(
                            padding: const EdgeInsets.all(4),
                            child: Icon(
                              _isFavorite ? Icons.favorite : Icons.favorite_border,
                              color: _isFavorite ? const Color(0xFFDC2626) : const Color(0xFF1E293B),
                              size: 22,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 6),

                    // Code Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF334155),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        item.code,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),

                    const SizedBox(height: 6),

                    // Product Name
                    Text(
                      item.desc,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                        height: 1.25,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),

                    const SizedBox(height: 3),

                    // Short Spec / Voltage
                    Text(
                      item.spec.isNotEmpty ? item.spec : 'Standard Specification',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),

                    const SizedBox(height: 8),

                    // 4 Meta Rows
                    _buildMetaRow('Category', item.category.isNotEmpty ? item.category : 'General', hasChevron: true),
                    const SizedBox(height: 2.5),
                    _buildMetaRow('Brand', item.brand ?? 'ERD'),
                    const SizedBox(height: 2.5),
                    _buildMetaRow('Unit', 'PCS'),
                    const SizedBox(height: 2.5),
                    _buildMetaRow('HSN/SAC', '8504'),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // ── Section 2: Metrics Strip (STD. P KG. 20 | QTY. 10) ──
          Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFDCFCE7)),
            ),
            child: Row(
              children: [
                // STD. P KG.
                Expanded(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.shopping_bag_outlined, color: Color(0xFF1E293B), size: 22),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'STD. P KG.',
                            style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                          ),
                          Text(
                            '${item.pkg > 0 ? item.pkg : 20}',
                            style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                Container(width: 1, height: 32, color: const Color(0xFFCBD5E1)),

                // QTY.
                Expanded(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.inventory_2_outlined, color: Color(0xFF15803D), size: 22),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'QTY.',
                            style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                          ),
                          Text(
                            '${item.stock > 0 ? item.stock : 10}',
                            style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w900, color: Color(0xFF15803D)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // ── Section 3: Pricing Row (Margin 10.00 | SLPrice ₹77.00 | Price (Incl. GST) ₹67.00) ──
          Row(
            children: [
              // Margin
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.trending_up, size: 16, color: Color(0xFF334155)),
                        SizedBox(width: 4),
                        Text('Margin', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      marginVal,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
              ),

              // SLPrice
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.savings_outlined, size: 16, color: Color(0xFF15803D)),
                        SizedBox(width: 4),
                        Text('SLPrice', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '₹${_money.format(item.slPrice)}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF15803D)),
                    ),
                  ],
                ),
              ),

              // Price (Incl. GST)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.local_offer_outlined, size: 16, color: Color(0xFF1D4ED8)),
                        SizedBox(width: 4),
                        Text('Price\n(Incl. GST)', style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600, height: 1)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '₹${_money.format(item.purchase)}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF1D4ED8)),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // ── Section 4: Quantity & Add to Cart Row ──
          Row(
            children: [
              const Text(
                'Quantity',
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
              ),
              const SizedBox(width: 10),

              // Quantity Input Box with Clear Button
              Container(
                width: 95,
                height: 42,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _qtyCtrl,
                        keyboardType: TextInputType.number,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () => setState(() => _qtyCtrl.clear()),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 6),
                        child: Icon(Icons.cancel, size: 16, color: Color(0xFF94A3B8)),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 10),

              // Solid Forest Green [ 🛒 Add to Cart ] Button
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _addToCart(item, provider),
                  icon: const Icon(Icons.shopping_cart_outlined, size: 18),
                  label: const Text(
                    'Add to Cart',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF006837),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    minimumSize: const Size(double.infinity, 42),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // ── Section 5: Product Description Card ──
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.description_outlined, size: 16, color: Color(0xFF475569)),
                        SizedBox(width: 6),
                        Text(
                          'Product Description',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
                        ),
                      ],
                    ),
                    Icon(Icons.chevron_right, size: 16, color: Color(0xFF64748B)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '${item.desc}. ${item.spec.isNotEmpty ? "${item.spec}. " : ""}Suitable for mobile phones and other devices.',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), height: 1.35),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // ── Section 6: Pager Navigation (<  1 of 125  >) ──
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              InkWell(
                onTap: () => _goToPrevProduct(totalItems),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    color: Color(0xFFDCFCE7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.chevron_left, color: Color(0xFF15803D), size: 22),
                ),
              ),
              const SizedBox(width: 24),
              Text(
                '${_currentIndex + 1} of $totalItems',
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF334155),
                ),
              ),
              const SizedBox(width: 24),
              InkWell(
                onTap: () => _goToNextProduct(totalItems),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    color: Color(0xFFDCFCE7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.chevron_right, color: Color(0xFF15803D), size: 22),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetaRow(String label, String value, {bool hasChevron = false}) {
    return Row(
      children: [
        SizedBox(
          width: 65,
          child: Text(
            label,
            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
          ),
        ),
        const Text(': ', style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
        Expanded(
          child: Row(
            children: [
              Text(
                value,
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF334155), fontWeight: FontWeight.w600),
              ),
              if (hasChevron) ...[
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, size: 14, color: Color(0xFF64748B)),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.search_off, size: 48, color: Color(0xFF94A3B8)),
            const SizedBox(height: 12),
            const Text(
              'No products match your search/filter.',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
            ),
            const SizedBox(height: 6),
            TextButton(
              onPressed: () {
                _searchCtrl.clear();
                _onCategorySelected('All');
              },
              child: const Text('Reset Filters', style: TextStyle(color: Color(0xFF006837), fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}

/// ERD Charger Vector Illustration matching the reference photo
class _ChargerIllustration extends StatelessWidget {
  const _ChargerIllustration();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: 100,
        height: 100,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Metal AC Prongs
            Positioned(
              top: 10,
              left: 36,
              child: Container(
                width: 7,
                height: 18,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                  border: Border.all(color: const Color(0xFF94A3B8), width: 1),
                ),
                child: Center(
                  child: Container(
                    width: 3,
                    height: 3,
                    decoration: const BoxDecoration(
                      color: Color(0xFF64748B),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 10,
              left: 56,
              child: Container(
                width: 7,
                height: 18,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                  border: Border.all(color: const Color(0xFF94A3B8), width: 1),
                ),
                child: Center(
                  child: Container(
                    width: 3,
                    height: 3,
                    decoration: const BoxDecoration(
                      color: Color(0xFF64748B),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
            ),

            // Main Charger Body Block
            Positioned(
              top: 24,
              child: Container(
                width: 72,
                height: 68,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 8,
                      offset: const Offset(2, 4),
                    ),
                  ],
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Side perspective shade
                    Positioned(
                      right: 0,
                      top: 0,
                      bottom: 0,
                      child: Container(
                        width: 12,
                        decoration: const BoxDecoration(
                          color: Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.only(
                            topRight: Radius.circular(8),
                            bottomRight: Radius.circular(8),
                          ),
                        ),
                      ),
                    ),

                    // "ERD" Logo Printed on Face
                    const Padding(
                      padding: EdgeInsets.only(top: 8, right: 6),
                      child: Text(
                        'ERD',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
