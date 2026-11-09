import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../models/customer.dart';

class CustomerListTile extends StatelessWidget {
  final Customer customer;
  final int index;
  final VoidCallback onTap;
  final VoidCallback onEdit;

  static const avatarPalettes = [
    (Color(0xFFEDE9FE), Color(0xFF6D28D9)), // purple
    (Color(0xFFE0F2FE), Color(0xFF0284C7)), // sky
    (Color(0xFFDBEAFE), Color(0xFF1D4ED8)), // blue
    (Color(0xFFF0FDF4), Color(0xFF16A34A)), // green
    (Color(0xFFFEF3C7), Color(0xFFD97706)), // amber
  ];

  const CustomerListTile({
    super.key,
    required this.customer,
    required this.index,
    required this.onTap,
    required this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat('#,##0');
    final initials = customer.name.trim().isEmpty
        ? '?'
        : customer.name
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((s) => s[0])
            .join()
            .toUpperCase();

    final palette = avatarPalettes[index % avatarPalettes.length];
    final code = (customer.referenceCode != null &&
            customer.referenceCode!.isNotEmpty)
        ? customer.referenceCode!
        : (customer.id.startsWith('CUS')
            ? customer.id
            : 'CUS-${customer.id.padLeft(4, '0')}');

    final isOutstanding = customer.currentBalance > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: palette.$1,
                  child: Text(
                    initials,
                    style: TextStyle(
                      color: palette.$2,
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        customer.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: Color(0xFF0F172A),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        code,
                        style: const TextStyle(
                            fontSize: 11.5, color: Color(0xFF64748B)),
                      ),
                      Text(
                        customer.mobile.isNotEmpty ? customer.mobile : '-',
                        style: const TextStyle(
                            fontSize: 11.5, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      isOutstanding
                          ? '₹ ${money.format(customer.currentBalance)}'
                          : '₹ 0',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: isOutstanding
                            ? const Color(0xFFDC2626)
                            : const Color(0xFF16A34A),
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      isOutstanding ? 'Outstanding' : 'Paid',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: isOutstanding
                            ? const Color(0xFFDC2626)
                            : const Color(0xFF16A34A),
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.edit_outlined,
                      size: 16, color: Color(0xFF64748B)),
                  tooltip: 'Edit customer',
                  padding: EdgeInsets.zero,
                  constraints:
                      const BoxConstraints(minWidth: 28, minHeight: 28),
                  onPressed: onEdit,
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right,
                    size: 18, color: Color(0xFF94A3B8)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
