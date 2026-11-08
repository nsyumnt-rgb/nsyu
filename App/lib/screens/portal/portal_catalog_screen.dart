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
        limit: 20,
      );
      if (mounted) {
        final list = (res['data'] as List<dynamic>?)?.map((e) => e as Map<String, dynamic>).toList() ?? [];
        final pagination = res['pagination'] as Map<String, dynamic>?;
        setState(() {
          _products = list;
          _totalPages = (pagination?['pages'] as num?)?.toInt() ?? 1;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _products = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final portal = context.watch<CustomerPortalProvider>();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF047857),
        elevation: 0,
        title: const Text(
          'Product Catalog',
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
                    hintText: 'Search product or SKU...',
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
                          label: const Text('All'),
                          selected: _selectedCategoryId == null,
                          onSelected: (selected) {
                            setState(() {
                              _selectedCategoryId = null;
                              _page = 1;
                            });
                            _loadProducts();
                          },
                          selectedColor: const Color(0xFF047857),
                          labelStyle: TextStyle(
                            fontSize: 12,
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
                            selectedColor: const Color(0xFF047857),
                            labelStyle: TextStyle(
                              fontSize: 12,
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
                ? const Center(child: CircularProgressIndicator())
                : _products.isEmpty
                    ? const Center(
                        child: Text(
                          'No products found matching your search.',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadProducts,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: _products.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, idx) {
                            final prod = _products[idx];
                            final prodId = (prod['id'] as num).toInt();
                            final name = prod['name']?.toString() ?? '';
                            final sku = prod['sku']?.toString() ?? '';
                            final brand = prod['brand']?.toString();
                            final pricing = prod['pricing'] as Map<String, dynamic>?;
                            final price = ((pricing?['sellingPriceInclTax'] ?? pricing?['unitPrice'] ?? 0) as num).toDouble();
                            final gst = ((pricing?['gstPercent'] ?? 0) as num).toDouble();
                            final inv = prod['inventory'] as Map<String, dynamic>?;
                            final stock = ((inv?['availableStock'] ?? 0) as num).toInt();

                            final images = prod['images'] as List<dynamic>?;
                            String? imageUrl;
                            if (images != null && images.isNotEmpty) {
                              imageUrl = images[0]?['url']?.toString();
                            }

                            final qtyInCart = portal.getItemQuantityInCart(prodId);

                            return Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Product image / placeholder
                                  Container(
                                    width: 70,
                                    height: 70,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF1F5F9),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFFE2E8F0)),
                                    ),
                                    child: imageUrl != null && imageUrl.isNotEmpty
                                        ? ClipRRect(
                                            borderRadius: BorderRadius.circular(8),
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
                                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                                              )
                                            else
                                              const SizedBox.shrink(),
                                            _buildStockBadge(stock),
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          name,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 2),
                                        Text('SKU: $sku', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                        const SizedBox(height: 6),

                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  '₹${price.toStringAsFixed(2)}',
                                                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF0F172A)),
                                                ),
                                                Text(
                                                  'Incl. ${gst.toStringAsFixed(0)}% GST',
                                                  style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8)),
                                                ),
                                              ],
                                            ),

                                            // Cart Stepper or Add button
                                            if (qtyInCart > 0)
                                              Container(
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFD1FAE5),
                                                  borderRadius: BorderRadius.circular(8),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    IconButton(
                                                      icon: const Icon(Icons.remove, size: 16, color: Color(0xFF047857)),
                                                      padding: EdgeInsets.zero,
                                                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                                      onPressed: () {
                                                        portal.setCartItem(prodId, qtyInCart - 1);
                                                      },
                                                    ),
                                                    Text(
                                                      '$qtyInCart',
                                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF047857)),
                                                    ),
                                                    IconButton(
                                                      icon: const Icon(Icons.add, size: 16, color: Color(0xFF047857)),
                                                      padding: EdgeInsets.zero,
                                                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                                      onPressed: () {
                                                        portal.setCartItem(prodId, qtyInCart + 1);
                                                      },
                                                    ),
                                                  ],
                                                ),
                                              )
                                            else
                                              FilledButton.icon(
                                                style: FilledButton.styleFrom(
                                                  backgroundColor: const Color(0xFF047857),
                                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                                                  minimumSize: const Size(0, 32),
                                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                ),
                                                icon: const Icon(Icons.add_shopping_cart, size: 14),
                                                label: const Text('Add', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                                onPressed: () {
                                                  portal.setCartItem(prodId, 1);
                                                },
                                              ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
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

  Widget _buildStockBadge(int stock) {
    if (stock <= 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
        decoration: BoxDecoration(color: const Color(0xFFFFE4E6), borderRadius: BorderRadius.circular(4)),
        child: const Text('Out of Stock', style: TextStyle(color: Color(0xFFBE123C), fontSize: 9, fontWeight: FontWeight.bold)),
      );
    } else if (stock <= 5) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
        decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(4)),
        child: Text('Only $stock left', style: const TextStyle(color: Color(0xFFB45309), fontSize: 9, fontWeight: FontWeight.bold)),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
      decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(4)),
      child: Text('In Stock ($stock)', style: const TextStyle(color: Color(0xFF047857), fontSize: 9, fontWeight: FontWeight.bold)),
    );
  }
}

