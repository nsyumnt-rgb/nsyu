import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../providers/catalog_provider.dart';
import '../../../theme/app_theme.dart';

class CartStickyFooter extends StatelessWidget {
  final CatalogProvider provider;
  final String documentMode;
  final double subtotal;
  final double discount;
  final double grandTotal;
  final bool saving;
  final VoidCallback onCreateBillOrOrder;

  const CartStickyFooter({
    super.key,
    required this.provider,
    required this.documentMode,
    required this.subtotal,
    required this.discount,
    required this.grandTotal,
    required this.saving,
    required this.onCreateBillOrOrder,
  });

  static final NumberFormat _money = NumberFormat('#,##0.00');

  Widget _buildFooterIconBtn(
    BuildContext context,
    IconData icon,
    String label,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: const Color(0xFF0F172A)),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                fontSize: 9,
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool isEmptyCart = (documentMode == 'Order'
        ? (provider.orderItems.isEmpty && provider.billItems.isEmpty)
        : (provider.billItems.isEmpty && provider.orderItems.isEmpty));

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Save as Draft
            _buildFooterIconBtn(context, Icons.save_outlined, 'Save as Draft', () {
              showAppSnackBar(context, 'Cart saved as draft');
            }),

            // Print
            _buildFooterIconBtn(context, Icons.print_outlined, 'Print', () {
              showAppSnackBar(context, 'Opening print layout...');
            }),

            // Share
            _buildFooterIconBtn(context, Icons.share_outlined, 'Share', () {
              Share.share('Cart Summary: Grand Total ₹${_money.format(grandTotal)}');
            }),

            // Send on WhatsApp Button (Mint pill)
            InkWell(
              onTap: () {
                final phone = provider.selectedCustomer?.mobile ?? '';
                if (phone.isEmpty) {
                  showAppSnackBar(
                    context,
                    'Please select a customer with a valid mobile number',
                  );
                  return;
                }
                final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
                launchUrl(
                  Uri.parse(
                    'https://wa.me/$digits?text=Hello,%20your%20bill%20total%20is%20%E2%82%B9${_money.format(grandTotal)}',
                  ),
                  mode: LaunchMode.externalApplication,
                );
              },
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.phone, size: 14, color: Color(0xFF006837)),
                    SizedBox(width: 4),
                    Text(
                      'Send on WhatsApp',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF006837),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Create Bill > / Create Order > Button
            ElevatedButton(
              onPressed: (saving || isEmptyCart) ? null : onCreateBillOrOrder,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006837),
                disabledBackgroundColor: const Color(0xFFCBD5E1),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                elevation: 0,
              ),
              child: saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : Row(
                      children: [
                        const Icon(Icons.description_outlined,
                            size: 15, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(
                          'Create $documentMode >',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

