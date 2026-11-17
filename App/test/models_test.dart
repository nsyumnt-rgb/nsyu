// Unit tests for pure model logic (no device, network or Supabase needed).
// Run with: flutter test
import 'package:flutter_test/flutter_test.dart';
import 'package:nsyu_catalog_app/models/bill_item.dart';
import 'package:nsyu_catalog_app/models/customer_ledger_entry.dart';

void main() {
  group('BillItem', () {
    test('amount is price × quantity', () {
      final item = BillItem(code: 'CH25', desc: 'Charger', spec: '25W', price: 499.5, qty: 3);
      expect(item.amount, closeTo(1498.5, 0.001));
    });

    test('editing qty and price updates the amount', () {
      final item = BillItem(code: 'CB1', desc: 'Cable', spec: '1m', price: 150);
      expect(item.amount, 150);
      item.qty = 4;
      item.price = 140;
      expect(item.amount, 560);
    });
  });

  group('CustomerLedgerEntry.fromJson', () {
    test('parses snake_case API rows', () {
      final e = CustomerLedgerEntry.fromJson({
        'id': '12',
        'customer_id': 7,
        'shop_id': '3',
        'entry_type': 'debit',
        'amount': '1250.75',
        'running_balance': 1250.75,
        'reference_type': 'Sale',
        'reference_id': '44',
        'description': 'Bill INV-44',
        'entry_date': '2026-11-17T10:00:00Z',
        'shop': {'name': 'Shop A', 'code': 'SA'},
      });
      expect(e.id, 12);
      expect(e.customerId, 7);
      expect(e.shopId, 3);
      expect(e.isDebit, isTrue);
      expect(e.debitAmount, closeTo(1250.75, 0.001));
      expect(e.creditAmount, 0);
      expect(e.referenceId, 44);
      expect(e.shopName, 'Shop A');
      expect(e.shopCode, 'SA');
      expect(e.typeDisplay, 'Sale / Bill');
    });

    test('parses camelCase rows and credit entries', () {
      final e = CustomerLedgerEntry.fromJson({
        'id': 1,
        'customerId': 2,
        'shopId': 3,
        'entryType': 'CREDIT',
        'amount': 500,
        'runningBalance': 750,
        'referenceType': 'Payment',
        'entryDate': '2026-11-01T08:30:00',
      });
      expect(e.isCredit, isTrue);
      expect(e.creditAmount, 500);
      expect(e.debitAmount, 0);
      expect(e.runningBalance, 750);
      expect(e.typeDisplay, 'Payment Received');
    });

    test('missing or bad values fall back safely', () {
      final e = CustomerLedgerEntry.fromJson({'amount': 'not-a-number'});
      expect(e.id, 0);
      expect(e.amount, 0);
      expect(e.entryType, 'debit');
      expect(e.status, 'active');
    });

    test('toJson round-trips the core fields', () {
      final e = CustomerLedgerEntry.fromJson({
        'id': 5, 'customer_id': 6, 'shop_id': 7, 'entry_type': 'credit', 'amount': 99,
        'running_balance': 1, 'reference_type': 'Payment', 'entry_date': '2026-11-02T00:00:00',
      });
      final again = CustomerLedgerEntry.fromJson(e.toJson());
      expect(again.id, e.id);
      expect(again.entryType, e.entryType);
      expect(again.amount, e.amount);
      expect(again.entryDate, e.entryDate);
    });
  });
}
