import 'package:flutter/material.dart';
import '../../../models/product.dart';
import '../../../navigation/app_navigation.dart';
import '../../../providers/catalog_provider.dart';
import '../../../theme/app_theme.dart';

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

  @override
  Widget build(BuildContext context) {
    final isInCart = provider.isItemInCart(item.code);
    final isDark = index % 2 == 1;

    // Stock color logic
    Color stockBg;
    Color stockFg;
    String stockText;
    if (item.stock > 5) {
      stockBg = AppColors.successBg;
      stockFg = AppColors.success;
      stockText = 'In Stock: ${item.stock}';
    } else if (item.stock > 0) {
      stockBg = AppColors.warningBg;
      stockFg = AppColors.warning;
      stockText = 'Low Stock: ${item.stock}';
    } else {
      stockBg = AppColors.dangerBg;
      stockFg = AppColors.danger;
      stockText = 'Out of Stock';
    }

    return AppCard(
      padding: const EdgeInsets.all(12),
      onTap: () {
        AppNavigation.openProductDetails(context, product: item);
      },
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── 1. Thumbnail ──
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              color: AppColors.bg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: ProductThumbnail(
                brand: item.brand?.isNotEmpty == true ? item.brand! : item.code,
                isDark: isDark,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // ── 2. Product Meta & Details ──
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Category + Stock Badge Row
                Row(
                  children: [
                    if (item.category.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.blue50,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.blue100),
                        ),
                        child: Text(
                          item.category.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.navy900,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: stockBg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        stockText,
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w700,
                          color: stockFg,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),

                // 2-line title wrapping
                Text(
                  item.desc,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    height: 1.25,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),

                // Price Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    AmountText(
                      amount: item.slPrice,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.navy900,
                    ),

                    // Add or In Cart Stepper Button
                    if (isInCart)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.successBg,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.check_circle_rounded, size: 14, color: AppColors.success),
                            SizedBox(width: 4),
                            Text(
                              'In Cart',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.success,
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      SizedBox(
                        height: 32,
                        child: ElevatedButton.icon(
                          onPressed: onAddToCart,
                          icon: const Icon(Icons.add_shopping_cart, size: 15),
                          label: const Text(
                            'Add',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.navy900,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 4),

          // Favorite Icon
          InkWell(
            onTap: onToggleFav,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.all(4),
              child: Icon(
                isFav ? Icons.favorite : Icons.favorite_border,
                color: isFav ? AppColors.danger : AppColors.textSecondary,
                size: 20,
              ),
            ),
          ),
        ],
      ),
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
    final bg = isDark ? AppColors.navy900 : Colors.white;
    final fg = isDark ? Colors.white : AppColors.navy900;

    return Center(
      child: SizedBox(
        width: 60,
        height: 60,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Metal Prongs
            Positioned(
              top: 2,
              left: 20,
              child: Container(
                width: 5,
                height: 10,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                  border: Border.all(color: const Color(0xFF94A3B8), width: 1),
                ),
              ),
            ),
            Positioned(
              top: 2,
              left: 35,
              child: Container(
                width: 5,
                height: 10,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                  border: Border.all(color: const Color(0xFF94A3B8), width: 1),
                ),
              ),
            ),
            // Body
            Positioned(
              top: 10,
              child: Container(
                width: 46,
                height: 44,
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border, width: 1.2),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 4,
                      offset: const Offset(1, 2),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    brand.isNotEmpty ? brand.toUpperCase() : 'NSYU',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 9.5,
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
