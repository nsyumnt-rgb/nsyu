import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/customer_portal_provider.dart';
import '../../services/customer_portal_service.dart';
import '../../theme/app_theme.dart';
import 'portal_cart_screen.dart';

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
          _totalPages = parseInt(pagination?['pages'] ?? pagination?['totalPages'], 1);
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
    final prodId = parseInt(prod['id']);
    final name = prod['name']?.toString() ?? prod['desc']?.toString() ?? 'Product';
    final sku = prod['sku']?.toString() ?? prod['code']?.toString() ?? 'N/A';
    final desc = prod['description']?.toString() ?? prod['spec']?.toString() ?? 'No description available.';
    final pricing = prod['pricing'] as Map<String, dynamic>?;
    final price = parseDouble(prod['sellingPrice'] ??
        prod['selling_price'] ??
        prod['price'] ??
        pricing?['sellingPriceInclTax'] ??
        pricing?['unitPrice']);
    final gst = parseDouble(prod['gstPercent'] ?? pricing?['gstPercent']);
    final inv = prod['inventory'] as Map<String, dynamic>?;
    final stock = parseInt(prod['stock'] ??
        prod['stockQuantity'] ??
        prod['availableStock'] ??
        inv?['availableStock'], 1);

    String? imageUrl = prod['imageUrl']?.toString();
    if (imageUrl == null || imageUrl.isEmpty) {
      final images = prod['images'] as List<dynamic>?;
      if (images != null && images.isNotEmpty) {
        imageUrl = images[0] is Map ? images[0]['url']?.toString() : images[0]?.toString();
      }
    }

    int selectedQty = 1;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Image
              Container(
                height: 180,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: AppColors.bg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: imageUrl != null && imageUrl.isNotEmpty
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.network(imageUrl, fit: BoxFit.contain),
                      )
                    : const Center(
                        child: Icon(Icons.image_outlined, size: 64, color: AppColors.textSecondary),
                      ),
              ),
              const SizedBox(height: 16),

              // Title & SKU
              Text(
                name,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.navy900),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Text('SKU: $sku', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
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
                  AmountText(
                    amount: price,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppColors.navy900,
                  ),
                  if (gst > 0) ...[
                    const SizedBox(width: 8),
                    Text(
                      'Incl. ${gst.toStringAsFixed(0)}% GST',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 14),

              // Description
              const Text(
                'Product Details',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.navy900),
              ),
              const SizedBox(height: 4),
              Text(
                desc,
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),

              // Quantity & Add to Cart
              if (stock > 0) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Quantity:',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.navy900),
                    ),
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.bg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove, size: 18, color: AppColors.navy900),
                            onPressed: selectedQty > 1
                                ? () => setSheetState(() => selectedQty--)
                                : null,
                          ),
                          Text(
                            '$selectedQty',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.navy900),
                          ),
                          IconButton(
                            icon: const Icon(Icons.add, size: 18, color: AppColors.navy900),
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
                PrimaryButton(
                  label: 'Add $selectedQty to Cart (₹${(price * selectedQty).toStringAsFixed(2)})',
                  icon: Icons.add_shopping_cart,
                  onPressed: () async {
                    Navigator.pop(ctx);
                    try {
                      await portal.setCartItem(prodId, selectedQty);
                      if (!mounted) return;
                      showAppSnackBar(context, 'Added $selectedQty unit(s) of $name to cart.');
                    } catch (err) {
                      if (!mounted) return;
                      showAppSnackBar(context, 'Error: $err', isError: true);
                    }
                  },
                ),
              ] else ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Center(
                    child: Text(
                      'Currently Out of Stock',
                      style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final portal = context.watch<CustomerPortalProvider>();
    final cartCount = portal.cartItemCount;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF04261D), Color(0xFF064E3B), Color(0xFF047857)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        elevation: 0,
        title: const Text(
          'Shop Catalog',
          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: cartCount > 0,
              label: Text('$cartCount'),
              backgroundColor: AppColors.warning,
              child: const Icon(Icons.shopping_cart_outlined, color: Colors.white),
            ),
            tooltip: 'View Cart',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const PortalCartScreen()),
              );
            },
          ),
        ],
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
                    hintStyle: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppColors.textSecondary),
                    suffixIcon: _searchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18, color: AppColors.textSecondary),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _page = 1);
                              _loadProducts();
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: AppColors.bg,
                    contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppColors.border),
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
                          selectedColor: AppColors.blue50,
                          backgroundColor: Colors.white,
                          labelStyle: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.bold,
                            color: _selectedCategoryId == null ? AppColors.navy900 : AppColors.textSecondary,
                          ),
                        ),
                      ),
                      ..._categories.map((cat) {
                        final id = parseInt(cat['id']);
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
                            selectedColor: AppColors.blue50,
                            backgroundColor: Colors.white,
                            labelStyle: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.bold,
                              color: isSel ? AppColors.navy900 : AppColors.textSecondary,
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
          const Divider(height: 1, color: AppColors.border),

          // Products List
          Expanded(
            child: _loading
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: SkeletonLoader.list(count: 6),
                  )
                : _products.isEmpty
                    ? const Center(
                        child: EmptyState(
                          icon: Icons.storefront_outlined,
                          title: 'No Products Found',
                          subtitle: 'No active products match your current search or category.',
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.blue600,
                        onRefresh: _loadProducts,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: _products.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, idx) {
                            final prod = _products[idx];
                            final prodId = parseInt(prod['id']);
                            final name = prod['name']?.toString() ?? prod['desc']?.toString() ?? 'Product';
                            final sku = prod['sku']?.toString() ?? prod['code']?.toString() ?? '';
                            final brand = prod['brand']?.toString() ?? (prod['category'] is Map ? prod['category']['name']?.toString() : null) ?? prod['categoryName']?.toString();
                            final pricing = prod['pricing'] as Map<String, dynamic>?;
                            final price = parseDouble(prod['sellingPrice'] ??
                                prod['selling_price'] ??
                                prod['price'] ??
                                pricing?['sellingPriceInclTax'] ??
                                pricing?['unitPrice']);
                            final gst = parseDouble(prod['gstPercent'] ?? pricing?['gstPercent']);
                            final inv = prod['inventory'] as Map<String, dynamic>?;
                            final stock = parseInt(prod['stock'] ??
                                prod['stockQuantity'] ??
                                prod['availableStock'] ??
                                inv?['availableStock'], 1);

                            String? imageUrl = prod['imageUrl']?.toString();
                            if (imageUrl == null || imageUrl.isEmpty) {
                              final images = prod['images'] as List<dynamic>?;
                              if (images != null && images.isNotEmpty) {
                                imageUrl = images[0] is Map ? images[0]['url']?.toString() : images[0]?.toString();
                              }
                            }

                            final qtyInCart = portal.getItemQuantityInCart(prodId);

                            return AppCard(
                              padding: const EdgeInsets.all(12),
                              onTap: () => _showProductDetails(prod),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Product image
                                  Container(
                                    width: 76,
                                    height: 76,
                                    decoration: BoxDecoration(
                                      color: AppColors.bg,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: imageUrl != null && imageUrl.isNotEmpty
                                        ? ClipRRect(
                                            borderRadius: BorderRadius.circular(10),
                                            child: Image.network(imageUrl, fit: BoxFit.contain),
                                          )
                                        : const Icon(Icons.image_outlined, color: AppColors.textSecondary),
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
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                                decoration: BoxDecoration(
                                                  color: AppColors.blue50,
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  brand.toUpperCase(),
                                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.blue600),
                                                ),
                                              )
                                            else
                                              const SizedBox.shrink(),
                                            _buildStockBadge(stock),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          name,
                                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppColors.navy900),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 2),
                                        Text('SKU: $sku', style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary)),
                                        const SizedBox(height: 6),

                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                AmountText(
                                                  amount: price,
                                                  fontSize: 15,
                                                  fontWeight: FontWeight.w800,
                                                  color: AppColors.navy900,
                                                ),
                                                if (gst > 0)
                                                  Text(
                                                    'Incl. ${gst.toStringAsFixed(0)}% GST',
                                                    style: const TextStyle(fontSize: 9.5, color: AppColors.textSecondary),
                                                  ),
                                              ],
                                            ),

                                            // Cart Stepper or Add button
                                            if (qtyInCart > 0)
                                              Container(
                                                decoration: BoxDecoration(
                                                  color: AppColors.blue50,
                                                  borderRadius: BorderRadius.circular(8),
                                                  border: Border.all(color: AppColors.blue100),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    IconButton(
                                                      icon: const Icon(Icons.remove, size: 16, color: AppColors.navy900),
                                                      padding: EdgeInsets.zero,
                                                      constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                                                      onPressed: () {
                                                        portal.setCartItem(prodId, qtyInCart - 1);
                                                      },
                                                    ),
                                                    Text(
                                                      '$qtyInCart',
                                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5, color: AppColors.navy900),
                                                    ),
                                                    IconButton(
                                                      icon: const Icon(Icons.add, size: 16, color: AppColors.navy900),
                                                      padding: EdgeInsets.zero,
                                                      constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
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
                                              ElevatedButton(
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor: AppColors.navy900,
                                                  foregroundColor: Colors.white,
                                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                  visualDensity: VisualDensity.compact,
                                                  elevation: 0,
                                                ),
                                                child: const Text('Add', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                                onPressed: () {
                                                  portal.setCartItem(prodId, 1);
                                                },
                                              )
                                            else
                                              const StatusChip(
                                                label: 'OUT OF STOCK',
                                                variant: StatusChipVariant.danger,
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

  static Widget _buildStockBadge(int stock) {
    if (stock <= 0) {
      return const StatusChip(
        label: 'Out of Stock',
        variant: StatusChipVariant.danger,
      );
    } else if (stock <= 5) {
      return StatusChip(
        label: '$stock left',
        variant: StatusChipVariant.warning,
      );
    }
    return StatusChip(
      label: '$stock in stock',
      variant: StatusChipVariant.success,
    );
  }
}
