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

  void _setQty(String code, int value) {
    setState(() => _quantities[code] = value.clamp(1, 99999));
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
            Icon(Icons.qr_code_scanner, color: Color(0xFF2563EB)),
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
              backgroundColor: const Color(0xFF2563EB),
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
                border: Border(bottom: BorderSide(color: AppColors.border, width: 1)),
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
                        color: isSelected ? AppColors.blue50 : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected ? AppColors.blue600 : AppColors.border,
                          width: isSelected ? 1.4 : 1,
                        ),
                      ),
                      child: Text(
                        cat,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                          color: isSelected ? AppColors.navy900 : AppColors.textSecondary,
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
                            onQtyChanged: (newQty) => _setQty(item.code, newQty),
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
      return Padding(
        padding: const EdgeInsets.all(16),
        child: SkeletonLoader.list(count: 6),
      );
    }

    if (isTotalEmpty) {
      return EmptyState(
        icon: Icons.inventory_2_outlined,
        title: 'No products loaded yet',
        subtitle: 'Tap below to reload products from the database',
        buttonLabel: 'Reload Products',
        onButtonPressed: () => provider.loadProducts(),
      );
    }

    return EmptyState(
      icon: Icons.search_off_rounded,
      title: 'No products found',
      subtitle: 'No products match your search or filter criteria.',
      buttonLabel: 'Reset Filters',
      onButtonPressed: () {
        _searchCtrl.clear();
        _onCategorySelected('All');
        setState(() {
          _searchQuery = '';
          _stockFilter = CatalogStockFilter.all;
          _sortOrder = CatalogSortOrder.none;
        });
      },
    );
  }
}
