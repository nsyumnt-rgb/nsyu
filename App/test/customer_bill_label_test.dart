import 'package:flutter_test/flutter_test.dart';
import 'package:nsyu_catalog_app/models/saved_bill.dart';
import 'package:nsyu_catalog_app/providers/bills_provider.dart';

void main() {
  group('Customer-Based Dynamic Bill Label Tests', () {
    test('Exact format test: Mohd_Nazim_2026_10_28_0001', () {
      final bill = SavedBill(
        billNumber: 'INV-001',
        // 28 Oct 2026, 00:01 (24-hour clock)
        date: DateTime(2026, 10, 28, 0, 1),
        customerName: 'Mohd Nazim',
        items: [
          SavedBillItem(desc: 'Cable', qty: 1, price: 100),
        ],
      );

      expect(bill.customerBillLabel, equals('Mohd_Nazim_2026_10_28_0001'));
    });

    test('Customer name sanitization handles spaces and special characters', () {
      expect(SavedBill.sanitizeCustomerName('Mohd Nazim'), 'Mohd_Nazim');
      expect(SavedBill.sanitizeCustomerName('Mohd. Nazim'), 'Mohd_Nazim');
      expect(SavedBill.sanitizeCustomerName('  Mohd   Nazim  '), 'Mohd_Nazim');
      expect(SavedBill.sanitizeCustomerName('Mohd-Nazim'), 'Mohd_Nazim');
      expect(SavedBill.sanitizeCustomerName('Dr. Rajesh K. Sharma & Co.'), 'Dr_Rajesh_K_Sharma_Co');
      expect(SavedBill.sanitizeCustomerName(''), 'Walk_in_Customer');
      expect(SavedBill.sanitizeCustomerName(null), 'Walk_in_Customer');
      expect(SavedBill.sanitizeCustomerName('   '), 'Walk_in_Customer');
      expect(SavedBill.sanitizeCustomerName(r'@#$%^'), 'Customer');
    });

    test('Timestamp formatting handles 24-hour clock, zero-padding and various times', () {
      final billAfternoon = SavedBill(
        billNumber: 'INV-002',
        date: DateTime(2026, 10, 28, 14, 35),
        customerName: 'Mohd Nazim',
        items: [],
      );
      expect(billAfternoon.customerBillLabel, equals('Mohd_Nazim_2026_10_28_1435'));

      final billMorning = SavedBill(
        billNumber: 'INV-003',
        date: DateTime(2026, 5, 4, 9, 5),
        customerName: 'Aman Verma',
        items: [],
      );
      expect(billMorning.customerBillLabel, equals('Aman_Verma_2026_05_04_0905'));

      final billMidnight = SavedBill(
        billNumber: 'INV-004',
        date: DateTime(2026, 12, 31, 23, 59),
        customerName: 'Deepak Rao',
        items: [],
      );
      expect(billMidnight.customerBillLabel, equals('Deepak_Rao_2026_12_31_2359'));
    });

    test('Missing values and safe fallbacks without crashing', () {
      // Missing customer and missing date in JSON
      final billFromEmptySupabase = SavedBill.fromSupabase({
        'invoice_number': 'INV-TEST-009',
        // customer missing
        // date missing
      });

      expect(billFromEmptySupabase.customerName, equals('Walk-in Customer'));
      expect(billFromEmptySupabase.customerBillLabel, startsWith('Walk_in_Customer_2026_01_01_'));
    });

    test('Real PostgreSQL sales record mapping from Supabase API', () {
      final realRecord = {
        'id': '18',
        'owner_id': 1,
        'shop_id': 1,
        'customer_id': 3,
        'invoice_number': 'INV-NSYUMAIN-000011',
        'invoice_date': '2026-10-27T15:17:49.287Z',
        'subtotal': '3127.00',
        'total_amount': '3127.00',
        'paid_amount': '3127.00',
        'due_amount': '0.00',
        'status': 'paid',
        'customer': {
          'id': 3,
          'name': 'Demo Customer 03',
          'phone': '9810000012',
        },
        'items': [
          {
            'product_name': 'Samsung A55 Case',
            'quantity': 1,
            'rate': '229.00',
          }
        ]
      };

      final bill = SavedBill.fromSupabase(realRecord);
      expect(bill.billNumber, 'INV-NSYUMAIN-000011');
      expect(bill.customerName, 'Demo Customer 03');
      expect(bill.total, 229.0);
      expect(bill.status, BillStatus.paid);

      // Verify label format matches Demo_Customer_03_yyyy_MM_dd_HHmm
      final label = bill.customerBillLabel;
      expect(label.startsWith('Demo_Customer_03_'), isTrue);
      // Ensure it has 4 parts: Customer_Name, yyyy, MM, dd, HHmm
      final parts = label.split('_');
      expect(parts.length, greaterThanOrEqualTo(5));
      expect(RegExp(r'^\d{4}$').hasMatch(label.substring(label.length - 4)), isTrue);
    });

    test('BillsProvider.search finds bills by customerBillLabel', () {
      final provider = BillsProvider();
      final bill1 = SavedBill(
        billNumber: 'INV-100',
        date: DateTime(2026, 10, 28, 0, 1),
        customerName: 'Mohd Nazim',
        items: [],
      );
      final bill2 = SavedBill(
        billNumber: 'INV-101',
        date: DateTime(2026, 10, 27, 14, 0),
        customerName: 'Suresh Kumar',
        items: [],
      );

      final list = [bill1, bill2];

      // Search by label substring
      final searchByLabel = provider.search(list, 'Mohd_Nazim');
      expect(searchByLabel.length, equals(1));
      expect(searchByLabel.first.billNumber, equals('INV-100'));

      // Search by timestamp in label
      final searchByDate = provider.search(list, '2026_10_28_0001');
      expect(searchByDate.length, equals(1));
      expect(searchByDate.first.customerName, equals('Mohd Nazim'));

      // Search by original invoice number
      final searchByInv = provider.search(list, 'INV-101');
      expect(searchByInv.length, equals(1));
      expect(searchByInv.first.customerName, equals('Suresh Kumar'));
    });
  });
}
