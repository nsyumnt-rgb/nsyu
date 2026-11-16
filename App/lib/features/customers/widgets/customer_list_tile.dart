import 'package:flutter/material.dart';
import '../../../models/customer.dart';
import '../../../theme/app_theme.dart';

class CustomerListTile extends StatelessWidget {
  final Customer customer;
  final int index;
  final VoidCallback onTap;
  final VoidCallback onEdit;

  const CustomerListTile({
    super.key,
    required this.customer,
    required this.index,
    required this.onTap,
    required this.onEdit,
  });

  @override
  Widget build(BuildContext context) {
    final initials = customer.name.trim().isEmpty
        ? '?'
        : customer.name
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((s) => s[0])
            .join()
            .toUpperCase();

    final code = (customer.referenceCode != null &&
            customer.referenceCode!.isNotEmpty)
        ? customer.referenceCode!
        : (customer.id.startsWith('CUS')
            ? customer.id
            : 'CUS-${customer.id.padLeft(4, '0')}');

    final isOutstanding = customer.currentBalance > 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        onTap: onTap,
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.navy900, AppColors.navy700],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  initials,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
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
                      fontSize: 14.5,
                      color: AppColors.textPrimary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: AppColors.blue50,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          code,
                          style: const TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: AppColors.blue600,
                          ),
                        ),
                      ),
                      if (customer.mobile.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            customer.mobile,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                AmountText(
                  amount: customer.currentBalance.abs(),
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: isOutstanding
                      ? AppColors.danger
                      : (customer.currentBalance < 0
                          ? AppColors.warning
                          : AppColors.success),
                ),
                const SizedBox(height: 3),
                StatusChip(
                  label: isOutstanding
                      ? 'Due'
                      : (customer.currentBalance < 0 ? 'Advance' : 'Settled'),
                  variant: isOutstanding
                      ? StatusChipVariant.danger
                      : (customer.currentBalance < 0
                          ? StatusChipVariant.warning
                          : StatusChipVariant.success),
                ),
              ],
            ),
            const SizedBox(width: 4),
            IconButton(
              icon: const Icon(Icons.edit_outlined,
                  size: 16, color: AppColors.textSecondary),
              tooltip: 'Edit party',
              padding: EdgeInsets.zero,
              constraints:
                  const BoxConstraints(minWidth: 28, minHeight: 28),
              onPressed: onEdit,
            ),
          ],
        ),
      ),
    );
  }
}
