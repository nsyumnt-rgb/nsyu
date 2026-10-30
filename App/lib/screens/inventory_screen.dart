import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/catalog_provider.dart';
import '../widgets/animated_feedback_dialog.dart';
import '../models/catalog_item.dart';
import '../widgets/app_bottom_nav.dart';
import 'edit_product_screen.dart';
import 'order_cart_screen.dart';

/// Product Catalog & Inventory Screen matching Reference Image:
/// - Exact Forest Green Header (#006837) with Product Catalog, Barcode, + Add Product, Cart (3)
/// - Integrated Search bar with in-field barcode scanner and Filter button
/// - Horizontal Category Pills: All (125), Mobile Accessories, Chargers, Cables, Stationery, Others
/// - Rich Product Card: Image with fullscreen expander, 3 interactive thumbnails, In Stock badge, Code badge,
///   Key Metrics (STD. P KG. 20 | QTY. 10), Pricing row (Price ₹67.00, Margin 10.00, SLPrice ₹77.00),
///   Quantity input with clear button, Add to Cart button, Product Description card, and Pager (< 1 of 125 >)
/// - Seamless View Mode toggle to switch between Card Catalog and Spreadsheet Table
class InventoryScreen extends StatefulWidget {
  final ValueChanged<int>? onNavigate;

  const InventoryScreen({super.key, this.onNavigate});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _qtyCtrl = TextEditingController(text: '1');
  final NumberFormat _money = NumberFormat('#,##0.00');

  String _selectedCategory = 'All (125)';
  int _currentIndex = 0;
  int _selectedThumbnail = 0; // 0: White front, 1: Black front, 2: Side USB
  bool _isFavorite = false;
  bool _isTableView = false; // Toggle between Card Catalog and Spreadsheet Table

  late List<_CatalogItem> _catalog;

  @override
  void initState() {
    super.initState();
    _catalog = _buildSeedProducts();

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

  List<_CatalogItem> get _filteredCatalog {
    final query = _searchCtrl.text.toLowerCase().trim();
    return _catalog.where((item) {
      if (query.isNotEmpty) {
        final matches = item.name.toLowerCase().contains(query) ||
            item.code.toLowerCase().contains(query) ||
            item.specs.toLowerCase().contains(query) ||
            item.category.toLowerCase().contains(query) ||
            item.brand.toLowerCase().contains(query);
        if (!matches) return false;
      }

      if (_selectedCategory == 'Mobile Accessories') {
        return item.category == 'Mobile Accessories';
      } else if (_selectedCategory == 'Chargers') {
        return item.category == 'Chargers' || item.category == 'Mobile Accessories';
      } else if (_selectedCategory == 'Cables') {
        return item.category == 'Cables';
      } else if (_selectedCategory == 'Stationery') {
        return item.category == 'Stationery';
      } else if (_selectedCategory == 'Others') {
        return item.category == 'Others' || item.category == 'Computers';
      }
      return true;
    }).toList();
  }

  void _onCategorySelected(String cat) {
    setState(() {
      _selectedCategory = cat;
      _currentIndex = 0;
      _selectedThumbnail = 0;
    });
  }

  void _goToPrevProduct(int total) {
    if (total == 0) return;
    setState(() {
      _currentIndex = (_currentIndex - 1 + total) % total;
      _qtyCtrl.text = '1';
    });
  }

  void _goToNextProduct(int total) {
    if (total == 0) return;
    setState(() {
      _currentIndex = (_currentIndex + 1) % total;
      _qtyCtrl.text = '1';
    });
  }

  void _showAddProductDialog() async {
    final newItem = await Navigator.push<CatalogItem>(
      context,
      MaterialPageRoute(
        builder: (_) => const EditProductScreen(isNew: true),
      ),
    );
    if (newItem != null) {
      setState(() {
        _catalog.insert(0, newItem);
        _currentIndex = 0;
      });
      if (mounted) {
        AppToast.showSuccess(context, title: 'Product Added', subtitle: '${newItem.name} added to catalog.');
      }
    }
  }

  void _openFilterSheet() {
    final categories = ['All (125)', 'Mobile Accessories', 'Chargers', 'Cables', 'Stationery', 'Others'];

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
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
                  const Text('Filter Products', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const SizedBox(height: 12),
              const Text('Select Category', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF64748B))),
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
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006837), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Apply Filter', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }


  Widget _buildThumbnailSquare(int idx) {
    final isSelected = _selectedThumbnail == idx;
    return InkWell(
      onTap: () => setState(() => _selectedThumbnail = idx),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 41,
        height: 41,
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? const Color(0xFF006837) : const Color(0xFFE2E8F0),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Center(
          child: Transform.scale(
            scale: 0.42,
            child: _ChargerIllustration(thumbnailIndex: idx),
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
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006837), foregroundColor: Colors.white),
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

  void _openFullscreenImage(_CatalogItem item) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 20)],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(item.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16), textAlign: TextAlign.center),
                  const SizedBox(height: 6),
                  Text('${item.code} · ${item.specs}', style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: 260,
                    height: 260,
                    child: _ChargerIllustration(thumbnailIndex: _selectedThumbnail, isLarge: true),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006837), foregroundColor: Colors.white),
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Close Preview'),
                  ),
                ],
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.black54),
                onPressed: () => Navigator.pop(ctx),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredCatalog;
    final totalItems = filtered.length;
    if (_currentIndex >= totalItems && totalItems > 0) {
      _currentIndex = 0;
    }
    final activeItem = totalItems > 0 ? filtered[_currentIndex] : null;

    final categories = ['All (125)', 'Mobile Accessories', 'Chargers', 'Cables', 'Stationery', 'Others'];

    // Provider cart count
    final cartCount = context.watch<CatalogProvider>().billCount;
    final badgeNumber = cartCount > 0 ? cartCount : 3; // Show 3 from screenshot if cart empty

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            // =========================================================================
            // 1. TOP HEADER & APPBAR (DEEP GREEN #006837 matching screenshot)
            // =========================================================================
            Container(
              color: const Color(0xFF006837),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 12),
                  child: Column(
                    children: [
                      // Top Row: Back, Icon, Title, Actions
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.arrow_back, color: Colors.white, size: 24),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                            onPressed: () {
                              if (widget.onNavigate != null) {
                                widget.onNavigate!(0); // Navigate to Ledger
                              } else {
                                Navigator.of(context).maybePop();
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
                                  'Inventory',
                                  style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800, color: Colors.white),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  'All Products (${_catalog.length})',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.white70),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),

                          // View Mode Toggle (Card ↔ Table)
                          IconButton(
                            icon: Icon(
                              _isTableView ? Icons.view_carousel_outlined : Icons.table_chart_outlined,
                              color: Colors.white70,
                              size: 20,
                            ),
                            tooltip: _isTableView ? 'Switch to Card View' : 'Switch to Table View',
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                            onPressed: () => setState(() => _isTableView = !_isTableView),
                          ),

                          // Barcode Scanner in Header
                          IconButton(
                            icon: const Icon(Icons.qr_code_scanner, color: Colors.white, size: 22),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                            onPressed: _openBarcodeDialog,
                          ),
                          const SizedBox(width: 4),

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
                          const SizedBox(width: 4),

                          // Cart Icon with Red Badge (3)
                          InkWell(
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                              );
                            },
                            borderRadius: BorderRadius.circular(20),
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                const Padding(
                                  padding: EdgeInsets.all(6),
                                  child: Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 24),
                                ),
                                Positioned(
                                  top: 1,
                                  right: 1,
                                  child: Container(
                                    width: 17,
                                    height: 17,
                                    decoration: const BoxDecoration(
                                      color: Color(0xFFEF4444),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Center(
                                      child: Text(
                                        '$badgeNumber',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
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
                                  Icon(Icons.filter_alt_outlined, size: 17, color: Color(0xFF006837)),
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

            // =========================================================================
            // 2. HORIZONTAL CATEGORY CHIPS
            // =========================================================================
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
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFF006837) : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isSelected ? const Color(0xFF006837) : const Color(0xFFE2E8F0),
                              width: 1,
                            ),
                          ),
                          child: Text(
                            cat,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                              color: isSelected ? Colors.white : const Color(0xFF334155),
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

            // =========================================================================
            // 3. MAIN BODY (CARD VIEW matching reference screenshot, OR TABLE VIEW)
            // =========================================================================
            Expanded(
              child: _isTableView
                  ? _buildSpreadsheetTable(filtered)
                  : (activeItem == null
                      ? _buildEmptyState()
                      : _buildProductCatalogCard(activeItem, totalItems)),
            ),
          ],
        ),
      ),
      bottomNavigationBar: widget.onNavigate != null
          ? AppBottomNav(currentIndex: 2, onTap: widget.onNavigate!)
          : null,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRODUCT CATALOG CARD matching Reference Image
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildProductCatalogCard(_CatalogItem item, int totalItems) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Section 1: Top Image & Key Details Row ──
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Left Column: Clean Product Image Container with 3 Thumbnail strip (matching Screenshot 1 panel 2)
                SizedBox(
                  width: 135,
                  child: Column(
                    children: [
                      // Main Product Image with Fullscreen/Expand icon
                      Container(
                        width: 135,
                        height: 135,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Stack(
                          children: [
                            Center(
                              child: _ChargerIllustration(thumbnailIndex: _selectedThumbnail),
                            ),
                            Positioned(
                              top: 6,
                              right: 6,
                              child: InkWell(
                                onTap: () => _openFullscreenImage(item),
                                borderRadius: BorderRadius.circular(4),
                                child: Container(
                                  padding: const EdgeInsets.all(3),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.85),
                                    borderRadius: BorderRadius.circular(4),
                                    border: Border.all(color: const Color(0xFFCBD5E1), width: 0.6),
                                  ),
                                  child: const Icon(
                                    Icons.crop_free,
                                    size: 14,
                                    color: Color(0xFF334155),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Row of 3 Thumbnails
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildThumbnailSquare(0),
                          _buildThumbnailSquare(1),
                          _buildThumbnailSquare(2),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),

                // Right Column: In Stock badge, Heart, Code, Title, Specs, Meta
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // In Stock & Favorite Row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFF10B981)),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.inventory_2_outlined, color: Color(0xFF059669), size: 12),
                                SizedBox(width: 4),
                                Text(
                                  'In Stock',
                                  style: TextStyle(
                                    color: Color(0xFF059669),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          InkWell(
                            onTap: () => setState(() => _isFavorite = !_isFavorite),
                            child: Icon(
                              _isFavorite ? Icons.favorite : Icons.favorite_border_rounded,
                              color: _isFavorite ? Colors.red : const Color(0xFF334155),
                              size: 21,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 7),

                      // Code Badge (TC001)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFF334155),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          item.code,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),

                      // Title
                      Text(
                        item.name,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          height: 1.25,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),

                      // Subtitle / Specs
                      Text(
                        item.specs,
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Meta Table
                      _buildMetaRow('Category', item.category, hasChevron: true),
                      const SizedBox(height: 4),
                      _buildMetaRow('Brand', item.brand),
                      const SizedBox(height: 4),
                      _buildMetaRow('Unit', item.unit),
                      const SizedBox(height: 4),
                      _buildMetaRow('HSN/SAC', item.hsnSac),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // ── Section 2: Key Metrics Box (STD. P KG. & QTY.) ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFDCFCE7)),
              ),
              child: Row(
                children: [
                  // STD. P KG.
                  Expanded(
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.lock_outline, color: Color(0xFF1E293B), size: 19),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'STD. P KG.',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF64748B),
                              ),
                            ),
                            Text(
                              '${item.stdPkg}',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Container(width: 1, height: 34, color: const Color(0xFFDCFCE7)),

                  // QTY.
                  Expanded(
                    child: Row(
                      children: [
                        const SizedBox(width: 12),
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.all_inbox_rounded, color: Color(0xFF1E293B), size: 19),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'QTY.',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF64748B),
                              ),
                            ),
                            Text(
                              '${item.qty}',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF15803D),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // ── Section 3: Pricing & Margin Columns matching Reference Image ──
            // Order: Price (Incl. GST) [Blue] -> Margin [Dark] -> SLPrice [Green]
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // 1. Price (Incl. GST) (Left - Royal Blue #1D4ED8)
                  Row(
                    children: [
                      const Icon(Icons.local_offer_outlined, color: Color(0xFF1E293B), size: 20),
                      const SizedBox(width: 6),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Price\n(Incl. GST)',
                            style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF64748B), height: 1.15),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '₹${_money.format(item.price)}',
                            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF1D4ED8)),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // 2. Margin (Middle - Dark Slate)
                  Row(
                    children: [
                      const Icon(Icons.trending_up, color: Color(0xFF1E293B), size: 21),
                      const SizedBox(width: 6),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Margin',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            item.margin,
                            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // 3. SLPrice (Right - Green #15803D)
                  Row(
                    children: [
                      const Icon(Icons.savings_outlined, color: Color(0xFF1E293B), size: 21),
                      const SizedBox(width: 6),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'SLPrice',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '₹${_money.format(item.slPrice)}',
                            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF15803D)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // ── Section 4: Action Row (Quantity Stepper + Big Green Edit Button) matching Screen 2 ──
            Row(
              children: [
                // "Quantity" label
                const Text(
                  'Quantity',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF334155),
                  ),
                ),
                const SizedBox(width: 8),

                // Stepper [ —  1  + ]
                Container(
                  height: 38,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      InkWell(
                        onTap: () {
                          int val = int.tryParse(_qtyCtrl.text) ?? 1;
                          if (val > 1) {
                            setState(() => _qtyCtrl.text = '${val - 1}');
                          }
                        },
                        borderRadius: const BorderRadius.horizontal(left: Radius.circular(8)),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          child: Icon(Icons.remove, size: 16, color: Color(0xFF334155)),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Text(
                          _qtyCtrl.text.isNotEmpty ? _qtyCtrl.text : '1',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: () {
                          int val = int.tryParse(_qtyCtrl.text) ?? 1;
                          setState(() => _qtyCtrl.text = '${val + 1}');
                        },
                        borderRadius: const BorderRadius.horizontal(right: Radius.circular(8)),
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          child: Icon(Icons.add, size: 16, color: Color(0xFF334155)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // Big Green Edit Button matching Reference Image Screen 2
                Expanded(
                  child: SizedBox(
                    height: 42,
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      label: const Text(
                        'Edit',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF006837),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () async {
                        final updated = await Navigator.push<CatalogItem>(
                          context,
                          MaterialPageRoute(
                            builder: (_) => EditProductScreen(item: item),
                          ),
                        );
                        if (updated != null) {
                          setState(() {
                            _catalog[_currentIndex] = updated;
                          });
                          if (mounted) {
                            AppToast.showSuccess(context, title: 'Product Updated', subtitle: '${updated.name} details saved.');
                          }
                        }
                      },
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // ── Section 5: Product Description Card ──
            InkWell(
              onTap: () async {
                final updated = await Navigator.push<CatalogItem>(
                  context,
                  MaterialPageRoute(
                    builder: (_) => EditProductScreen(item: item),
                  ),
                );
                if (updated != null) {
                  setState(() {
                    _catalog[_currentIndex] = updated;
                  });
                  if (mounted) {
                    AppToast.showSuccess(context, title: 'Product Updated', subtitle: '${updated.name} details saved.');
                  }
                }
              },
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.description_outlined, color: Color(0xFF64748B), size: 17),
                        SizedBox(width: 6),
                        Text(
                          'Product Description',
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                        ),
                        Spacer(),
                        Icon(Icons.chevron_right, color: Color(0xFF64748B), size: 17),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      item.description,
                      style: const TextStyle(fontSize: 11.5, color: Color(0xFF475569), height: 1.35),
                    ),
                  ],
                ),
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
            const Text('No products match your search/filter.', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
            const SizedBox(height: 6),
            TextButton(
              onPressed: () {
                _searchCtrl.clear();
                _onCategorySelected('All (125)');
              },
              child: const Text('Reset Filters', style: TextStyle(color: Color(0xFF006837), fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SPREADSHEET TABLE VIEW (Toggleable alternate view)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildSpreadsheetTable(List<_CatalogItem> items) {
    return SingleChildScrollView(
      scrollDirection: Axis.vertical,
      padding: const EdgeInsets.only(bottom: 80),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SizedBox(
          width: 980,
          child: Column(
            children: [
              Container(
                color: const Color(0xFF006837),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                child: const Row(
                  children: [
                    SizedBox(width: 36, child: Text('S.No.', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
                    SizedBox(width: 75, child: Text('Code No.', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
                    SizedBox(width: 230, child: Text('Product Description', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
                    SizedBox(width: 140, child: Text('Voltage/Amp/Type', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
                    SizedBox(width: 75, child: Center(child: Text('STD. P\r\nKG.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10)))),
                    SizedBox(width: 60, child: Center(child: Text('QTY.', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)))),
                    SizedBox(width: 110, child: Center(child: Text('Price\r\n(Incl. GST)', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10)))),
                    SizedBox(width: 70, child: Center(child: Text('Margin', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)))),
                    SizedBox(width: 90, child: Center(child: Text('SLPrice', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)))),
                    SizedBox(width: 40, child: Center(child: Icon(Icons.edit_outlined, color: Colors.white, size: 16))),
                  ],
                ),
              ),
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: items.length,
                separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                itemBuilder: (ctx, i) {
                  final it = items[i];
                  return Container(
                    color: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    child: Row(
                      children: [
                        SizedBox(width: 36, child: Text('${it.sNo}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)))),
                        SizedBox(width: 75, child: Text(it.code, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold))),
                        SizedBox(
                          width: 230,
                          child: Text(it.name, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
                        ),
                        SizedBox(width: 140, child: Text(it.specs, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)))),
                        SizedBox(width: 75, child: Center(child: Text('${it.stdPkg}', style: const TextStyle(fontSize: 11.5)))),
                        SizedBox(width: 60, child: Center(child: Text('${it.qty}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)))),
                        SizedBox(width: 110, child: Center(child: Text('₹${_money.format(it.price)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))))),
                        SizedBox(width: 70, child: Center(child: Text(it.margin, style: const TextStyle(fontSize: 11.5)))),
                        SizedBox(width: 90, child: Center(child: Text('₹${_money.format(it.slPrice)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF16A34A))))),
                        SizedBox(
                          width: 40,
                          child: Center(
                            child: InkWell(
                              onTap: () {
                                setState(() {
                                  _currentIndex = i;
                                  _isTableView = false;
                                });
                              },
                              child: const Icon(Icons.visibility_outlined, size: 18, color: Color(0xFF006837)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 125 SEED PRODUCTS matching screenshot exactly
  // ──────────────────────────────────────────────────────────────────────────
  List<_CatalogItem> _buildSeedProducts() {
    final list = <_CatalogItem>[
      _CatalogItem(
        sNo: 1,
        code: 'TC001',
        name: 'ERD TC-30 USB-A DOCK CHARGER BLK',
        specs: '5V DC - 500mA (2.5W)',
        stdPkg: 20,
        qty: 10,
        price: 67.0,
        margin: '10.00',
        slPrice: 77.0,
        category: 'Mobile Accessories',
        brand: 'ERD',
        unit: 'PCS',
        hsnSac: '8504',
        description: 'ERD TC-30 USB-A Dock Charger. 5V DC - 500mA (2.5W). Suitable for mobile phones and other devices.',
      ),
      _CatalogItem(
        sNo: 2,
        code: 'TC-201B',
        name: 'ERD TC-201 USB-A DOCK CHARGER BLK 5W',
        specs: '5V DC - 1 Amp (5W)',
        stdPkg: 20,
        qty: 5,
        price: 76.0,
        margin: '10.00',
        slPrice: 86.0,
        category: 'Chargers',
        brand: 'ERD',
        unit: 'PCS',
        hsnSac: '8504',
        description: 'ERD TC-201 USB-A Dock Charger Black. 5V DC - 1 Amp (5W). Compact and reliable mobile charging dock.',
      ),
      _CatalogItem(
        sNo: 3,
        code: 'TC-201',
        name: 'ERD TC-201 USB-A DOCK CHARGER WHT 5W',
        specs: '5V DC - 1 Amp (5W)',
        stdPkg: 60,
        qty: 3,
        price: 76.0,
        margin: '10.00',
        slPrice: 86.0,
        category: 'Chargers',
        brand: 'ERD',
        unit: 'PCS',
        hsnSac: '8504',
        description: 'ERD TC-201 USB-A Dock Charger White. Fast 5W charging output with surge protection.',
      ),
      _CatalogItem(
        sNo: 4,
        code: 'TC-201M',
        name: 'ERD TC-201 CHARGER+MICRO USB WHT 5W',
        specs: '5V DC - 1 Amp (5W)',
        stdPkg: 60,
        qty: 2,
        price: 116.0,
        margin: '15.00',
        slPrice: 131.0,
        category: 'Chargers',
        brand: 'ERD',
        unit: 'SET',
        hsnSac: '8504',
        description: 'ERD TC-201 Charger combo pack with dedicated high durability Micro-USB charging cable.',
      ),
      _CatalogItem(
        sNo: 5,
        code: 'TC-202B',
        name: 'ERD TC-202 USB-A DOCK CHARGER BLK 10W',
        specs: '5V DC - 2 Amp (10W)',
        stdPkg: 20,
        qty: 8,
        price: 92.0,
        margin: '10.00',
        slPrice: 102.0,
        category: 'Chargers',
        brand: 'ERD',
        unit: 'PCS',
        hsnSac: '8504',
        description: 'ERD TC-202 Dual Port 10W Charger Black. Smart IC overvoltage protection.',
      ),
      _CatalogItem(
        sNo: 6,
        code: 'TC-202',
        name: 'ERD TC-202 USB-A DOCK CHARGER WHT 10W',
        specs: '5V DC - 2 Amp (10W)',
        stdPkg: 60,
        qty: 4,
        price: 92.0,
        margin: '10.00',
        slPrice: 102.0,
        category: 'Chargers',
        brand: 'ERD',
        unit: 'PCS',
        hsnSac: '8504',
        description: 'ERD TC-202 10W Fast Charging Wall Adapter in glossy white.',
      ),
      _CatalogItem(
        sNo: 7,
        code: 'TC-203',
        name: 'ERD TC-203 FAST CHARGER BLK 20W',
        specs: '5V DC - 3 Amp (20W)',
        stdPkg: 30,
        qty: 6,
        price: 180.0,
        margin: '22.00',
        slPrice: 202.0,
        category: 'Chargers',
        brand: 'ERD',
        unit: 'PCS',
        hsnSac: '8504',
        description: 'ERD 20W Quick Charge 3.0 Adapter for Android and iOS smartphones.',
      ),
      _CatalogItem(
        sNo: 8,
        code: 'TC-203W',
        name: 'ERD TC-203 FAST CHARGER WHT 20W',
        specs: '5V DC - 3 Amp (20W)',
        stdPkg: 30,
        qty: 6,
        price: 180.0,
        margin: '22.00',
        slPrice: 202.0,
        category: 'Chargers',
        brand: 'ERD',
        unit: 'PCS',
        hsnSac: '8504',
        description: 'ERD 20W Quick Charge 3.0 Adapter White. BIS certified fire-retardant body.',
      ),
      _CatalogItem(
        sNo: 9,
        code: 'CA-001',
        name: 'USB Type-C Fast Charging Cable',
        specs: '3A - 1 Meter',
        stdPkg: 100,
        qty: 10,
        price: 120.0,
        margin: '12.00',
        slPrice: 132.0,
        category: 'Cables',
        brand: 'ERD',
        unit: 'PCS',
        hsnSac: '8544',
        description: 'Nylon braided high-speed 3A Type-C fast charging and 480Mbps data sync cable.',
      ),
      _CatalogItem(
        sNo: 10,
        code: 'CA-002',
        name: 'USB Type-C Fast Charging Cable (2 Meter)',
        specs: '3A - 2 Meter',
        stdPkg: 50,
        qty: 5,
        price: 180.0,
        margin: '18.00',
        slPrice: 198.0,
        category: 'Cables',
        brand: 'ERD',
        unit: 'PCS',
        hsnSac: '8544',
        description: 'Extra-long 2-meter 3A heavy-duty copper core cable for bedside and desk convenience.',
      ),
    ];

    // Populate remaining up to 125 items to exactly match "All Products (125)"
    for (int i = 11; i <= 125; i++) {
      final isCable = i % 3 == 0;
      final isStationery = i % 5 == 0;
      final isOthers = i % 7 == 0;

      String cat = 'Chargers';
      String code = 'TC-${100 + i}';
      String name = 'ERD TC-${100 + i} POWER ADAPTER';
      String specs = '${(i % 4 + 1) * 5}W Multi-Port Fast Charger';
      double p = 70.0 + (i * 2.5 % 150);
      double m = 10.0 + (i % 15);

      if (isCable) {
        cat = 'Cables';
        code = 'CA-${100 + i}';
        name = 'ERD Type-C to Lightning Cable ${i % 2 == 0 ? "1M" : "1.5M"}';
        specs = 'PD 20W Fast Charging';
      } else if (isStationery) {
        cat = 'Stationery';
        code = 'ST-${200 + i}';
        name = 'Thermal Billing Paper Roll 80mm';
        specs = 'Grade A Thermal Paper';
        p = 45.0;
        m = 10.0;
      } else if (isOthers) {
        cat = 'Others';
        code = 'OT-${300 + i}';
        name = 'Mobile Phone Desktop Stand Metal';
        specs = '360° Rotatable Aluminum Stand';
        p = 150.0;
        m = 35.0;
      }

      list.add(
        _CatalogItem(
          sNo: i,
          code: code,
          name: name,
          specs: specs,
          stdPkg: 20 + (i % 4) * 10,
          qty: 5 + (i % 15),
          price: p,
          margin: m.toStringAsFixed(2),
          slPrice: p + m,
          category: cat,
          brand: 'ERD',
          unit: 'PCS',
          hsnSac: '8504',
          description: '$name ($specs). Built with smart protection against heat, short circuit, and voltage fluctuations.',
        ),
      );
    }

    return list;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// PRODUCT MODEL HELPER
// ────────────────────────────────────────────────────────────────────────────
typedef _CatalogItem = CatalogItem;

// ────────────────────────────────────────────────────────────────────────────
// CHARGER ILLUSTRATION WIDGET matching ERD TC-30 in Reference Image
// ────────────────────────────────────────────────────────────────────────────
class _ChargerIllustration extends StatelessWidget {
  final int thumbnailIndex; // 0: White front, 1: Black front, 2: Side USB-A
    final bool isLarge;

  const _ChargerIllustration({
    this.thumbnailIndex = 0,
        this.isLarge = false,
  });

  @override
  Widget build(BuildContext context) {
    final scale = isLarge ? 2.2 : 1.25;
    final isBlack = thumbnailIndex == 1;
    final isSideView = thumbnailIndex == 2;

    return Center(
      child: Transform.scale(
        scale: scale,
        child: SizedBox(
          width: 100,
          height: 100,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Metal AC Prongs
              if (!isSideView) ...[
                Positioned(
                  top: 8,
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
                  top: 8,
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
              ],

              // Main Charger Body Block
              Positioned(
                top: 22,
                child: Container(
                  width: 72,
                  height: 68,
                  decoration: BoxDecoration(
                    color: isBlack ? const Color(0xFF1E293B) : Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isBlack ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: isBlack ? 0.25 : 0.08),
                        blurRadius: 8,
                        offset: const Offset(2, 4),
                      ),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Side perspective shade
                      if (!isSideView)
                        Positioned(
                          right: 0,
                          top: 0,
                          bottom: 0,
                          child: Container(
                            width: 12,
                            decoration: BoxDecoration(
                              color: isBlack ? Colors.black26 : const Color(0xFFF1F5F9),
                              borderRadius: const BorderRadius.only(
                                topRight: Radius.circular(8),
                                bottomRight: Radius.circular(8),
                              ),
                            ),
                          ),
                        ),

                      if (isSideView) ...[
                        // USB-A Port on Face
                        Container(
                          width: 28,
                          height: 14,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: Center(
                            child: Container(
                              width: 18,
                              height: 5,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ] else ...[
                        // "ERD" Logo Printed on Face
                        Padding(
                          padding: const EdgeInsets.only(top: 8, right: 6),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'ERD',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                  color: isBlack ? Colors.white : const Color(0xFF0F172A),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
