import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';

class CartCustomerCard extends StatelessWidget {
  final String customerName;
  final String customerMobile;
  final String customerAddress;
  final VoidCallback onSelectCustomer;

  const CartCustomerCard({
    super.key,
    required this.customerName,
    required this.customerMobile,
    required this.customerAddress,
    required this.onSelectCustomer,
  });

  @override
  Widget build(BuildContext context) {
    final bool hasCustomer = customerName != 'Select Customer';

    return AppCard(
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.navy900, AppColors.blue600],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: hasCustomer
                  ? Text(
                      customerName.isNotEmpty ? customerName[0].toUpperCase() : 'C',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    )
                  : const Icon(Icons.person_add_alt_1_outlined, color: Colors.white, size: 20),
            ),
          ),
          const SizedBox(width: 12),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Customer',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  customerName,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  hasCustomer ? '$customerMobile • $customerAddress' : 'Tap to select customer from directory',
                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),

          // Select Customer Pill
          InkWell(
            onTap: onSelectCustomer,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.blue50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.blue100),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    hasCustomer ? 'Change' : 'Select',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy900,
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(Icons.chevron_right, size: 14, color: AppColors.navy900),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
