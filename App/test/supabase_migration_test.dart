import 'package:flutter_test/flutter_test.dart';
import 'package:nsyu_catalog_app/config/supabase_config.dart';
import 'package:nsyu_catalog_app/models/customer.dart';
import 'package:nsyu_catalog_app/models/product.dart';
import 'package:nsyu_catalog_app/models/saved_bill.dart';
import 'package:nsyu_catalog_app/models/saved_payment.dart';

void main() {
  group('Supabase PostgreSQL Data Mapping Tests', () {
    test('Product.fromSupabase correctly maps PostgreSQL products table schema', () {
      final json = {
        'id': 101,
        'sku': 'SKU-TEST-001',
        'name': 'Tempered Glass 9D',
        'description': 'Full edge-to-edge glue',
        'brand': 'Gorilla',
        'purchase_price': '45.50',
        'selling_price': '99.00',
        'mrp': '120.00',
        'min_stock': 10,
        'category': {'id': 5, 'name': 'Screen Protectors'},
        'stocks': [
          {'current_stock': 150}
        ]
      };

      final product = Product.fromSupabase(json, index: 1);
      expect(product.sno, 1);
      expect(product.code, 'SKU-TEST-001');
      expect(product.desc, 'Tempered Glass 9D');
      expect(product.spec, 'Full edge-to-edge glue');
      expect(product.category, 'Screen Protectors');
      expect(product.purchase, 45.50);
      expect(product.sellingPrice, 99.00);
      expect(product.marginPrice, closeTo(53.50, 0.01));
      expect(product.stock, 150);
      expect(product.pkg, 10);
    });

    test('Customer.fromSupabase correctly maps PostgreSQL customers table schema', () {
      final json = {
        'id': 42,
        'name': 'Rahul Sharma',
        'phone': '9876543210',
        'current_balance': '1500.00',
        'opening_balance': '0.00'
      };

      final customer = Customer.fromSupabase(json);
      expect(customer.id, '42');
      expect(customer.name, 'Rahul Sharma');
      expect(customer.mobile, '9876543210');
    });

    test('SavedBill.fromSupabase correctly maps PostgreSQL sales & sale_items tables', () {
      final json = {
        'id': 12,
        'invoice_number': 'INV-2026-00042',
        'invoice_date': '2026-10-27T10:30:00Z',
        'customer': {'id': 42, 'name': 'Rahul Sharma'},
        'total_amount': '495.00',
        'paid_amount': '495.00',
        'status': 'paid',
        'items': [
          {
            'product_name': 'Fast Charger 20W Type-C',
            'quantity': 2,
            'unit_price': '200.00',
            'total_price': '400.00'
          },
          {
            'product_name': 'Braided Cable 1m',
            'quantity': 1,
            'unit_price': '95.00',
            'total_price': '95.00'
          }
        ]
      };

      final bill = SavedBill.fromSupabase(json);
      expect(bill.billNumber, 'INV-2026-00042');
      expect(bill.customerName, 'Rahul Sharma');
      expect(bill.status, BillStatus.paid);
      expect(bill.paidAmount, 495.00);
      expect(bill.items.length, 2);
      expect(bill.items[0].desc, 'Fast Charger 20W Type-C');
      expect(bill.items[0].qty, 2);
      expect(bill.items[0].price, 200.00);
      expect(bill.total, 495.00);
      expect(bill.due, 0.0);
    });

    test('SavedPayment.fromSupabase correctly maps PostgreSQL payments table', () {
      final json = {
        'id': 88,
        'customer_id': 42,
        'customer': {'id': 42, 'name': 'Rahul Sharma'},
        'sale': {'invoice_number': 'INV-2026-00042'},
        'amount': '500.00',
        'method': 'upi',
        'transaction_id': 'UPI-REF-998877',
        'payment_date': '2026-10-27T11:00:00Z',
        'notes': 'Advance payment settled',
        'outstanding_balance_after': '0.00'
      };

      final payment = SavedPayment.fromSupabase(json);
      expect(payment.receiptNumber, 'RCPT-88');
      expect(payment.customerName, 'Rahul Sharma');
      expect(payment.customerId, '42');
      expect(payment.billNumber, 'INV-2026-00042');
      expect(payment.amount, 500.00);
      expect(payment.method, PaymentMethod.upi);
      expect(payment.transactionId, 'UPI-REF-998877');
      expect(payment.remarks, 'Advance payment settled');
      expect(payment.outstandingBalanceAfter, 0.0);
    });

    test('SupabaseConfig provides valid configuration and endpoints', () {
      expect(SupabaseConfig.supabaseUrl, isNotEmpty);
      expect(SupabaseConfig.apiUrl, isNotEmpty);
      expect(SupabaseConfig.shopId, 1);
    });
  });
}
