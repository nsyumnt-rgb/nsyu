import 'package:flutter_test/flutter_test.dart';
import 'package:nsyu_catalog_app/models/product.dart';
import 'package:nsyu_catalog_app/models/bill_item.dart';
import 'package:nsyu_catalog_app/models/saved_bill.dart';
import 'package:nsyu_catalog_app/models/saved_order.dart';
import 'package:nsyu_catalog_app/models/customer_ledger_entry.dart';

void main() {
  group('NSYU Mobile Models & Calculations Test Suite', () {
    test('Product model calculations: selling_price = purchase_price + margin', () {
      final product = Product(
        sno: 1,
        code: 'PROD-001',
        desc: 'Premium Basmati Rice',
        spec: '5kg Bag',
        pkg: 1,
        category: 'Grains',
        purchase: 100.0,
        marginPrice: 20.0,
        sellingPrice: 120.0,
        stock: 50,
      );

      expect(product.desc, 'Premium Basmati Rice');
      expect(product.sellingPrice, 120.0);
      expect(product.purchase, 100.0);
      expect(product.marginAmount, 20.0);
      expect(product.slPrice, 120.0);
    });

    test('BillItem calculation with editable quantity and price', () {
      final item = BillItem(
        code: 'FLOUR-01',
        desc: 'Organic Wheat Flour',
        spec: '10kg',
        price: 55.0,
        qty: 10,
        availableStock: 100,
      );

      expect(item.price, 55.0);
      expect(item.qty, 10);
      expect(item.amount, 550.0);

      // Verify editable price and quantity update
      item.price = 52.0;
      item.qty = 15;
      expect(item.price, 52.0);
      expect(item.qty, 15);
      expect(item.amount, 780.0);
    });

    test('SavedBill payment status and calculations', () {
      final bill = SavedBill(
        id: 101,
        billNumber: 'INV-2026-001',
        date: DateTime.now(),
        customerName: 'Aarav Sharma',
        customerPhone: '9876543210',
        items: [
          SavedBillItem(productId: 1, desc: 'Product A', qty: 10, price: 100.0),
        ],
        status: BillStatus.unpaid,
        paidAmount: 0.0,
      );

      // 1. Unpaid status
      expect(bill.status, BillStatus.unpaid);
      expect(bill.subtotal, 1000.0);
      expect(bill.total, 1000.0);
      expect(bill.total - bill.paidAmount, 1000.0);

      // 2. Partial status
      bill.paidAmount = 400.0;
      expect(bill.total - bill.paidAmount, 600.0);

      // 3. Paid status
      bill.paidAmount = 1000.0;
      bill.status = BillStatus.paid;
      expect(bill.isPaid, true);
      expect(bill.total - bill.paidAmount, 0.0);
    });

    test('Negative stock allows bill creation without throwing exception', () {
      final productShortStock = Product(
        sno: 99,
        code: 'WIDGET-01',
        desc: 'Out of Stock Widget',
        spec: 'Standard',
        pkg: 1,
        category: 'Hardware',
        purchase: 200.0,
        marginPrice: 50.0,
        sellingPrice: 250.0,
        stock: -5, // already negative or zero
      );

      final item = BillItem.fromProduct(productShortStock);
      item.qty = 2;

      expect(item.amount, 500.0);
      // New stock balance becomes -7
      final newBalance = productShortStock.stock - item.qty;
      expect(newBalance, -7);
    });

    test('SavedOrder status transitions and convertedSaleId', () {
      final order = SavedOrder(
        id: 501,
        orderNumber: 'ORD-2026-001',
        date: DateTime.now(),
        customerName: 'Priya Patel',
        customerPhone: '9123456789',
        items: [
          SavedOrderItem(desc: 'Order Item', qty: 10, price: 500.0),
        ],
        status: OrderStatus.pending,
      );

      expect(order.totalAmount, 5000.0);
      expect(order.convertedSaleId, isNull);
      expect(order.status, OrderStatus.pending);

      // Status transitions
      order.status = OrderStatus.confirmed;
      expect(order.status, OrderStatus.confirmed);

      order.status = OrderStatus.delivered;
      expect(order.status, OrderStatus.delivered);

      order.status = OrderStatus.convertedToBill;
      expect(order.status, OrderStatus.convertedToBill);
      expect(OrderStatusLabel(order.status).label, 'Converted to Bill');
    });

    test('CustomerLedgerEntry preserves debit, credit and reversal entries', () {
      final debit = CustomerLedgerEntry(
        id: 1,
        customerId: 1,
        shopId: 1,
        entryType: 'debit',
        amount: 2500.0,
        runningBalance: 2500.0,
        referenceType: 'Sale',
        description: 'Bill #INV-2026-002',
        entryDate: DateTime.now(),
      );
      expect(debit.isDebit, true);
      expect(debit.debitAmount, 2500.0);
      expect(debit.creditAmount, 0.0);

      final credit = CustomerLedgerEntry(
        id: 2,
        customerId: 1,
        shopId: 1,
        entryType: 'credit',
        amount: 1000.0,
        runningBalance: 1500.0,
        referenceType: 'Payment',
        description: 'UPI Payment received',
        entryDate: DateTime.now(),
      );
      expect(credit.isCredit, true);
      expect(credit.creditAmount, 1000.0);
      expect(credit.debitAmount, 0.0);

      final reversal = CustomerLedgerEntry(
        id: 3,
        customerId: 1,
        shopId: 1,
        entryType: 'reversal',
        amount: 2500.0,
        runningBalance: -1000.0,
        referenceType: 'SaleReturn',
        description: 'Cancellation reversal for Bill #INV-2026-002',
        entryDate: DateTime.now(),
        status: 'reversed',
      );
      expect(reversal.entryType, 'reversal');
      expect(reversal.amount, 2500.0);
      expect(reversal.status, 'reversed');
    });
  });
}
