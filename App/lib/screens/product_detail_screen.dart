import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/catalog_item.dart';
import '../models/product.dart';
import 'edit_product_screen.dart';
import '../providers/catalog_provider.dart';
import '../utils/category_icon_helper.dart';
import '../widgets/animated_feedback_dialog.dart';
import 'bill_screen.dart';
import 'inventory_screen.dart';
import 'order_cart_screen.dart';

/// Full-page Product Details screen supporting direct reference navigation,
/// real-time stock inspection, and 1-click Add to Bill / Add to Order.
class ProductDetailScreen extends StatefulWidget {
  final Product? initialProduct;
  final String? productCode;

  const ProductDetailScreen({
    super.key,
    this.initialProduct,
    this.productCode,
  }) : assert(initialProduct != null || productCode != null,
            'Must provide either initialProduct or productCode');

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  Product? _product;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _product = widget.initialProduct;
    if (_product == null && widget.productCode != null) {
      _loadProductByCode();
    }
  }

  void _loadProductByCode() {
    setState(() {
      _loading = true;
      _error = null;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final catalog = context.read<CatalogProvider>();
      final match = catalog.products.cast<Product?>().firstWhere(
            (p) => p?.code.toLowerCase() == widget.productCode!.toLowerCase(),
            orElse: () => null,
          );

      if (match != null) {
        if (mounted) {
          setState(() {
            _product = match;
            _loading = false;
          });
        }
      } else {
        // Reload catalog once if missing
        catalog.loadProducts().then((_) {
          if (!mounted) return;
          final retryMatch = catalog.products.cast<Product?>().firstWhere(
                (p) => p?.code.toLowerCase() == widget.productCode!.toLowerCase(),
                orElse: () => null,
              );
          setState(() {
            _product = retryMatch;
            _loading = false;
            if (retryMatch == null) {
              _error = 'Product "${widget.productCode}" not found in catalog.';
            }
          });
        }).catchError((e) {
          if (!mounted) return;
          setState(() {
            _loading = false;
            _error = e.toString();
          });
        });
      }
    });
  }

  IconData _getCategoryIcon(Product p) {
    final d = '  '.toLowerCase();
    if (d.contains('earphone') || d.contains('headphone')) return Icons.headphones_rounded;
    if (d.contains('charger') || d.contains('chg')) return Icons.power_rounded;
    if (d.contains('cable') || d.contains('cbl')) return Icons.cable_rounded;
    if (d.contains('power') || d.contains('pwr')) return Icons.battery_charging_full_rounded;
    if (d.contains('case') || d.contains('cover')) return Icons.phone_android_rounded;
    if (d.contains('glass') || d.contains('screen')) return Icons.screen_lock_portrait_rounded;
    if (d.contains('holder') || d.contains('mount')) return Icons.directions_car_rounded;
    if (d.contains('earbud') || d.contains('tws')) return Icons.headset_mic_rounded;
    if (d.contains('otg') || d.contains('adapter')) return Icons.usb_rounded;
    if (d.contains('monitor')) return Icons.desktop_windows_rounded;
    if (d.contains('laptop')) return Icons.laptop_chromebook_rounded;
    return Icons.devices_other_rounded;
  }

  Color _getCategoryColor(Product p) {
    final d = '  '.toLowerCase();
    if (d.contains('earphone')) return const Color(0xFF2563EB);
    if (d.contains('charger')) return const Color(0xFFD97706);
    if (d.contains('cable')) return const Color(0xFF475569);
    if (d.contains('power')) return const Color(0xFF059669);
    if (d.contains('case')) return const Color(0xFF7C3AED);
    if (d.contains('glass')) return const Color(0xFF0891B2);
    if (d.contains('holder')) return const Color(0xFFDB2777);
    if (d.contains('earbud')) return const Color(0xFF4F46E5);
    if (d.contains('otg')) return const Color(0xFFEA580C);
    return const Color(0xFF1D4ED8);
  }

  @override
  Widget build(BuildContext context) {
    final p = _product;
    final code = widget.productCode ?? p?.code ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF006837),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Product Details',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
            ),
            if (code.isNotEmpty)
              Text(
                code,
                style: const TextStyle(color: Color(0xFFD1FAE5), fontSize: 11),
              ),
          ],
        ),
        actions: [
          if (p != null)
            IconButton(
              icon: const Icon(Icons.edit_outlined, color: Colors.white),
              tooltip: 'Edit Product',
              onPressed: () async {
                final item = CatalogItem(
                  sNo: p.sno,
                  code: p.code,
                  name: p.desc,
                  specs: p.spec,
                  stdPkg: p.pkg,
                  qty: p.stock,
                  price: p.purchase,
                  margin: p.marginAmount.toStringAsFixed(2),
                  slPrice: p.sellingPrice,
                  category: p.category,
                  brand: p.brand ?? 'ERD',
                  unit: 'PCS',
                  hsnSac: '8504',
                  description: p.desc,
                );
                await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => EditProductScreen(item: item),
                  ),
                );
              },
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null || p == null
              ? _buildErrorView()
              : _buildProductContent(context, p),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.inventory_2_outlined, size: 54, color: Color(0xFF94A3B8)),
            const SizedBox(height: 16),
            Text(
              _error ?? 'Product information unavailable',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                foregroundColor: Colors.white,
              ),
              child: const Text('Back to Catalog'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductContent(BuildContext context, Product p) {
    final provider = context.watch<CatalogProvider>();
    final icon = _getCategoryIcon(p);
    final color = _getCategoryColor(p);
    final inStock = p.stock > 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Visual Hero Container
          Container(
            padding: const EdgeInsets.symmetric(vertical: 36),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Center(
              child: Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: color.withValues(alpha: 0.2)),
                ),
                child: Icon(icon, size: 56, color: color),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Main Info Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E3A8A),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        p.code,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            CategoryIconHelper.getIconForCategory(p.category, p.desc, p.code),
                            size: 13,
                            color: const Color(0xFF475569),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            p.category,
                            style: const TextStyle(
                              color: Color(0xFF475569),
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: inStock ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        inStock ? 'In Stock: ${p.stock}' : 'Out of Stock',
                        style: TextStyle(
                          color: inStock ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  p.desc,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
                if (p.spec.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    p.spec,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                  ),
                ],
                const SizedBox(height: 16),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),
                const SizedBox(height: 16),

                // Prices
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'SELLING PRICE',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF64748B),
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '₹${p.sellingPrice.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFFEA580C),
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    if (provider.showPrice) ...[
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text(
                            'PURCHASE',
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF64748B),
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '₹${p.purchase.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF334155),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 16),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text(
                            'MARGIN',
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF64748B),
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '+₹${p.marginAmount.toStringAsFixed(2)} (${p.marginPercent.toStringAsFixed(1)}%)',
                            style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF16A34A),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Specifications & Inventory Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Inventory & Packaging',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 12),
                _specRow('Package MOQ', 'Pkg: ${p.pkg > 0 ? p.pkg : 1}'),
                _specRow('Available Stock', '${p.stock} units'),
                _specRow('Category', p.category),
                _specRow('SKU / Code', p.code),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const InventoryScreen(),
                      ),
                    );
                  },
                  icon: const Icon(Icons.history_rounded, size: 16, color: Color(0xFF1D4ED8)),
                  label: const Text('View Stock Movements in Inventory',
                      style: TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600, fontSize: 12.5)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF93C5FD)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Action Buttons: + Add to Bill & + Add to Order
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    if (p.stock <= 0) {
                      AppToast.showError(
                        context,
                        title: 'Product Out of Stock',
                        subtitle: '${p.desc} is currently out of stock.',
                      );
                      return;
                    }
                    final existing = provider.billItemFor(p.code);
                    if (existing != null && p.stock > 0 && existing.qty >= p.stock) {
                      AppToast.showWarning(
                        context,
                        title: 'Stock Limit Reached',
                        subtitle: 'Cannot exceed available stock (${p.stock})',
                      );
                      return;
                    }
                    provider.addToBill(p);
                    final count = provider.billItemFor(p.code)?.qty ?? 1;
                    AppToast.showAddedToBill(
                      context,
                      productName: p.desc,
                      quantity: count,
                      onViewBill: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const BillScreen()),
                        );
                      },
                    );
                  },
                  icon: const Icon(Icons.receipt_long, size: 18),
                  label: const Text('+ Add to Bill', style: TextStyle(fontWeight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D4ED8),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    provider.addToOrder(p);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Added ${p.desc} to Order'),
                        backgroundColor: const Color(0xFF0D9488),
                        action: SnackBarAction(
                          label: 'View Order',
                          textColor: Colors.white,
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                            );
                          },
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.shopping_bag_outlined, size: 18),
                  label: const Text('+ Add to Order', style: TextStyle(fontWeight: FontWeight.w700)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D9488),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _specRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B))),
          Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }
}
