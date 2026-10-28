import 'package:flutter/material.dart';

import '../models/customer.dart';
import '../models/product.dart';
import '../models/saved_bill.dart';
import '../models/saved_order.dart';
import '../screens/bill_detail_screen.dart';
import '../screens/bill_screen.dart';
import '../screens/customer_ledger_detail_screen.dart';
import '../screens/inventory_screen.dart';
import '../screens/order_cart_screen.dart';
import '../screens/order_detail_screen.dart';
import '../screens/payment_detail_screen.dart';
import '../screens/product_detail_screen.dart';

enum NavTab { home, catalog, billing, orders, more }

/// Centralized Navigation Controller providing unified routing, back-stack preservation,
/// reference-based deep navigation, and seamless workflow routing.
class AppNavigation {
  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  static final ValueNotifier<int> currentTabNotifier = ValueNotifier<int>(0);

  /// Navigates to one of the 5 main bottom destinations:
  /// 0: Home, 1: Catalog, 2: Billing, 3: Orders, 4: More
  static void toTab(BuildContext context, int tabIndex) {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
    currentTabNotifier.value = tabIndex;
  }

  /// Opens the Product Details screen by model or SKU
  static void openProductDetails(BuildContext context, {Product? product, String? productCode}) {
    final code = product?.code ?? productCode;
    if (code == null || code.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductDetailScreen(
          initialProduct: product,
          productCode: code,
        ),
      ),
    );
  }

  /// Opens the Bill Details screen by model or invoice number
  static void openBillDetails(BuildContext context, {SavedBill? bill, String? invoiceNo}) {
    final inv = bill?.billNumber ?? invoiceNo;
    if (bill == null && (inv == null || inv.isEmpty)) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BillDetailScreen(
          initialBill: bill,
          invoiceNo: inv,
        ),
      ),
    );
  }

  /// Opens the Order Details screen by model or order number
  static void openOrderDetails(BuildContext context, {SavedOrder? order, String? orderNo}) {
    final num = order?.orderNumber ?? orderNo;
    if (order == null && (num == null || num.isEmpty)) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OrderDetailScreen(
          initialOrder: order,
          orderNo: num,
        ),
      ),
    );
  }

  /// Opens the Customer Ledger / Profile screen
  static void openCustomerProfile(BuildContext context, {Customer? customer, String? customerName, String? mobile}) {
    final name = customer?.name ?? customerName ?? 'Customer';
    final cust = customer ??
        Customer(
          id: '0',
          name: name,
          mobile: mobile ?? '',
          currentBalance: 0.0,
        );

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CustomerLedgerDetailScreen(
          partyName: name,
          customer: cust,
        ),
      ),
    );
  }

  /// Opens Payment Details screen
  static void openPaymentDetails(
    BuildContext context, {
    required String paymentRef,
    required String customerName,
    required double amount,
    required DateTime date,
    String mode = 'Cash',
    String? invoiceNo,
    String? notes,
  }) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PaymentDetailScreen(
          paymentRef: paymentRef,
          customerName: customerName,
          amount: amount,
          date: date,
          mode: mode,
          invoiceNo: invoiceNo,
          notes: notes,
        ),
      ),
    );
  }

  /// Opens Inventory screen with optional search filter
  static void openInventory(BuildContext context, {String? filterCode}) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const InventoryScreen(),
      ),
    );
  }

  /// Opens Create / Edit Bill workflow
  static void openCreateBill(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const BillScreen(),
      ),
    );
  }

  /// Opens Create / Edit Order workflow
  static void openCreateOrder(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const OrderCartScreen(),
      ),
    );
  }
}
