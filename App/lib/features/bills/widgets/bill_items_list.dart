import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../models/bill_item.dart';
import '../../../providers/catalog_provider.dart';

class BillItemsList extends StatelessWidget {
  final CatalogProvider provider;
  final ValueChanged<BillItem> onEditItemRate;

  const BillItemsList({
    super.key,
    required this.provider,
    required this.onEditItemRate,
  });

  static final NumberFormat _money = NumberFormat('#,##0.00');

  @override
  Widget build(BuildContext context) {
    if (provider.billItems.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Column(
          children: [
            Icon(Icons.receipt_long_outlined, size: 36, color: Color(0xFFCBD5E1)),
            SizedBox(height: 8),
            Text(
              'No products in bill',
              style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
            ),
            SizedBox(height: 4),
            Text(
              'Search or scan barcode above to add products',
              style: TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
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
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.015),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Center(
                  child: Icon(Icons.inventory_2_outlined, color: Color(0xFF1D4ED8), size: 22),
                ),
              ),
              const SizedBox(width: 12),

              // Middle: Name, Unit Price, Stepper [- Qty +]
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.desc,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                        color: Color(0xFF0F172A),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    InkWell(
                      onTap: () => onEditItemRate(item),
                      borderRadius: BorderRadius.circular(4),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '₹ ${_money.format(item.price)}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.edit_outlined, size: 12, color: Color(0xFF94A3B8)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      height: 32,
                      width: 64,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      alignment: Alignment.center,
                      child: TextFormField(
                        initialValue: '${item.qty}',
                        keyboardType: TextInputType.number,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                        ),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding:
                              EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                        ),
                        onChanged: (val) {
                          final trimmed = val.trim();
                          if (trimmed.isEmpty) return;
                          final q = int.tryParse(trimmed);
                          if (q != null && q >= 1) {
                            provider.updateItemQty(item.code, q);
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ),

              // Right: Delete icon and Total Amount
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  InkWell(
                    onTap: () => provider.removeItem(item.code),
                    child: const Padding(
                      padding: EdgeInsets.all(4),
                      child: Icon(Icons.delete_outline, size: 18, color: Color(0xFFDC2626)),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    '₹ ${_money.format(item.amount)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13.5,
                      color: Color(0xFF0F172A),
                    ),
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

