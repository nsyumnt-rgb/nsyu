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

  Widget _buildQuickAction(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: AppColors.textSecondary),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
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
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top Action Strip: Draft • Share • WhatsApp
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildQuickAction(Icons.save_outlined, 'Draft', () {
                    if (isEmptyCart) {
                      showAppSnackBar(context, 'Cart is empty. Add products first.', isError: true);
                      return;
                    }
                    onCreateBillOrOrder();
                  }),
                  _buildQuickAction(Icons.share_outlined, 'Share', () {
                    Share.share('Cart Total: ₹${_money.format(grandTotal)}');
                  }),
                  _buildQuickAction(Icons.chat_bubble_outline_rounded, 'WhatsApp', () {
                    final phone = provider.selectedCustomer?.mobile ?? '';
                    if (phone.isEmpty) {
                      showAppSnackBar(context, 'Please select a customer with a mobile number');
                      return;
                    }
                    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
                    launchUrl(
                      Uri.parse(
                        'https://wa.me/$digits?text=Hello,%20your%20bill%20total%20is%20%E2%82%B9${_money.format(grandTotal)}',
                      ),
                      mode: LaunchMode.externalApplication,
                    );
                  }),
                ],
              ),
              const SizedBox(height: 8),

              // Bottom Row: Total & Primary Button
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Total (${provider.totalCartQty} items)',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 2),
                        AmountText(
                          amount: grandTotal,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.navy900,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),

                  // Big Action Button
                  SizedBox(
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: (saving || isEmptyCart) ? null : onCreateBillOrOrder,
                      icon: saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : Icon(
                              documentMode == 'Bill' ? Icons.check_circle_outline_rounded : Icons.shopping_bag_outlined,
                              size: 18,
                            ),
                      label: Text(
                        documentMode == 'Bill' ? 'Save Bill' : 'Place Order',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.navy900,
                        disabledBackgroundColor: AppColors.border,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
