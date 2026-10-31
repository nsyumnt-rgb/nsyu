import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/product.dart';
import '../navigation/app_navigation.dart';
import '../providers/catalog_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bottom_nav.dart';
import 'edit_product_screen.dart';
import 'order_cart_screen.dart';

/// Product Catalog Screen matching Reference Design:
/// - Forest Green Header (#006837) with Back, Box icon, Product Catalog title, All Products (N), Barcode trigger, + Add Product, Cart icon with badge
/// - Integrated Search & Filter row with in-field barcode trigger
/// - Category Chips: All (340), MARKET, NECKBAND, CHARGER, CABLES, etc.
/// - Compact Product Cards in smooth scrolling ListView:
///   - Compact image with In Stock badge & Wishlist Heart icon
///   - Brand badge (edenic, boAt), Product Name, Short Description/Specs
///   - Meta rows: Category, Brand, Unit, HSN/SAC
///   - Packaging Metrics Strip: STD. P KG. 5 | QTY. 9
///   - ONLY SL-Price Banner: green tag icon + SL-Price + ₹150.00 in bold green (NO Margin, NO regular price!)
///   - Quantity Selector [-] 1 [+] with solid green [ 🛒 Add to Cart ] button
///   - Compact expandable Product Description card
/// - 5-Tab Bottom Navigation Bar (Ledger | Bill | Order | Catalog [Active] | More)
class CatalogScreen extends StatefulWidget {
  final ValueChanged<int>? onNavigate;

  const CatalogScreen({super.key, this.onNavigate});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

enum CatalogStockFilter { all, inStock, outOfStock }
enum CatalogSortOrder { none, nameAsc, priceAsc, priceDesc }

class _CatalogScreenState extends State<CatalogScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  final NumberFormat _money = NumberFormat('#,##0.00');

  String _selectedCategory = 'All';
  int _currentIndex = 0;
  CatalogStockFilter _stockFilter = CatalogStockFilter.all;
  CatalogSortOrder _sortOrder = CatalogSortOrder.none;

  final Map<String, int> _quantities = {};
  final Set<String> _favorites = {};
  final Set<String> _expandedDescriptions = {};

  int _getQty(String code) => _quantities[code] ?? 1;

  void _changeQty(String code, int delta, int maxStock) {
    final current = _getQty(code);
    final next = (current + delta).clamp(1, maxStock > 0 ? maxStock : 9999);
    setState(() => _quantities[code] = next);
  }

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
    super.dispose();
  }

  void _onCategorySelected(String cat) {
    setState(() {
      _selectedCategory = cat;
      _currentIndex = 0;
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
              setState(() {
                _searchCtrl.text = val.trim();
                _currentIndex = 0;
              });
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
                setState(() {
                  _searchCtrl.text = ctrl.text.trim();
                  _currentIndex = 0;
                });
              }
            },
            child: const Text('Search'),
          ),
        ],
      ),
    );
  }

  void _showAddProductDialog() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const EditProductScreen(isNew: true),
      ),
    );
  }

  void _openFilterSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Filter Products', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.all_inclusive, color: Color(0xFF006837)),
                  title: const Text('All Products'),
                  trailing: _stockFilter == CatalogStockFilter.all ? const Icon(Icons.check, color: Color(0xFF006837)) : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() => _stockFilter = CatalogStockFilter.all);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.check_circle_outline, color: Color(0xFF006837)),
                  title: const Text('In Stock Only'),
                  trailing: _stockFilter == CatalogStockFilter.inStock ? const Icon(Icons.check, color: Color(0xFF006837)) : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() => _stockFilter = CatalogStockFilter.inStock);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.highlight_off, color: Color(0xFFDC2626)),
                  title: const Text('Out of Stock Only'),
                  trailing: _stockFilter == CatalogStockFilter.outOfStock ? const Icon(Icons.check, color: Color(0xFF006837)) : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() => _stockFilter = CatalogStockFilter.outOfStock);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.sort_by_alpha, color: Color(0xFF1E293B)),
                  title: const Text('Sort by Name (A-Z)'),
                  trailing: _sortOrder == CatalogSortOrder.nameAsc ? const Icon(Icons.check, color: Color(0xFF006837)) : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() => _sortOrder = CatalogSortOrder.nameAsc);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.currency_rupee, color: Color(0xFF1E293B)),
                  title: const Text('Sort by SL-Price (Low to High)'),
                  trailing: _sortOrder == CatalogSortOrder.priceAsc ? const Icon(Icons.check, color: Color(0xFF006837)) : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() => _sortOrder = CatalogSortOrder.priceAsc);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _addToCart(Product product, CatalogProvider provider, [int? customQty]) {
    if (provider.isItemInCart(product.code)) {
      showAppSnackBar(context, '${product.desc} is already in Cart');
      return;
    }
    final qty = customQty ?? (_quantities[product.code] ?? 1);
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

    if (allProducts.isEmpty && provider.status != LoadStatus.loading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && provider.products.isEmpty && provider.status != LoadStatus.loading) {
          provider.loadProducts();
        }
      });
    }

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
      if (!_selectedCategory.startsWith('All') && _selectedCategory.isNotEmpty) {
        if (p.category.toLowerCase() != _selectedCategory.toLowerCase()) return false;
      }
      if (_stockFilter == CatalogStockFilter.inStock && p.stock <= 0) return false;
      if (_stockFilter == CatalogStockFilter.outOfStock && p.stock > 0) return false;
      return true;
    }).toList();

    if (_sortOrder == CatalogSortOrder.nameAsc) {
      filtered.sort((a, b) => a.desc.toLowerCase().compareTo(b.desc.toLowerCase()));
    } else if (_sortOrder == CatalogSortOrder.priceAsc) {
      filtered.sort((a, b) => a.slPrice.compareTo(b.slPrice));
    } else if (_sortOrder == CatalogSortOrder.priceDesc) {
      filtered.sort((a, b) => b.slPrice.compareTo(a.slPrice));
    }

    final totalItems = filtered.length;
    if (_currentIndex >= totalItems && totalItems > 0) {
      _currentIndex = 0;
    }

    final dynamicCategories = <String>['All (${allProducts.length})'];
    for (final c in provider.categories) {
      if (c.isNotEmpty && !dynamicCategories.contains(c)) {
        dynamicCategories.add(c);
      }
    }
    if (dynamicCategories.length == 1) {
      dynamicCategories.addAll(['MARKET', 'NECKBAND', 'CHARGER', 'CABLES', 'OTHERS']);
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
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
                          const SizedBox(width: 6),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text(
                                  'Product Catalog',
                                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: -0.2),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  totalItems > 0 ? 'All Products ($totalItems)' : (allProducts.isNotEmpty ? 'All Products (${allProducts.length})' : 'All Products'),
                                  style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Colors.white70),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),

                          // Barcode Scanner Icon in Header
                          IconButton(
                            icon: const Icon(Icons.qr_code_scanner, color: Colors.white, size: 21),
                            tooltip: 'Scan Barcode',
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 30, minHeight: 32),
                            onPressed: _openBarcodeDialog,
                          ),

                          // + Add Product Pill Button
                          InkWell(
                            onTap: _showAddProductDialog,
                            borderRadius: BorderRadius.circular(18),
                            child: Container(
                              height: 30,
                              padding: const EdgeInsets.symmetric(horizontal: 8),
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
                                      onChanged: (v) {
                                        setState(() {
                                          _currentIndex = 0;
                                        });
                                      },
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
                            onTap: () => _openFilterSheet(context),
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
            // 3. MAIN COMPACT PRODUCT LIST (Smooth Vertical Scrollable List)
            // =========================================================================
            Expanded(
              child: totalItems == 0
                  ? _buildEmptyState(provider, allProducts.isEmpty)
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
                      itemCount: totalItems,
                      itemBuilder: (ctx, idx) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _buildProductCard(context, filtered[idx], totalItems, provider, idx),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: 3,
        onTap: widget.onNavigate ?? (tab) => AppNavigation.toTab(context, tab),
      ),
    );
  }

  Widget _buildProductCard(
    BuildContext context,
    Product item,
    int totalItems,
    CatalogProvider provider,
    int index,
  ) {
    final inStock = item.stock > 0;
    final isFav = _favorites.contains(item.code);
    final isExpanded = _expandedDescriptions.contains(item.code);
    final qty = _getQty(item.code);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Section 1: Hero Image (Left) & Product Details (Right) ──
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product Image (Compact 110x110)
              Container(
                width: 110,
                height: 115,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: _ProductThumbnail(brand: item.brand ?? item.code, isDark: index % 2 == 1),
                ),
              ),

              const SizedBox(width: 10),

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
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
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
                                size: 11,
                                color: inStock ? const Color(0xFF15803D) : const Color(0xFFDC2626),
                              ),
                              const SizedBox(width: 3),
                              Text(
                                inStock ? 'In Stock' : 'Out of Stock',
                                style: TextStyle(
                                  color: inStock ? const Color(0xFF15803D) : const Color(0xFFDC2626),
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Wishlist Favorite Heart
                        InkWell(
                          onTap: () {
                            setState(() {
                              if (isFav) {
                                _favorites.remove(item.code);
                              } else {
                                _favorites.add(item.code);
                              }
                            });
                          },
                          borderRadius: BorderRadius.circular(16),
                          child: Padding(
                            padding: const EdgeInsets.all(2),
                            child: Icon(
                              isFav ? Icons.favorite : Icons.favorite_border,
                              color: isFav ? const Color(0xFFDC2626) : const Color(0xFF1E293B),
                              size: 20,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 4),

                    // Code / Brand Tag
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF334155),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        (item.brand?.isNotEmpty == true ? item.brand! : item.code).toLowerCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),

                    const SizedBox(height: 4),

                    // Product Name
                    Text(
                      item.desc,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),

                    const SizedBox(height: 2),

                    // Short Description / Spec
                    Text(
                      '${item.desc}. Suitable for mobile phones and other devices.',
                      style: const TextStyle(
                        fontSize: 10.5,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                        height: 1.25,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),

                    const SizedBox(height: 6),

                    // Meta Rows
                    _buildMetaRow('Category', item.category.isNotEmpty ? item.category : 'MARKET', hasChevron: true),
                    const SizedBox(height: 2),
                    _buildMetaRow('Brand', item.brand ?? 'MARKET'),
                    const SizedBox(height: 2),
                    _buildMetaRow('Unit', 'PCS'),
                    const SizedBox(height: 2),
                    _buildMetaRow('HSN/SAC', '8504'),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // ── Section 2: Metrics Strip (STD. P KG. 5 | QTY. 9) ──
          Container(
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFDCFCE7)),
            ),
            child: Row(
              children: [
                // STD. P KG.
                Expanded(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.shopping_bag_outlined, color: Color(0xFF1E293B), size: 18),
                      const SizedBox(width: 6),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'STD. P KG.',
                            style: TextStyle(fontSize: 8.5, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                          ),
                          Text(
                            '${item.pkg > 0 ? item.pkg : 5}',
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                Container(width: 1, height: 26, color: const Color(0xFFCBD5E1)),

                // QTY.
                Expanded(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.inventory_2_outlined, color: Color(0xFF15803D), size: 18),
                      const SizedBox(width: 6),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'QTY.',
                            style: TextStyle(fontSize: 8.5, color: Color(0xFF64748B), fontWeight: FontWeight.bold),
                          ),
                          Text(
                            '${item.stock > 0 ? item.stock : 9}',
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF15803D)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 10),

          // ── Section 3: Pricing Banner (ONLY SL-Price Visible!) ──
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFDCFCE7)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.local_offer_outlined, color: Color(0xFF16A34A), size: 20),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'SL-Price',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF15803D),
                      ),
                    ),
                    Text(
                      '₹${_money.format(item.slPrice)}',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF16A34A),
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 10),

          // ── Section 4: Quantity & Add to Cart Row ──
          Row(
            children: [
              const Text(
                'Quantity',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
              ),
              const SizedBox(width: 8),

              // Interactive Quantity Pill [-] QTY [+]
              Container(
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    InkWell(
                      onTap: () => _changeQty(item.code, -1, item.stock),
                      borderRadius: const BorderRadius.horizontal(left: Radius.circular(8)),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        child: Icon(Icons.remove, size: 16, color: Color(0xFF475569)),
                      ),
                    ),
                    Container(
                      constraints: const BoxConstraints(minWidth: 28),
                      alignment: Alignment.center,
                      child: Text(
                        '$qty',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () => _changeQty(item.code, 1, item.stock),
                      borderRadius: const BorderRadius.horizontal(right: Radius.circular(8)),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        child: Icon(Icons.add, size: 16, color: Color(0xFF475569)),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 10),

              // Add to Cart Button (Disabled once added)
              Builder(builder: (_) {
                final isInCart = provider.isItemInCart(item.code);
                return Expanded(
                  child: isInCart
                      ? ElevatedButton.icon(
                          onPressed: null, // Dobara click nahi hoga
                          icon: const Icon(Icons.check_circle_rounded, size: 18, color: Colors.white),
                          label: const Text(
                            'Added in Cart',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Colors.white),
                          ),
                          style: ElevatedButton.styleFrom(
                            disabledBackgroundColor: const Color(0xFF16A34A),
                            disabledForegroundColor: Colors.white,
                            elevation: 0,
                            minimumSize: const Size(double.infinity, 38),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        )
                      : ElevatedButton.icon(
                          onPressed: () => _addToCart(item, provider, qty),
                          icon: const Icon(Icons.shopping_cart_outlined, size: 18),
                          label: const Text(
                            'Add to Cart',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF006837),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            minimumSize: const Size(double.infinity, 38),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                );
              }),
            ],
          ),

          const SizedBox(height: 10),

          // ── Section 5: Product Description Card (Expandable) ──
          InkWell(
            onTap: () {
              setState(() {
                if (isExpanded) {
                  _expandedDescriptions.remove(item.code);
                } else {
                  _expandedDescriptions.add(item.code);
                }
              });
            },
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.description_outlined, size: 15, color: Color(0xFF475569)),
                          SizedBox(width: 6),
                          Text(
                            'Product Description',
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
                          ),
                        ],
                      ),
                      Icon(
                        isExpanded ? Icons.keyboard_arrow_up : Icons.chevron_right,
                        size: 16,
                        color: const Color(0xFF64748B),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.desc}. ${item.spec.isNotEmpty ? "${item.spec}. " : ""}Suitable for mobile phones and other devices.',
                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), height: 1.3),
                    maxLines: isExpanded ? null : 2,
                    overflow: isExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
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

  Widget _buildEmptyState(CatalogProvider provider, bool isTotalEmpty) {
    if (provider.status == LoadStatus.loading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Color(0xFF006837)),
            SizedBox(height: 14),
            Text(
              'Loading products from catalog...',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
            ),
          ],
        ),
      );
    }

    if (isTotalEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.inventory_2_outlined, size: 54, color: Color(0xFF94A3B8)),
              const SizedBox(height: 12),
              const Text(
                'No products loaded yet',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
              ),
              const SizedBox(height: 6),
              const Text(
                'Tap below to reload products from the database',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF006837),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Reload Products', style: TextStyle(fontWeight: FontWeight.bold)),
                onPressed: () => provider.loadProducts(),
              ),
            ],
          ),
        ),
      );
    }

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
                setState(() {
                  _stockFilter = CatalogStockFilter.all;
                  _sortOrder = CatalogSortOrder.none;
                });
              },
              child: const Text('Reset Filters', style: TextStyle(color: Color(0xFF006837), fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}

/// Clean Vector Thumbnail matching Reference Image
class _ProductThumbnail extends StatelessWidget {
  final String brand;
  final bool isDark;

  const _ProductThumbnail({required this.brand, this.isDark = false});

  @override
  Widget build(BuildContext context) {
    final bg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final fg = isDark ? Colors.white : const Color(0xFF0F172A);

    return Center(
      child: SizedBox(
        width: 80,
        height: 80,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Metal Prongs
            Positioned(
              top: 4,
              left: 28,
              child: Container(
                width: 6,
                height: 14,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                  border: Border.all(color: const Color(0xFF94A3B8), width: 1),
                ),
              ),
            ),
            Positioned(
              top: 4,
              left: 46,
              child: Container(
                width: 6,
                height: 14,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                  border: Border.all(color: const Color(0xFF94A3B8), width: 1),
                ),
              ),
            ),
            // Body
            Positioned(
              top: 16,
              child: Container(
                width: 58,
                height: 56,
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.08),
                      blurRadius: 6,
                      offset: const Offset(1, 3),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    brand.isNotEmpty ? brand.toUpperCase() : 'ERD',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: fg,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
