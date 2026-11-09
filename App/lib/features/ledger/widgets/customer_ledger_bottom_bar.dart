import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../models/customer.dart';
import '../../../providers/catalog_provider.dart';
import '../../../screens/order_cart_screen.dart';

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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
        boxShadow: [
          BoxShadow(
            color: Color(0x0C000000),
            blurRadius: 10,
            offset: Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // Received (Green Pill Button)
            Expanded(
              flex: 4,
              child: ElevatedButton.icon(
                onPressed: onCollectPayment,
                icon: const Icon(Icons.arrow_downward, color: Colors.white, size: 18),
                label: const Text(
                  'Received',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                ),
              ),
            ),
            const SizedBox(width: 10),

            // Given (Pink / Light Red Pill Button)
            Expanded(
              flex: 4,
              child: ElevatedButton.icon(
                onPressed: () {
                  if (customer != null) {
                    context.read<CatalogProvider>().selectCustomer(customer!);
                  }
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                  );
                },
                icon: const Icon(Icons.arrow_upward, color: Color(0xFFDC2626), size: 18),
                label: const Text(
                  'Given',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFDC2626),
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFEE2E2),
                  foregroundColor: const Color(0xFFDC2626),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
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
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Center(
                  child: Icon(Icons.chat_bubble_outline, color: Color(0xFF16A34A), size: 22),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
