import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/product.dart';
import '../navigation/app_navigation.dart';
import '../providers/auth_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/visibility_provider.dart';
import '../screens/bill_screen.dart';
import '../screens/order_cart_screen.dart';
import '../utils/category_icon_helper.dart';

/// Product card matching the catalog screenshot:
/// - Tap card -> opens ProductDetailScreen
/// - Displays single "+ Add" button
/// - Automatically routes to active Bill or Order workflow, or prompts user choice if neither active
/// - Prevents duplicates by merging quantities; enforces available stock limits.
class ProductCard extends StatelessWidget {
  final Product product;
  const ProductCard({super.key, required this.product});

  IconData _getCategoryIcon(Product p) {
    return CategoryIconHelper.getIconForCategory(p.category, p.desc, p.code);
  }

  Color _getCategoryColor(Product p) {
    return CategoryIconHelper.getColorForCategory(p.category);
  }

  void _handleAddToCart(BuildContext context, CatalogProvider provider) {
    // Validate stock
    if (product.stock <= 0) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${product.desc} is currently out of stock'),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
      return;
    }

    final hasActiveBill = provider.billItems.isNotEmpty;
    final hasActiveOrder = provider.orderItems.isNotEmpty;

    if (hasActiveBill && !hasActiveOrder) {
      // Direct add to active Bill
      final existing = provider.billItemFor(product.code);
      if (existing != null && product.stock > 0 && existing.qty >= product.stock) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Cannot exceed available stock (${product.stock})'),
            backgroundColor: const Color(0xFFDC2626),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
      provider.addToBill(product);
      final count = provider.billItemFor(product.code)?.qty ?? 1;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Added to Bill (Qty: $count)'),
          backgroundColor: const Color(0xFF1D4ED8),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
          action: SnackBarAction(
            label: 'View Bill',
            textColor: Colors.white,
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const BillScreen()),
              );
            },
          ),
        ),
      );
    } else if (hasActiveOrder && !hasActiveBill) {
      // Direct add to active Order
      provider.addToOrder(product);
      final count = provider.orderItemFor(product.code)?.qty ?? 1;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Added to Order (Qty: $count)'),
          backgroundColor: const Color(0xFF0D9488),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
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
    } else {
      // Neither is active OR both are active: prompt user with bottom sheet
      _showChoiceSheet(context, provider);
    }
  }

  void _showChoiceSheet(BuildContext context, CatalogProvider provider) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Add "${product.desc}" to:',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                '${product.code} · ₹${product.sellingPrice.toStringAsFixed(2)} · In Stock: ${product.stock}',
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 18),
              // Option 1: Add to Bill
              Material(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).clearSnackBars();
                    if (product.stock <= 0) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('${product.desc} is out of stock')),
                      );
                      return;
                    }
                    final existing = provider.billItemFor(product.code);
                    if (existing != null && product.stock > 0 && existing.qty >= product.stock) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Cannot exceed available stock (${product.stock})')),
                      );
                      return;
                    }
                    provider.addToBill(product);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: const Text('Added to Bill'),
                        backgroundColor: const Color(0xFF1D4ED8),
                        behavior: SnackBarBehavior.floating,
                        action: SnackBarAction(
                          label: 'Open Bill',
                          textColor: Colors.white,
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const BillScreen()),
                            );
                          },
                        ),
                      ),
                    );
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1D4ED8),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.receipt_long, color: Colors.white, size: 22),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Bill',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF1E3A8A),
                                ),
                              ),
                              Text(
                                provider.billItems.isNotEmpty
                                    ? 'Add to current bill (${provider.billCount} items)'
                                    : 'Start a new customer sales bill',
                                style: const TextStyle(fontSize: 12, color: Color(0xFF3B82F6)),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF1D4ED8)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              // Option 2: Add to Order
              Material(
                color: const Color(0xFFF0FDFA),
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).clearSnackBars();
                    provider.addToOrder(product);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: const Text('Added to Order'),
                        backgroundColor: const Color(0xFF0D9488),
                        behavior: SnackBarBehavior.floating,
                        action: SnackBarAction(
                          label: 'Open Order',
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
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0D9488),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.shopping_bag_outlined, color: Colors.white, size: 22),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Order',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF115E59),
                                ),
                              ),
                              Text(
                                provider.orderItems.isNotEmpty
                                    ? 'Add to active order (${provider.orderCount} items)'
                                    : 'Start a new customer order sheet',
                                style: const TextStyle(fontSize: 12, color: Color(0xFF0D9488)),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF0D9488)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Consumer3<CatalogProvider, VisibilityProvider, AuthProvider>(
      builder: (context, provider, vis, auth, _) {
        final showIcon = vis.isProductFieldVisible('category_icon');
        final showSku = vis.isProductFieldVisible('sku_code');
        final showBrand = vis.isProductFieldVisible('brand');
        final showDescription = vis.isProductFieldVisible('product_description');
        final showPurchase = vis.isBusinessInfoVisible('purchase_price', auth) && provider.showPrice;
        final showMargin = vis.isBusinessInfoVisible('margin', auth);
        final showStock = vis.isBusinessInfoVisible('stock_quantity', auth);

        final icon = _getCategoryIcon(product);
        final color = _getCategoryColor(product);

        String codeDisplay = '';
        if (product.referenceCode != null && product.referenceCode!.isNotEmpty) {
          codeDisplay = showSku ? '${product.referenceCode} · ${product.code}' : product.referenceCode!;
        } else if (showSku) {
          codeDisplay = product.code;
        }

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Tapping card body navigates to ProductDetailScreen
              InkWell(
                onTap: () => AppNavigation.openProductDetails(context, product: product),
                borderRadius: BorderRadius.circular(8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Product Thumbnail Icon / Image (controlled by category_icon visibility)
                    if (showIcon) ...[
                      Container(
                        width: 52,
                        height: 58,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Center(
                          child: Icon(icon, color: color, size: 28),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    // Product Details
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // SKU & Reference Code
                          if (codeDisplay.isNotEmpty)
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    codeDisplay,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      color: Color(0xFF64748B),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                const Icon(Icons.more_vert, size: 15, color: Color(0xFF94A3B8)),
                              ],
                            ),
                          if (showBrand && product.brand != null && product.brand!.isNotEmpty) ...[
                            const SizedBox(height: 1),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                product.brand!,
                                style: const TextStyle(fontSize: 8.5, color: Color(0xFF1D4ED8), fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                          const SizedBox(height: 2),
                          // Title
                          Text(
                            product.desc,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                              height: 1.2,
                            ),
                          ),
                          if (showDescription && product.spec.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              product.spec,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                            ),
                          ],
                          const SizedBox(height: 2),
                          // Pkg
                          Text(
                            'Pkg: ${product.pkg > 0 ? product.pkg : 1}',
                            style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                          ),
                          const SizedBox(height: 3),
                          // Price in orange
                          Text(
                            '₹${product.sellingPrice.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFEA580C),
                            ),
                          ),
                          if (showPurchase && showMargin) ...[
                            const SizedBox(height: 1),
                            Text(
                              'Buy: ₹${product.purchase.toStringAsFixed(0)} · Margin: ₹${product.marginAmount.toStringAsFixed(0)} (${product.marginPercent.toStringAsFixed(0)}%)',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ] else if (showPurchase) ...[
                            const SizedBox(height: 1),
                            Text(
                              'Buy: ₹${product.purchase.toStringAsFixed(0)}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ] else if (showMargin && provider.showPrice) ...[
                            const SizedBox(height: 1),
                            Text(
                              'Margin: ₹${product.marginAmount.toStringAsFixed(0)} (${product.marginPercent.toStringAsFixed(0)}%)',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                          if (showStock) ...[
                            const SizedBox(height: 2),
                            Text(
                              'In Stock: ${product.stock}',
                              style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF16A34A),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              // Single + Add Button matching screenshot
              SizedBox(
                width: double.infinity,
                height: 34,
                child: ElevatedButton(
                  onPressed: () => _handleAddToCart(context, provider),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFEFF6FF),
                    foregroundColor: const Color(0xFF1D4ED8),
                    elevation: 0,
                    shadowColor: Colors.transparent,
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.add, size: 16, color: Color(0xFF1D4ED8)),
                      SizedBox(width: 4),
                      Text(
                        'Add',
                        style: TextStyle(
                          color: Color(0xFF1D4ED8),
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
