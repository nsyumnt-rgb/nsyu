import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../models/customer.dart';
import '../../../providers/catalog_provider.dart';
import '../../../screens/order_cart_screen.dart';
import '../../../theme/app_theme.dart';

class CustomerLedgerBottomBar extends StatelessWidget {
  final Customer? customer;
  final VoidCallback onCollectPayment;

  const CustomerLedgerBottomBar({
    super.key,
    required this.customer,
    required this.onCollectPayment,
  });

  @override
  Widget build(BuildContext context) {
    final phone = customer?.mobile ?? '';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: const Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // Add Payment (Navy-900 Primary)
            Expanded(
              flex: 4,
              child: SizedBox(
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: onCollectPayment,
                  icon: const Icon(Icons.add_circle_outline_rounded, color: Colors.white, size: 18),
                  label: const Text(
                    'Add Payment',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.navy900,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),

            // New Bill (Soft Blue Outline / Surface)
            Expanded(
              flex: 4,
              child: SizedBox(
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: () {
                    if (customer != null) {
                      context.read<CatalogProvider>().selectCustomer(customer!);
                    }
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                    );
                  },
                  icon: const Icon(Icons.receipt_long_outlined, color: AppColors.blue600, size: 18),
                  label: const Text(
                    'New Bill',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy900,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.blue50,
                    foregroundColor: AppColors.navy900,
                    elevation: 0,
                    side: const BorderSide(color: AppColors.blue100, width: 1.2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),

            // WhatsApp Square Button
            InkWell(
              onTap: () {
                final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
                if (digits.isNotEmpty) {
                  launchUrl(Uri.parse('https://wa.me/$digits'), mode: LaunchMode.externalApplication);
                }
              },
              borderRadius: BorderRadius.circular(14),
              child: Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: const Center(
                  child: Icon(Icons.chat_bubble_outline_rounded, color: AppColors.success, size: 20),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
