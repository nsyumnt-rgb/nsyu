import 'package:flutter/material.dart';

import '../navigation/app_navigation.dart';

enum ReferenceType {
  bill,
  order,
  customer,
  product,
  payment,
  stock,
}

/// A typed, interactive reference widget that renders clickable identifiers
/// (e.g. invoice numbers, order numbers, customer names, SKUs, payment references)
/// and seamlessly navigates to their corresponding detail screens.
class ReferenceLink extends StatelessWidget {
  final ReferenceType type;
  final String label;
  final String? referenceId;
  final TextStyle? style;
  final bool showIcon;
  final VoidCallback? customAction;

  const ReferenceLink({
    super.key,
    required this.type,
    required this.label,
    this.referenceId,
    this.style,
    this.showIcon = false,
    this.customAction,
  });

  Color _getColor() {
    switch (type) {
      case ReferenceType.bill:
        return const Color(0xFF1D4ED8);
      case ReferenceType.order:
        return const Color(0xFF0D9488);
      case ReferenceType.customer:
        return const Color(0xFF0F172A);
      case ReferenceType.product:
        return const Color(0xFF2563EB);
      case ReferenceType.payment:
        return const Color(0xFF16A34A);
      case ReferenceType.stock:
        return const Color(0xFFD97706);
    }
  }

  IconData _getIcon() {
    switch (type) {
      case ReferenceType.bill:
        return Icons.receipt_long;
      case ReferenceType.order:
        return Icons.shopping_bag_outlined;
      case ReferenceType.customer:
        return Icons.person_outline;
      case ReferenceType.product:
        return Icons.inventory_2_outlined;
      case ReferenceType.payment:
        return Icons.payment_outlined;
      case ReferenceType.stock:
        return Icons.swap_horiz_rounded;
    }
  }

  void _handleTap(BuildContext context) {
    if (customAction != null) {
      customAction!();
      return;
    }

    final id = referenceId ?? label;

    switch (type) {
      case ReferenceType.bill:
        AppNavigation.openBillDetails(context, invoiceNo: id);
        break;
      case ReferenceType.order:
        AppNavigation.openOrderDetails(context, orderNo: id);
        break;
      case ReferenceType.customer:
        AppNavigation.openCustomerProfile(context, customerName: id);
        break;
      case ReferenceType.product:
        AppNavigation.openProductDetails(context, productCode: id);
        break;
      case ReferenceType.payment:
        AppNavigation.openPaymentDetails(
          context,
          paymentRef: id,
          customerName: '',
          amount: 0.0,
          date: DateTime.now(),
        );
        break;
      case ReferenceType.stock:
        AppNavigation.openInventory(context, filterCode: id);
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _getColor();

    return InkWell(
      onTap: () => _handleTap(context),
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (showIcon) ...[
              Icon(_getIcon(), size: 13, color: color),
              const SizedBox(width: 4),
            ],
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: style ??
                    TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: color,
                      decoration: TextDecoration.underline,
                      decorationColor: color.withOpacity(0.4),
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
