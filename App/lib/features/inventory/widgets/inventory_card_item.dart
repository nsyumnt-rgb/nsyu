import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/catalog_item.dart';
import 'charger_illustration.dart';

class InventoryCardItem extends StatelessWidget {
  final CatalogItem item;
  final int selectedThumbnail;
  final bool isFavorite;
  final String qtyText;
  final ValueChanged<int> onSelectThumbnail;
  final VoidCallback onToggleFavorite;
  final VoidCallback onFullscreenImage;
  final VoidCallback onIncrementQty;
  final VoidCallback onDecrementQty;
  final VoidCallback onEditProduct;

  const InventoryCardItem({
    super.key,
    required this.item,
    required this.selectedThumbnail,
    required this.isFavorite,
    required this.qtyText,
    required this.onSelectThumbnail,
    required this.onToggleFavorite,
    required this.onFullscreenImage,
    required this.onIncrementQty,
    required this.onDecrementQty,
    required this.onEditProduct,
  });

  static final NumberFormat _money = NumberFormat('#,##0.00');

  Widget _buildThumbnailSquare(int idx) {
    final isSelected = selectedThumbnail == idx;
    return InkWell(
      onTap: () => onSelectThumbnail(idx),
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
            child: ChargerIllustration(thumbnailIndex: idx),
          ),
        ),
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

  @override
  Widget build(BuildContext context) {
    return Container(
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
              // Left Column: Clean Product Image Container with 3 Thumbnail strip
              SizedBox(
                width: 135,
                child: Column(
                  children: [
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
                            child: ChargerIllustration(thumbnailIndex: selectedThumbnail),
                          ),
                          Positioned(
                            top: 6,
                            right: 6,
                            child: InkWell(
                              onTap: onFullscreenImage,
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
                            color: item.qty > 0
                                ? const Color(0xFFECFDF5)
                                : (item.qty < 0
                                    ? const Color(0xFFFEE2E2)
                                    : const Color(0xFFFEF3C7)),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: item.qty > 0
                                  ? const Color(0xFF10B981)
                                  : (item.qty < 0
                                      ? const Color(0xFFEF4444)
                                      : const Color(0xFFF59E0B)),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.inventory_2_outlined,
                                color: item.qty > 0
                                    ? const Color(0xFF059669)
                                    : (item.qty < 0
                                        ? const Color(0xFFDC2626)
                                        : const Color(0xFFD97706)),
                                size: 12,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                item.qty < 0
                                    ? 'Stock: ${item.qty}'
                                    : (item.qty == 0 ? 'Stock: 0' : 'In Stock: ${item.qty}'),
                                style: TextStyle(
                                  color: item.qty > 0
                                      ? const Color(0xFF059669)
                                      : (item.qty < 0
                                          ? const Color(0xFFDC2626)
                                          : const Color(0xFFD97706)),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        InkWell(
                          onTap: onToggleFavorite,
                          child: Icon(
                            isFavorite ? Icons.favorite : Icons.favorite_border_rounded,
                            color: isFavorite ? Colors.red : const Color(0xFF334155),
                            size: 21,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 7),

                    // Code Badge
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
                        child: const Icon(Icons.lock_outline,
                            color: Color(0xFF1E293B), size: 19),
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
                        child: const Icon(Icons.all_inbox_rounded,
                            color: Color(0xFF1E293B), size: 19),
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
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: item.qty < 0
                                  ? const Color(0xFFDC2626)
                                  : (item.qty == 0
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
          const SizedBox(height: 12),

          // ── Section 3: Pricing & Margin Columns ──
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.local_offer_outlined,
                        color: Color(0xFF1E293B), size: 20),
                    const SizedBox(width: 6),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Price\n(Incl. GST)',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                            height: 1.15,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '₹${_money.format(item.price)}',
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF1D4ED8),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Row(
                  children: [
                    const Icon(Icons.trending_up, color: Color(0xFF1E293B), size: 21),
                    const SizedBox(width: 6),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Margin',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item.margin,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Row(
                  children: [
                    const Icon(Icons.savings_outlined, color: Color(0xFF1E293B), size: 21),
                    const SizedBox(width: 6),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'SLPrice',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '₹${_money.format(item.slPrice)}',
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF15803D),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // ── Section 4: Action Row ──
          Row(
            children: [
              const Text(
                'Quantity',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF334155),
                ),
              ),
              const SizedBox(width: 8),

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
                      onTap: onDecrementQty,
                      borderRadius:
                          const BorderRadius.horizontal(left: Radius.circular(8)),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        child: Icon(Icons.remove, size: 16, color: Color(0xFF334155)),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Text(
                        qtyText.isNotEmpty ? qtyText : '1',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: onIncrementQty,
                      borderRadius:
                          const BorderRadius.horizontal(right: Radius.circular(8)),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        child: Icon(Icons.add, size: 16, color: Color(0xFF334155)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),

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
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    onPressed: onEditProduct,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // ── Section 5: Product Description Card ──
          InkWell(
            onTap: onEditProduct,
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
                      Icon(Icons.description_outlined,
                          color: Color(0xFF64748B), size: 17),
                      SizedBox(width: 6),
                      Text(
                        'Product Description',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Spacer(),
                      Icon(Icons.chevron_right, color: Color(0xFF64748B), size: 17),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    item.description,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF475569),
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
