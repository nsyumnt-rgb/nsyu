import 'package:flutter/material.dart';
import '../../../providers/catalog_provider.dart';
import '../../../theme/app_theme.dart';

class BillPaymentSection extends StatelessWidget {
  final CatalogProvider provider;
  final VoidCallback onOpenPaymentDialog;
  final VoidCallback onClearPayment;

  const BillPaymentSection({
    super.key,
    required this.provider,
    required this.onOpenPaymentDialog,
    required this.onClearPayment,
  });

  @override
  Widget build(BuildContext context) {
    final isSettled = provider.remainingOutstanding <= 0;

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Payment Received',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.navy900,
                ),
              ),
              InkWell(
                onTap: onOpenPaymentDialog,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.successBg,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFBBF7D0)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AmountText(
                        amount: provider.paymentReceived,
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.success,
                      ),
                      const SizedBox(width: 6),
                      if (provider.paymentReceived > 0)
                        InkWell(
                          onTap: onClearPayment,
                          child: const Icon(
                            Icons.cancel,
                            size: 16,
                            color: AppColors.success,
                          ),
                        )
                      else
                        const Icon(
                          Icons.add_circle_outline,
                          size: 16,
                          color: AppColors.success,
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.border),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Remaining Due',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AmountText(
                    amount: provider.remainingOutstanding.abs(),
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: isSettled ? AppColors.success : AppColors.danger,
                  ),
                  const SizedBox(width: 6),
                  StatusChip(
                    label: isSettled ? 'Paid' : 'Due',
                    variant: isSettled
                        ? StatusChipVariant.success
                        : StatusChipVariant.danger,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
