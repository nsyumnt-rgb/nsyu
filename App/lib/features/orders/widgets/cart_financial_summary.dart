import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class CartFinancialSummary extends StatelessWidget {
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

  static final NumberFormat _money = NumberFormat('#,##0.00');

  static Widget _calcRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left Card: Terms & Conditions
        Expanded(
          flex: 5,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.description_outlined, size: 15, color: Color(0xFF0F172A)),
                    SizedBox(width: 5),
                    Text(
                      'Terms & Conditions',
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Text(
                  '1. Warranty as per product company rule.',
                  style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B), height: 1.3),
                ),
                SizedBox(height: 3),
                Text(
                  '2. Payment must be cleared within maximum 21 days.',
                  style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B), height: 1.3),
                ),
                SizedBox(height: 3),
                Text(
                  '3. 5% charges add per week after due date.',
                  style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B), height: 1.3),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),

        // Right Card: Financial Calculations
        Expanded(
          flex: 5,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            padding: const EdgeInsets.all(10),
            child: Column(
              children: [
                _calcRow('Sub Total', '₹${_money.format(subtotal)}'),
                const SizedBox(height: 6),

                // Discount Row with Toggle (₹ | %)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Text(
                          'Discount',
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: Text(
                            isDiscountPercent ? '%' : '₹',
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 44,
                          height: 22,
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: TextField(
                            controller: discountValCtrl,
                            keyboardType:
                                const TextInputType.numberWithOptions(decimal: true),
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 10.5, fontWeight: FontWeight.bold),
                            decoration: const InputDecoration(
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                            ),
                            onChanged: onDiscountChanged,
                          ),
                        ),
                        const SizedBox(width: 4),

                        Container(
                          height: 22,
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFF006837)),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Row(
                            children: [
                              InkWell(
                                onTap: () => onToggleDiscountType(false),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5),
                                  color: !isDiscountPercent
                                      ? const Color(0xFF006837)
                                      : Colors.white,
                                  child: Center(
                                    child: Text(
                                      '₹',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: !isDiscountPercent
                                            ? Colors.white
                                            : const Color(0xFF006837),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              InkWell(
                                onTap: () => onToggleDiscountType(true),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5),
                                  color: isDiscountPercent
                                      ? const Color(0xFF006837)
                                      : Colors.white,
                                  child: Center(
                                    child: Text(
                                      '%',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: isDiscountPercent
                                            ? Colors.white
                                            : const Color(0xFF006837),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '₹${_money.format(discountAmount)}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 6),

                _calcRow('Tax (GST)', '₹${_money.format(taxAmount)}'),
                const SizedBox(height: 8),

                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF006837),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Grand Total',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        '₹${_money.format(grandTotal)}',
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
