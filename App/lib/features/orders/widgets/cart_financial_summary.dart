import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';

class CartFinancialSummary extends StatefulWidget {
  final double subtotal;
  final double discountAmount;
  final double taxAmount;
  final double grandTotal;
  final bool isDiscountPercent;
  final TextEditingController discountValCtrl;
  final ValueChanged<bool> onToggleDiscountType;
  final ValueChanged<String> onDiscountChanged;

  const CartFinancialSummary({
    super.key,
    required this.subtotal,
    required this.discountAmount,
    required this.taxAmount,
    required this.grandTotal,
    required this.isDiscountPercent,
    required this.discountValCtrl,
    required this.onToggleDiscountType,
    required this.onDiscountChanged,
  });

  @override
  State<CartFinancialSummary> createState() => _CartFinancialSummaryState();
}

class _CartFinancialSummaryState extends State<CartFinancialSummary> {
  bool _showTerms = false;

  Widget _buildSummaryRow(String label, double amount, {bool isNegative = false, bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: isBold ? 14 : 12.5,
            color: isBold ? AppColors.textPrimary : AppColors.textSecondary,
            fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        AmountText(
          amount: amount,
          fontSize: isBold ? 18 : 13.5,
          fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
          color: isNegative
              ? AppColors.danger
              : (isBold ? AppColors.navy900 : AppColors.textPrimary),
          prefix: isNegative ? '- ' : null,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AppCard(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Financial Summary',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),

              // Subtotal
              _buildSummaryRow('Sub Total', widget.subtotal),
              const SizedBox(height: 10),

              // Discount Row with Mode Toggle & Input
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        'Discount',
                        style: TextStyle(
                          fontSize: 12.5,
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Mini Toggle [ ₹ | % ]
                      Container(
                        height: 24,
                        decoration: BoxDecoration(
                          color: AppColors.bg,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            InkWell(
                              onTap: () => widget.onToggleDiscountType(false),
                              borderRadius: const BorderRadius.horizontal(left: Radius.circular(6)),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8),
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: !widget.isDiscountPercent ? AppColors.navy900 : Colors.transparent,
                                  borderRadius: const BorderRadius.horizontal(left: Radius.circular(5)),
                                ),
                                child: Text(
                                  '₹',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: !widget.isDiscountPercent ? Colors.white : AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            ),
                            InkWell(
                              onTap: () => widget.onToggleDiscountType(true),
                              borderRadius: const BorderRadius.horizontal(right: Radius.circular(6)),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8),
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: widget.isDiscountPercent ? AppColors.navy900 : Colors.transparent,
                                  borderRadius: const BorderRadius.horizontal(right: Radius.circular(5)),
                                ),
                                child: Text(
                                  '%',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: widget.isDiscountPercent ? Colors.white : AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  SizedBox(
                    width: 90,
                    height: 32,
                    child: TextField(
                      controller: widget.discountValCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppColors.danger),
                      decoration: InputDecoration(
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: AppColors.border)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: const BorderSide(color: AppColors.blue600)),
                      ),
                      onChanged: widget.onDiscountChanged,
                    ),
                  ),
                ],
              ),

              if (widget.discountAmount > 0) ...[
                const SizedBox(height: 6),
                _buildSummaryRow('Discount Applied', widget.discountAmount, isNegative: true),
              ],

              const Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Divider(height: 1, color: AppColors.border),
              ),

              // Grand Total
              _buildSummaryRow('Grand Total', widget.grandTotal, isBold: true),
            ],
          ),
        ),
        const SizedBox(height: 8),

        // Terms and conditions toggle
        InkWell(
          onTap: () => setState(() => _showTerms = !_showTerms),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
            child: Row(
              children: [
                const Icon(Icons.info_outline, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                const Text(
                  'Terms & Conditions',
                  style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                ),
                const Spacer(),
                Icon(
                  _showTerms ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                  size: 16,
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),
        ),
        if (_showTerms)
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(top: 4),
            decoration: BoxDecoration(
              color: AppColors.bg,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('1. Warranty as per product company guidelines.', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                SizedBox(height: 3),
                Text('2. Payment must be cleared within 21 days maximum.', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                SizedBox(height: 3),
                Text('3. Subject to jurisdiction of local courts only.', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              ],
            ),
          ),
      ],
    );
  }
}
