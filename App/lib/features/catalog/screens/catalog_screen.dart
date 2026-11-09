import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/utils/debouncer.dart';
import '../../../models/product.dart';
import '../../../navigation/app_navigation.dart';
import '../../../providers/catalog_provider.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_bottom_nav.dart';
import '../widgets/catalog_filter_sheet.dart';
import '../widgets/catalog_header.dart';
import '../widgets/catalog_product_card.dart';

class CatalogScreen extends StatefulWidget {
  final ValueChanged<int>? onNavigate;

  const CatalogScreen({super.key, this.onNavigate});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  final Debouncer _debouncer = Debouncer(delay: const Duration(milliseconds: 250));

  String _selectedCategory = 'All';
  String _searchQuery = '';
  CatalogStockFilter _stockFilter = CatalogStockFilter.all;
  CatalogSortOrder _sortOrder = CatalogSortOrder.none;

  final Map<String, int> _quantities = {};
  final Set<String> _favorites = {};
  final Set<String> _expandedDescriptions = {};

  int _getQty(String code) => _quantities[code] ?? 1;

  void _changeQty(String code, int delta) {
    final current = _getQty(code);
    final next = (current + delta).clamp(1, 9999);
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
    _debouncer.dispose();
    super.dispose();
  }

  void _onCategorySelected(String cat) {
    setState(() {
      _selectedCategory = cat;
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
            Text(
              'Scan / Search SKU',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
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
                _searchQuery = val.trim().toLowerCase();
              });
            }
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
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
                  _searchQuery = ctrl.text.trim().toLowerCase();
                });
              }
            },
            child: const Text('Search'),
          ),
        ],
      ),
    );
  }

  void _openFilterSheet() {
    CatalogFilterSheet.show(
      context,
      currentStockFilter: _stockFilter,
      currentSortOrder: _sortOrder,
      onStockFilterChanged: (filter) => setState(() => _stockFilter = filter),
      onSortOrderChanged: (sort) => setState(() => _sortOrder = sort),
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
    showAppSnackBar(context, 'Added ${qty}x ${product.desc} to Cart');
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
    final query = _searchQuery;
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
            // 1. TOP HEADER & APPBAR
            CatalogHeader(
              totalItems: totalItems,
              allProductsCount: allProducts.length,
              searchCtrl: _searchCtrl,
              provider: provider,
              onNavigate: widget.onNavigate,
              onScanBarcode: _openBarcodeDialog,
              onOpenFilter: _openFilterSheet,
              onSearchChanged: (v) {
                _debouncer.run(() {
                  if (mounted) {
                    setState(() {
                      _searchQuery = v.toLowerCase().trim();
                    });
                  }
                });
              },
            ),

            // 2. CATEGORY CHIPS STRIP
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

            // 3. MAIN COMPACT PRODUCT LIST
            Expanded(
              child: totalItems == 0
                  ? _buildEmptyState(provider, allProducts.isEmpty)
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
                      itemCount: totalItems,
                      itemBuilder: (ctx, idx) {
                        final item = filtered[idx];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: CatalogProductCard(
                            item: item,
                            index: idx,
                            qty: _getQty(item.code),
                            isFav: _favorites.contains(item.code),
                            isExpanded: _expandedDescriptions.contains(item.code),
                            provider: provider,
                            onQtyChanged: (delta) => _changeQty(item.code, delta),
                            onToggleFav: () {
                              setState(() {
                                if (_favorites.contains(item.code)) {
                                  _favorites.remove(item.code);
                                } else {
                                  _favorites.add(item.code);
                                }
                              });
                            },
                            onToggleExpand: () {
                              setState(() {
                                if (_expandedDescriptions.contains(item.code)) {
                                  _expandedDescriptions.remove(item.code);
                                } else {
                                  _expandedDescriptions.add(item.code);
                                }
                              });
                            },
                            onAddToCart: () => _addToCart(item, provider),
                          ),
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
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF64748B),
              ),
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
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E293B),
                ),
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
                label: const Text('Reload Products',
                    style: TextStyle(fontWeight: FontWeight.bold)),
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
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Color(0xFF334155),
              ),
            ),
            const SizedBox(height: 6),
            TextButton(
              onPressed: () {
                _searchCtrl.clear();
                _onCategorySelected('All');
                setState(() {
                  _searchQuery = '';
                  _stockFilter = CatalogStockFilter.all;
                  _sortOrder = CatalogSortOrder.none;
                });
              },
              child: const Text(
                'Reset Filters',
                style: TextStyle(
                  color: Color(0xFF006837),
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
