import 'package:flutter/material.dart';

enum CatalogStockFilter { all, inStock, outOfStock }
enum CatalogSortOrder { none, nameAsc, priceAsc, priceDesc }

class CatalogFilterSheet extends StatelessWidget {
  final CatalogStockFilter currentStockFilter;
  final CatalogSortOrder currentSortOrder;
  final ValueChanged<CatalogStockFilter> onStockFilterChanged;
  final ValueChanged<CatalogSortOrder> onSortOrderChanged;

  const CatalogFilterSheet({
    super.key,
    required this.currentStockFilter,
    required this.currentSortOrder,
    required this.onStockFilterChanged,
    required this.onSortOrderChanged,
  });

  static void show(
    BuildContext context, {
    required CatalogStockFilter currentStockFilter,
    required CatalogSortOrder currentSortOrder,
    required ValueChanged<CatalogStockFilter> onStockFilterChanged,
    required ValueChanged<CatalogSortOrder> onSortOrderChanged,
  }) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => CatalogFilterSheet(
        currentStockFilter: currentStockFilter,
        currentSortOrder: currentSortOrder,
        onStockFilterChanged: onStockFilterChanged,
        onSortOrderChanged: onSortOrderChanged,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Filter Products',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.all_inclusive, color: Color(0xFF006837)),
              title: const Text('All Products'),
              trailing: currentStockFilter == CatalogStockFilter.all
                  ? const Icon(Icons.check, color: Color(0xFF006837))
                  : null,
              onTap: () {
                Navigator.pop(context);
                onStockFilterChanged(CatalogStockFilter.all);
              },
            ),
            ListTile(
              leading: const Icon(Icons.check_circle_outline, color: Color(0xFF006837)),
              title: const Text('In Stock Only'),
              trailing: currentStockFilter == CatalogStockFilter.inStock
                  ? const Icon(Icons.check, color: Color(0xFF006837))
                  : null,
              onTap: () {
                Navigator.pop(context);
                onStockFilterChanged(CatalogStockFilter.inStock);
              },
            ),
            ListTile(
              leading: const Icon(Icons.highlight_off, color: Color(0xFFDC2626)),
              title: const Text('Out of Stock Only'),
              trailing: currentStockFilter == CatalogStockFilter.outOfStock
                  ? const Icon(Icons.check, color: Color(0xFF006837))
                  : null,
              onTap: () {
                Navigator.pop(context);
                onStockFilterChanged(CatalogStockFilter.outOfStock);
              },
            ),
            ListTile(
              leading: const Icon(Icons.sort_by_alpha, color: Color(0xFF1E293B)),
              title: const Text('Sort by Name (A-Z)'),
              trailing: currentSortOrder == CatalogSortOrder.nameAsc
                  ? const Icon(Icons.check, color: Color(0xFF006837))
                  : null,
              onTap: () {
                Navigator.pop(context);
                onSortOrderChanged(CatalogSortOrder.nameAsc);
              },
            ),
            ListTile(
              leading: const Icon(Icons.currency_rupee, color: Color(0xFF1E293B)),
              title: const Text('Sort by SL-Price (Low to High)'),
              trailing: currentSortOrder == CatalogSortOrder.priceAsc
                  ? const Icon(Icons.check, color: Color(0xFF006837))
                  : null,
              onTap: () {
                Navigator.pop(context);
                onSortOrderChanged(CatalogSortOrder.priceAsc);
              },
            ),
          ],
        ),
      ),
    );
  }
}
