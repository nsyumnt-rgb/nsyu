import 'package:flutter/material.dart';
import '../../../providers/catalog_provider.dart';
import '../../../theme/app_theme.dart';

class BillSummaryCard extends StatelessWidget {
  final CatalogProvider provider;

  const BillSummaryCard({super.key, required this.provider});

  static Widget _summaryLine(
    String label, {
    required double amount,
    bool isBold = false,
    double fontSize = 13.5,
    Color? valueColor,
    String? prefix,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
              color: isBold ? AppColors.navy900 : AppColors.textSecondary,
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (prefix != null)
                Text(
                  prefix,
                  style: TextStyle(
                    fontSize: fontSize,
                    fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                    color: valueColor ?? AppColors.navy900,
                  ),
                ),
              AmountText(
                amount: amount,
                fontSize: fontSize,
                fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                color: valueColor ?? AppColors.navy900,
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bill Summary',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              color: AppColors.navy900,
            ),
          ),
          const SizedBox(height: 10),
          _summaryLine(
            'Subtotal (${provider.billItems.length} items)',
            amount: provider.billSubtotal,
          ),
          if (provider.billDiscount > 0)
            _summaryLine(
              'Discount',
              amount: provider.billDiscount,
              prefix: '- ',
              valueColor: AppColors.success,
            ),
          if (provider.billTax > 0)
            _summaryLine(
              'Tax / GST',
              amount: provider.billTax,
              prefix: '+ ',
            ),
          _summaryLine(
            'Bill Total',
            amount: provider.finalBillTotal,
          ),
          if (provider.previousOutstanding > 0)
            _summaryLine(
              'Previous Outstanding',
              amount: provider.previousOutstanding,
              prefix: '+ ',
              valueColor: AppColors.danger,
            ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 8),
          _summaryLine(
            'Grand Total',
            amount: provider.totalAmountPayable,
            isBold: true,
            fontSize: 16.5,
          ),
        ],
      ),
    );
  }
}
