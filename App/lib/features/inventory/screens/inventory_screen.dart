import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/utils/debouncer.dart';
import '../../../models/catalog_item.dart';
import '../../../navigation/app_navigation.dart';
import '../../../providers/catalog_provider.dart';
import '../../../widgets/animated_feedback_dialog.dart';
import '../../../widgets/app_bottom_nav.dart';
import '../../../screens/edit_product_screen.dart';
import '../widgets/charger_illustration.dart';
import '../widgets/inventory_card_item.dart';
import '../widgets/inventory_spreadsheet_table.dart';

class InventoryScreen extends StatefulWidget {
  final ValueChanged<int>? onNavigate;

  const InventoryScreen({super.key, this.onNavigate});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _qtyCtrl = TextEditingController(text: '1');
  final Debouncer _debouncer = Debouncer(delay: const Duration(milliseconds: 250));

  String _selectedCategory = 'All';
  int _selectedThumbnail = 0;
  bool _isFavorite = false;
  bool _isTableView = false;
  String _searchQuery = '';

  List<CatalogItem> _catalog = [];

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

  List<CatalogItem> _productsToCatalog(List<dynamic> products) {
    if (products.isEmpty) return [];
    return products
        .map((p) => CatalogItem(
              sNo: p.sno,
              code: p.code,
              name: p.desc,
              specs: p.spec,
              stdPkg: p.pkg,
              qty: p.stock,
              price: p.purchase,
              margin: p.marginAmount.toStringAsFixed(2),
              slPrice: p.sellingPrice,
              category: p.category.toString().isNotEmpty ? p.category.toString() : 'General',
              brand: p.brand ?? 'ERD',
              unit: 'PCS',
              hsnSac: '8504',
              description: '${p.desc} (${p.spec}). High quality and durable components.',
              isActive: true,
            ))
        .toList();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _qtyCtrl.dispose();
    _debouncer.dispose();
    super.dispose();
  }

  List<CatalogItem> get _filteredCatalog {
    final query = _searchQuery;
    return _catalog.where((item) {
      if (query.isNotEmpty) {
        final matches = item.name.toLowerCase().contains(query) ||
            item.code.toLowerCase().contains(query) ||
            item.specs.toLowerCase().contains(query) ||
            item.category.toLowerCase().contains(query) ||
            item.brand.toLowerCase().contains(query);
        if (!matches) return false;
      }

      if (_selectedCategory.startsWith('All') || _selectedCategory.isEmpty) {
        return true;
      }
      return item.category.toLowerCase() == _selectedCategory.toLowerCase();
    }).toList();
  }

  void _onCategorySelected(String cat) {
    setState(() {
      _selectedCategory = cat;
      _selectedThumbnail = 0;
      _qtyCtrl.text = '1';
    });
  }

  Future<void> _onEditProduct(CatalogItem item) async {
    final updated = await Navigator.push<CatalogItem>(
      context,
      MaterialPageRoute(
        builder: (_) => EditProductScreen(item: item),
      ),
    );
    if (!mounted || updated == null) return;
    setState(() {
      final itemIdx = _catalog.indexWhere((c) =>
          c.code == item.code || c.sNo == item.sNo);
      if (itemIdx != -1) {
        _catalog[itemIdx] = updated;
      }
    });
    AppToast.showSuccess(
      context,
      title: 'Product Updated',
      subtitle: '${updated.name} details saved.',
    );
  }

  void _showAddProductDialog() async {
    final newItem = await Navigator.push<CatalogItem>(
      context,
      MaterialPageRoute(
        builder: (_) => const EditProductScreen(isNew: true),
      ),
    );
    if (!mounted) return;
    if (newItem != null) {
      setState(() {
        _catalog.insert(0, newItem);
      });
      AppToast.showSuccess(
        context,
        title: 'Product Added',
        subtitle: '${newItem.name} added to catalog.',
      );
    }
  }

  void _openFilterSheet() {
    final categories = [
      'All (125)',
      'Mobile Accessories',
      'Chargers',
      'Cables',
      'Stationery',
      'Others',
    ];

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Filter Products',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                  IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const SizedBox(height: 12),
              const Text('Select Category',
                  style: TextStyle(
                      fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: categories.map((cat) {
                  final isSelected = _selectedCategory == cat;
                  return ChoiceChip(
                    label: Text(cat),
                    selected: isSelected,
                    selectedColor: const Color(0xFF006837),
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : const Color(0xFF1E293B),
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                      fontSize: 12,
                    ),
                    onSelected: (_) {
                      setSheetState(() {});
                      _onCategorySelected(cat);
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF006837),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Apply Filter',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
            Text('Scan / Search SKU',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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
              setState(() {
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
                _searchCtrl.text = ctrl.text.trim();
                setState(() {
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

  void _openFullscreenImage(CatalogItem item) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    item.name,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                height: 240,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Center(
                  child: ChargerIllustration(
                    thumbnailIndex: _selectedThumbnail,
                    isLarge: true,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
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
                _onCategorySelected('All (125)');
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

  @override
  Widget build(BuildContext context) {
    final catalogProvider = context.watch<CatalogProvider>();
    final liveProducts = catalogProvider.products;

    if (liveProducts.isNotEmpty) {
      _catalog = _productsToCatalog(liveProducts);
    }

    final filtered = _filteredCatalog;
    final totalItems = filtered.length;

    final dynamicCategories = <String>['All (${_catalog.length})'];
    for (final c in catalogProvider.categories) {
      if (c.isNotEmpty && !dynamicCategories.contains(c)) {
        dynamicCategories.add(c);
      }
    }
    final categories = dynamicCategories.length > 1
        ? dynamicCategories
        : [
            'All (125)',
            'Mobile Accessories',
            'Chargers',
            'Cables',
            'Stationery',
            'Others',
          ];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            // 1. TOP HEADER & APPBAR
            Container(
              color: const Color(0xFF006837),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 8, 14, 12),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.arrow_back, color: Colors.white, size: 24),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                            onPressed: () {
                              if (widget.onNavigate != null) {
                                widget.onNavigate!(0);
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
                            child: const Icon(Icons.inventory_2_outlined,
                                color: Colors.white, size: 19),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text(
                                  'Product Catalog',
                                  style: TextStyle(
                                    fontSize: 16.5,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  '$totalItems Products Available',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
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
                                    child: Icon(Icons.search,
                                        size: 18, color: Color(0xFF64748B)),
                                  ),
                                  Expanded(
                                    child: TextField(
                                      controller: _searchCtrl,
                                      onChanged: (v) {
                                        _debouncer.run(() {
                                          if (mounted) {
                                            setState(() {
                                              _searchQuery = v.trim().toLowerCase();
                                            });
                                          }
                                        });
                                      },
                                      style: const TextStyle(
                                          fontSize: 12.5, color: Color(0xFF0F172A)),
                                      decoration: const InputDecoration(
                                        hintText: 'Search product name, code or barcode...',
                                        hintStyle:
                                            TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
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
                                      child: Icon(Icons.qr_code_scanner,
                                          size: 18, color: Color(0xFF006837)),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          InkWell(
                            onTap: _openFilterSheet,
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              height: 38,
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.filter_alt_outlined,
                                      size: 17, color: Color(0xFF006837)),
                                  SizedBox(width: 4),
                                  Text(
                                    'Filter',
                                    style: TextStyle(
                                      color: Color(0xFF006837),
                                      fontSize: 12.5,
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

            // 2. HORIZONTAL CATEGORY CHIPS
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: categories.map((cat) {
                    final isSelected = _selectedCategory == cat;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: InkWell(
                        onTap: () => _onCategorySelected(cat),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFF006837) : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isSelected
                                  ? const Color(0xFF006837)
                                  : const Color(0xFFE2E8F0),
                              width: 1,
                            ),
                          ),
                          child: Text(
                            cat,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight:
                                  isSelected ? FontWeight.w800 : FontWeight.w500,
                              color: isSelected
                                  ? Colors.white
                                  : const Color(0xFF334155),
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // 3. MAIN BODY (CARD VIEW OR TABLE VIEW)
            Expanded(
              child: _isTableView
                  ? InventorySpreadsheetTable(
                      items: filtered,
                      onSelectIndex: (i) {
                        setState(() {
                          _isTableView = false;
                        });
                      },
                    )
                  : (totalItems == 0
                      ? _buildEmptyState()
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(12, 10, 12, 80),
                          itemCount: totalItems,
                          separatorBuilder: (_, __) => const SizedBox(height: 14),
                          itemBuilder: (ctx, idx) {
                            final item = filtered[idx];
                            return InventoryCardItem(
                              item: item,
                              selectedThumbnail: _selectedThumbnail,
                              isFavorite: _isFavorite,
                              qtyText: _qtyCtrl.text,
                              onSelectThumbnail: (thumbIdx) =>
                                  setState(() => _selectedThumbnail = thumbIdx),
                              onToggleFavorite: () =>
                                  setState(() => _isFavorite = !_isFavorite),
                              onFullscreenImage: () => _openFullscreenImage(item),
                              onIncrementQty: () {
                                int val = int.tryParse(_qtyCtrl.text) ?? 1;
                                setState(() => _qtyCtrl.text = '${val + 1}');
                              },
                              onDecrementQty: () {
                                int val = int.tryParse(_qtyCtrl.text) ?? 1;
                                if (val > 1) {
                                  setState(() => _qtyCtrl.text = '${val - 1}');
                                }
                              },
                              onEditProduct: () => _onEditProduct(item),
                            );
                          },
                        )),
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
}
