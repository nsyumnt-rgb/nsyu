import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/customer_portal_provider.dart';
import '../../services/customer_portal_service.dart';

class PortalCatalogScreen extends StatefulWidget {
  const PortalCatalogScreen({super.key});

  @override
  State<PortalCatalogScreen> createState() => _PortalCatalogScreenState();
}

class _PortalCatalogScreenState extends State<PortalCatalogScreen> {
  final CustomerPortalService _service = CustomerPortalService();
  final TextEditingController _searchCtrl = TextEditingController();

  List<Map<String, dynamic>> _categories = [];
  int? _selectedCategoryId;
  List<Map<String, dynamic>> _products = [];
  bool _loading = true;
  int _page = 1;
  int _totalPages = 1;

  @override
  void initState() {
    super.initState();
    _loadCategories();
    _loadProducts();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCategories() async {
    try {
      final cats = await _service.getCategories();
      if (mounted) setState(() => _categories = cats);
    } catch (_) {}
  }

  Future<void> _loadProducts() async {
    setState(() => _loading = true);
    try {
      final res = await _service.getProducts(
        search: _searchCtrl.text.trim().isNotEmpty ? _searchCtrl.text.trim() : null,
        categoryId: _selectedCategoryId,
        page: _page,
        limit: 100,
      );
      if (mounted) {
        final list = (res['data'] as List<dynamic>?)?.map((e) => e as Map<String, dynamic>).toList() ?? [];
        final pagination = (res['pagination'] ?? res['meta']) as Map<String, dynamic>?;
        setState(() {
          _products = list;
          _totalPages = (pagination?['pages'] ?? pagination?['totalPages'] as num?)?.toInt() ?? 1;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _products = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showProductDetails(Map<String, dynamic> prod) {
    final portal = context.read<CustomerPortalProvider>();
    final prodId = (prod['id'] as num).toInt();
    final name = prod['name']?.toString() ?? prod['desc']?.toString() ?? 'Product';
    final sku = prod['sku']?.toString() ?? prod['code']?.toString() ?? 'N/A';
    final brand = prod['brand']?.toString();
    final desc = prod['description']?.toString() ?? prod['spec']?.toString() ?? 'No description available.';
    final catName = (prod['category'] is Map ? prod['category']['name'] : null)?.toString() ??
        prod['categoryName']?.toString() ??
        brand ??
        'General';
    final pricing = prod['pricing'] as Map<String, dynamic>?;
    final price = ((prod['sellingPrice'] ??
            prod['selling_price'] ??
            prod['price'] ??
            pricing?['sellingPriceInclTax'] ??
            pricing?['unitPrice'] ??
            0) as num)
        .toDouble();
    final gst = ((prod['gstPercent'] ?? pricing?['gstPercent'] ?? 0) as num).toDouble();
    final inv = prod['inventory'] as Map<String, dynamic>?;
    final stock = ((prod['stock'] ??
            prod['stockQuantity'] ??
            prod['availableStock'] ??
            inv?['availableStock'] ??
            1) as num)
        .toInt();

    String? imageUrl = prod['imageUrl']?.toString();
    if (imageUrl == null || imageUrl.isEmpty) {
      final images = prod['images'] as List<dynamic>?;
      if (images != null && images.isNotEmpty) {
        imageUrl = images[0] is Map ? images[0]['url']?.toString() : images[0]?.toString();
      }
    }

    int selectedQty = portal.getItemQuantityInCart(prodId);
    if (selectedQty <= 0) selectedQty = stock > 0 ? 1 : 0;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 28,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDBEAFE),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        catName.toUpperCase(),
                        style: const TextStyle(color: Color(0xFF1D4ED8), fontSize: 10.5, fontWeight: FontWeight.bold),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Image
                Container(
                  height: 180,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: imageUrl != null && imageUrl.isNotEmpty
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(16),
                          child: Image.network(imageUrl, fit: BoxFit.contain),
                        )
                      : const Center(
                          child: Icon(Icons.image_outlined, size: 64, color: Color(0xFF94A3B8)),
                        ),
                ),
                const SizedBox(height: 16),

                // Title & SKU
                Text(
                  name,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Text('SKU: $sku', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                    const SizedBox(width: 12),
                    _buildStockBadge(stock),
                  ],
                ),
                const SizedBox(height: 12),

                // Price
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      '₹${price.toStringAsFixed(2)}',
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF1D4ED8)),
                    ),
                    if (gst > 0) ...[
                      const SizedBox(width: 8),
                      Text(
                        'Incl. ${gst.toStringAsFixed(0)}% GST',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 14),

                // Description
                const Text(
                  'Product Details',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 4),
                Text(
                  desc,
                  style: const TextStyle(fontSize: 12, color: Color(0xFF475569), height: 1.4),
                ),
                const SizedBox(height: 20),

                // Quantity & Add to Cart
                if (stock > 0) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Quantity:',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                      ),
                      Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove, size: 18),
                              onPressed: selectedQty > 1
                                  ? () => setSheetState(() => selectedQty--)
                                  : null,
                            ),
                            Text(
                              '$selectedQty',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            IconButton(
                              icon: const Icon(Icons.add, size: 18),
                              onPressed: selectedQty < stock
                                  ? () => setSheetState(() => selectedQty++)
                                  : null,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1D4ED8),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.add_shopping_cart, size: 18),
                    label: Text(
                      'Add $selectedQty to Cart (₹${(price * selectedQty).toStringAsFixed(2)})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    onPressed: () async {
                      Navigator.pop(ctx);
                      try {
                        await portal.setCartItem(prodId, selectedQty);
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Added $selectedQty unit(s) of $name to cart.'),
                            backgroundColor: const Color(0xFF16A34A),
                          ),
                        );
                      } catch (err) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Error: $err'), backgroundColor: const Color(0xFFDC2626)),
                        );
                      }
                    },
                  ),
                ] else ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Center(
                      child: Text(
                        'Currently Out of Stock',
                        style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final portal = context.watch<CustomerPortalProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D4ED8),
        elevation: 0,
        title: const Text(
          'Shop Product Catalog',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          // Search & Filter Box
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              children: [
                TextField(
                  controller: _searchCtrl,
                  onChanged: (val) {
                    setState(() => _page = 1);
                    _loadProducts();
                  },
                  decoration: InputDecoration(
                    hintText: 'Search product name or SKU...',
                    hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                    prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
                    suffixIcon: _searchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _page = 1);
                              _loadProducts();
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
                ),
                const SizedBox(height: 8),

                // Category Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: const Text('All Categories'),
                          selected: _selectedCategoryId == null,
                          onSelected: (selected) {
                            setState(() {
                              _selectedCategoryId = null;
                              _page = 1;
                            });
                            _loadProducts();
                          },
                          selectedColor: const Color(0xFF1D4ED8),
                          backgroundColor: Colors.white,
                          labelStyle: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.bold,
                            color: _selectedCategoryId == null ? Colors.white : const Color(0xFF475569),
                          ),
                        ),
                      ),
                      ..._categories.map((cat) {
                        final id = (cat['id'] as num).toInt();
                        final name = cat['name']?.toString() ?? '';
                        final isSel = _selectedCategoryId == id;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text(name),
                            selected: isSel,
                            onSelected: (selected) {
                              setState(() {
                                _selectedCategoryId = selected ? id : null;
                                _page = 1;
                              });
                              _loadProducts();
                            },
                            selectedColor: const Color(0xFF1D4ED8),
                            backgroundColor: Colors.white,
                            labelStyle: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.bold,
                              color: isSel ? Colors.white : const Color(0xFF475569),
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Products List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF1D4ED8)))
                : _products.isEmpty
                    ? const Center(
                        child: Text(
                          'No active products found matching your search.',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        ),
                      )
                    : RefreshIndicator(
                        color: const Color(0xFF1D4ED8),
                        onRefresh: _loadProducts,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: _products.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, idx) {
                            final prod = _products[idx];
                            final prodId = (prod['id'] as num).toInt();
                            final name = prod['name']?.toString() ?? prod['desc']?.toString() ?? 'Product';
                            final sku = prod['sku']?.toString() ?? prod['code']?.toString() ?? '';
                            final brand = prod['brand']?.toString() ?? (prod['category'] is Map ? prod['category']['name']?.toString() : null) ?? prod['categoryName']?.toString();
                            final pricing = prod['pricing'] as Map<String, dynamic>?;
                            final price = ((prod['sellingPrice'] ??
                                    prod['selling_price'] ??
                                    prod['price'] ??
                                    pricing?['sellingPriceInclTax'] ??
                                    pricing?['unitPrice'] ??
                                    0) as num)
                                .toDouble();
                            final gst = ((prod['gstPercent'] ?? pricing?['gstPercent'] ?? 0) as num).toDouble();
                            final inv = prod['inventory'] as Map<String, dynamic>?;
                            final stock = ((prod['stock'] ??
                                    prod['stockQuantity'] ??
                                    prod['availableStock'] ??
                                    inv?['availableStock'] ??
                                    1) as num)
                                .toInt();

                            String? imageUrl = prod['imageUrl']?.toString();
                            if (imageUrl == null || imageUrl.isEmpty) {
                              final images = prod['images'] as List<dynamic>?;
                              if (images != null && images.isNotEmpty) {
                                imageUrl = images[0] is Map ? images[0]['url']?.toString() : images[0]?.toString();
                              }
                            }

                            final qtyInCart = portal.getItemQuantityInCart(prodId);

                            return InkWell(
                              onTap: () => _showProductDetails(prod),
                              borderRadius: BorderRadius.circular(14),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                  boxShadow: const [
                                    BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
                                  ],
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Product image
                                    Container(
                                      width: 76,
                                      height: 76,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF8FAFC),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: const Color(0xFFE2E8F0)),
                                      ),
                                      child: imageUrl != null && imageUrl.isNotEmpty
                                          ? ClipRRect(
                                              borderRadius: BorderRadius.circular(10),
                                              child: Image.network(imageUrl, fit: BoxFit.contain),
                                            )
                                          : const Icon(Icons.image_outlined, color: Color(0xFF94A3B8)),
                                    ),
                                    const SizedBox(width: 12),

                                    // Details
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              if (brand != null && brand.isNotEmpty)
                                                Text(
                                                  brand.toUpperCase(),
                                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                                )
                                              else
                                                const SizedBox.shrink(),
                                              _buildStockBadge(stock),
                                            ],
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            name,
                                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: Color(0xFF0F172A)),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 2),
                                          Text('SKU: $sku', style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
                                          const SizedBox(height: 6),

                                          Row(
                                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                            children: [
                                              Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    '₹${price.toStringAsFixed(2)}',
                                                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14.5, color: Color(0xFF0F172A)),
                                                  ),
                                                  if (gst > 0)
                                                    Text(
                                                      'Incl. ${gst.toStringAsFixed(0)}% GST',
                                                      style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8)),
                                                    ),
                                                ],
                                              ),

                                              // Cart Stepper or Add button
                                              if (qtyInCart > 0)
                                                Container(
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFDBEAFE),
                                                    borderRadius: BorderRadius.circular(8),
                                                  ),
                                                  child: Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      IconButton(
                                                        icon: const Icon(Icons.remove, size: 16, color: Color(0xFF1D4ED8)),
                                                        padding: EdgeInsets.zero,
                                                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                                        onPressed: () {
                                                          portal.setCartItem(prodId, qtyInCart - 1);
                                                        },
                                                      ),
                                                      Text(
                                                        '$qtyInCart',
                                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF1D4ED8)),
                                                      ),
                                                      IconButton(
                                                        icon: const Icon(Icons.add, size: 16, color: Color(0xFF1D4ED8)),
                                                        padding: EdgeInsets.zero,
                                                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                                        onPressed: qtyInCart < stock
                                                            ? () {
                                                                portal.setCartItem(prodId, qtyInCart + 1);
                                                              }
                                                            : null,
                                                      ),
                                                    ],
                                                  ),
                                                )
                                              else if (stock > 0)
                                                FilledButton.icon(
                                                  style: FilledButton.styleFrom(
                                                    backgroundColor: const Color(0xFF1D4ED8),
                                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                                                    minimumSize: const Size(0, 32),
                                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                  ),
                                                  icon: const Icon(Icons.add_shopping_cart, size: 14),
                                                  label: const Text('Add', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                                  onPressed: () {
                                                    portal.setCartItem(prodId, 1);
                                                  },
                                                )
                                              else
                                                const Text(
                                                  'Out of Stock',
                                                  style: TextStyle(color: Color(0xFFDC2626), fontSize: 11, fontWeight: FontWeight.bold),
                                                ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),

          if (_totalPages > 1)
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.chevron_left),
                    onPressed: _page > 1
                        ? () {
                            setState(() => _page--);
                            _loadProducts();
                          }
                        : null,
                  ),
                  Text('Page $_page of $_totalPages', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  IconButton(
                    icon: const Icon(Icons.chevron_right),
                    onPressed: _page < _totalPages
                        ? () {
                            setState(() => _page++);
                            _loadProducts();
                          }
                        : null,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  static Widget _buildStockBadge(int stock) {
    if (stock <= 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(4)),
        child: const Text('Out of Stock', style: TextStyle(color: Color(0xFFDC2626), fontSize: 9.5, fontWeight: FontWeight.bold)),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(4)),
      child: Text('$stock In Stock', style: const TextStyle(color: Color(0xFF16A34A), fontSize: 9.5, fontWeight: FontWeight.bold)),
    );
  }
}
