import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../providers/catalog_provider.dart';

class BillSummaryCard extends StatelessWidget {
  final CatalogProvider provider;

  const BillSummaryCard({super.key, required this.provider});

  static final NumberFormat _money = NumberFormat('#,##0.00');

  static Widget _summaryLine(
    String label,
    String value, {
    bool isBold = false,
    double fontSize = 13,
    Color? valueColor,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
            color: isBold ? const Color(0xFF0F172A) : const Color(0xFF64748B),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            color: valueColor ?? const Color(0xFF0F172A),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.015),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bill Summary',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14.5,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 12),
          _summaryLine(
            'Subtotal (${provider.billItems.length} items)',
            '₹ ${_money.format(provider.billSubtotal)}',
          ),
          if (provider.billDiscount > 0) ...[
            const SizedBox(height: 6),
            _summaryLine(
              'Discount',
              '- ₹ ${_money.format(provider.billDiscount)}',
              valueColor: const Color(0xFF16A34A),
            ),
          ],
          if (provider.billTax > 0) ...[
            const SizedBox(height: 6),
            _summaryLine(
              'Tax / GST',
              '+ ₹ ${_money.format(provider.billTax)}',
            ),
          ],
          const SizedBox(height: 6),
          _summaryLine(
            'Bill Total',
            '₹ ${_money.format(provider.finalBillTotal)}',
          ),
          if (provider.previousOutstanding > 0) ...[
            const SizedBox(height: 6),
            _summaryLine(
              'Previous Outstanding',
              '₹ ${_money.format(provider.previousOutstanding)}',
              valueColor: const Color(0xFFDC2626),
            ),
          ],
          const SizedBox(height: 8),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          const SizedBox(height: 8),
          _summaryLine(
            'Grand Total',
            '₹ ${_money.format(provider.totalAmountPayable)}',
            isBold: true,
            fontSize: 16,
          ),
        ],
      ),
    );
  }
}

