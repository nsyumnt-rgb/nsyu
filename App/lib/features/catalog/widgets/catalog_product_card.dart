import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/product.dart';
import '../../../providers/catalog_provider.dart';

class CatalogProductCard extends StatelessWidget {
  final Product item;
  final int index;
  final int qty;
  final bool isFav;
  final bool isExpanded;
  final CatalogProvider provider;
  final ValueChanged<int> onQtyChanged;
  final VoidCallback onToggleFav;
  final VoidCallback onToggleExpand;
  final VoidCallback onAddToCart;

  const CatalogProductCard({
    super.key,
    required this.item,
    required this.index,
    required this.qty,
    required this.isFav,
    required this.isExpanded,
    required this.provider,
    required this.onQtyChanged,
    required this.onToggleFav,
    required this.onToggleExpand,
    required this.onAddToCart,
  });

  static final NumberFormat _money = NumberFormat('#,##0.00');

  @override
  Widget build(BuildContext context) {
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
                  child: ProductThumbnail(
                    brand: item.brand ?? item.code,
                    isDark: index % 2 == 1,
                  ),
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
                            color: item.stock > 0
                                ? const Color(0xFFDCFCE7)
                                : (item.stock < 0
                                    ? const Color(0xFFFEE2E2)
                                    : const Color(0xFFFEF3C7)),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: item.stock > 0
                                  ? const Color(0xFF86EFAC)
                                  : (item.stock < 0
                                      ? const Color(0xFFFCA5A5)
                                      : const Color(0xFFFDE68A)),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.inventory_2_outlined,
                                size: 11,
                                color: item.stock > 0
                                    ? const Color(0xFF15803D)
                                    : (item.stock < 0
                                        ? const Color(0xFFDC2626)
                                        : const Color(0xFFD97706)),
                              ),
                              const SizedBox(width: 3),
                              Text(
                                item.stock < 0
                                    ? 'Stock: ${item.stock}'
                                    : (item.stock == 0 ? 'Stock: 0' : 'In Stock: ${item.stock}'),
                                style: TextStyle(
                                  color: item.stock > 0
                                      ? const Color(0xFF15803D)
                                      : (item.stock < 0
                                          ? const Color(0xFFDC2626)
                                          : const Color(0xFFD97706)),
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Wishlist Favorite Heart
                        InkWell(
                          onTap: onToggleFav,
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
                    _buildMetaRow('Category',
                        item.category.isNotEmpty ? item.category : 'MARKET',
                        hasChevron: true),
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
                            style: TextStyle(
                              fontSize: 8.5,
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '${item.pkg > 0 ? item.pkg : 5}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                            ),
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
                            style: TextStyle(
                              fontSize: 8.5,
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            '${item.stock}',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: item.stock < 0
                                  ? const Color(0xFFDC2626)
                                  : (item.stock == 0
                                      ? const Color(0xFFD97706)
                                      : const Color(0xFF15803D)),
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
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF334155),
                ),
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
                      onTap: () => onQtyChanged(-1),
                      borderRadius:
                          const BorderRadius.horizontal(left: Radius.circular(8)),
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
                      onTap: () => onQtyChanged(1),
                      borderRadius:
                          const BorderRadius.horizontal(right: Radius.circular(8)),
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
                          onPressed: null,
                          icon: const Icon(Icons.check_circle_rounded,
                              size: 18, color: Colors.white),
                          label: const Text(
                            'Added in Cart',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                              color: Colors.white,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            disabledBackgroundColor: const Color(0xFF16A34A),
                            disabledForegroundColor: Colors.white,
                            elevation: 0,
                            minimumSize: const Size(double.infinity, 38),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        )
                      : ElevatedButton.icon(
                          onPressed: onAddToCart,
                          icon: const Icon(Icons.shopping_cart_outlined, size: 18),
                          label: const Text(
                            'Add to Cart',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF006837),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            minimumSize: const Size(double.infinity, 38),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                );
              }),
            ],
          ),

          const SizedBox(height: 10),

          // ── Section 5: Product Description Card (Expandable) ──
          InkWell(
            onTap: onToggleExpand,
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
                          Icon(Icons.description_outlined,
                              size: 15, color: Color(0xFF475569)),
                          SizedBox(width: 6),
                          Text(
                            'Product Description',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E293B),
                            ),
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
                    style: const TextStyle(
                      fontSize: 10.5,
                      color: Color(0xFF64748B),
                      height: 1.3,
                    ),
                    maxLines: isExpanded ? null : 2,
                    overflow:
                        isExpanded ? TextOverflow.visible : TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _buildMetaRow(String label, String value, {bool hasChevron = false}) {
    return Row(
      children: [
        SizedBox(
          width: 65,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        const Text(': ',
            style: TextStyle(
              fontSize: 11,
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w500,
            )),
        Expanded(
          child: Row(
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFF334155),
                  fontWeight: FontWeight.w600,
                ),
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
}

/// Clean Vector Thumbnail matching Reference Image
class ProductThumbnail extends StatelessWidget {
  final String brand;
  final bool isDark;

  const ProductThumbnail({super.key, required this.brand, this.isDark = false});

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

