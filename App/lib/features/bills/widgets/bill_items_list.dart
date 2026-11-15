import 'package:flutter/material.dart';
import '../../../models/bill_item.dart';
import '../../../providers/catalog_provider.dart';
import '../../../theme/app_theme.dart';

class BillItemsList extends StatelessWidget {
  final CatalogProvider provider;
  final ValueChanged<BillItem> onEditItemRate;

  const BillItemsList({
    super.key,
    required this.provider,
    required this.onEditItemRate,
  });

  @override
  Widget build(BuildContext context) {
    if (provider.billItems.isEmpty) {
      return AppCard(
        padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: const BoxDecoration(
                color: AppColors.blue50,
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(Icons.receipt_long_rounded,
                    size: 28, color: AppColors.blue600),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'No Products in Bill',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 15,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Search by name/SKU or scan barcode above to add items',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: provider.billItems.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final item = provider.billItems[i];
        return AppCard(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product icon/thumbnail
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.blue50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Center(
                  child: Icon(Icons.inventory_2_outlined,
                      color: AppColors.blue600, size: 22),
                ),
              ),
              const SizedBox(width: 12),

              // Middle: Name, Rate with edit trigger, Stepper
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.desc,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    InkWell(
                      onTap: () => onEditItemRate(item),
                      borderRadius: BorderRadius.circular(4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AmountText(
                            amount: item.price,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.edit_outlined,
                              size: 13, color: AppColors.blue600),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Quantity stepper [- Qty +]
                    Container(
                      decoration: BoxDecoration(
                        color: AppColors.bg,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          InkWell(
                            onTap: () {
                              if (item.qty > 1) {
                                provider.updateItemQty(item.code, item.qty - 1);
                              } else {
                                provider.removeItem(item.code);
                              }
                            },
                            borderRadius: const BorderRadius.horizontal(
                                left: Radius.circular(8)),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              child: Icon(Icons.remove,
                                  size: 16, color: AppColors.navy900),
                            ),
                          ),
                          Container(
                            constraints: const BoxConstraints(minWidth: 28),
                            alignment: Alignment.center,
                            child: Text(
                              '${item.qty}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.navy900,
                              ),
                            ),
                          ),
                          InkWell(
                            onTap: () {
                              provider.updateItemQty(item.code, item.qty + 1);
                            },
                            borderRadius: const BorderRadius.horizontal(
                                right: Radius.circular(8)),
                            child: const Padding(
                              padding: EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              child: Icon(Icons.add,
                                  size: 16, color: AppColors.navy900),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Right: Delete icon and Line Total
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  InkWell(
                    onTap: () => provider.removeItem(item.code),
                    borderRadius: BorderRadius.circular(6),
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(Icons.delete_outline_rounded,
                          size: 18, color: AppColors.danger),
                    ),
                  ),
                  const SizedBox(height: 16),
                  AmountText(
                    amount: item.amount,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.navy900,
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
