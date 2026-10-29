import 'package:flutter/foundation.dart';

import '../models/saved_bill.dart';
import '../models/saved_payment.dart';
import '../services/bills_store_service.dart';
import '../services/payments_store_service.dart';
import '../services/supabase_service.dart';

class BillsProvider extends ChangeNotifier {
  final BillsStoreService _store = BillsStoreService();
  final PaymentsStoreService _paymentsStore = PaymentsStoreService();
  final SupabaseService _supabaseService = SupabaseService();

  String? lastDriveSyncError;
  String? lastDrivePdfSyncError;
  String? lastPaymentSyncError;

  bool syncing = false;
  String? syncError;

  List<SavedBill> bills = [];
  bool loaded = false;

  List<SavedPayment> paymentReceipts = [];

  Future<void> load() async {
    bills = await _store.loadBills();
    bills.sort((a, b) => b.date.compareTo(a.date));
    paymentReceipts = await _paymentsStore.loadPayments();
    paymentReceipts.sort((a, b) => b.date.compareTo(a.date));
    loaded = true;
    notifyListeners();
    // Silently refresh from Supabase PostgreSQL in background
    syncFromSupabase();
  }

  /// Pulls sales invoices and payments from Supabase PostgreSQL and merges
  /// with local cache (preserving local PDF paths).
  Future<void> syncFromSupabase() async {
    syncing = true;
    syncError = null;
    notifyListeners();
    try {
      final supabaseBills = await _supabaseService.fetchBills();
      final localByNumber = {for (final b in bills) b.billNumber: b};

      final merged = <SavedBill>[];
      for (final db in supabaseBills) {
        final local = localByNumber.remove(db.billNumber);
        if (local != null) {
          db.pdfPath = local.pdfPath;
          db.imagePath = local.imagePath;
        }
        merged.add(db);
      }
      merged.addAll(localByNumber.values);

      bills = merged;
      bills.sort((a, b) => b.date.compareTo(a.date));
      await _store.saveBills(bills);

      final supabasePayments = await _supabaseService.fetchPayments();
      if (supabasePayments.isNotEmpty) {
        paymentReceipts = supabasePayments;
        paymentReceipts.sort((a, b) => b.date.compareTo(a.date));
        await _paymentsStore.savePayments(paymentReceipts);
      }
      syncError = null;
    } catch (e) {
      syncError = e.toString();
    }
    syncing = false;
    loaded = true;
    notifyListeners();
  }

  /// Backward-compatible alias for UI components calling syncFromDrive()
  Future<void> syncFromDrive({List<dynamic>? withPayments}) => syncFromSupabase();

  Future<SavedBill> addBill(
    SavedBill bill, {
    dynamic customerId,
    String paymentMethod = 'cash',
    double billDiscount = 0.0,
  }) async {
    // 1. Authoritative persistence in PostgreSQL via backend
    final backendBill = await _supabaseService.createBill(
      bill,
      customerId: customerId,
      paymentMethod: paymentMethod,
      billDiscount: billDiscount,
    );

    // 2. Insert into bills list only once backend confirms persistence
    bills.removeWhere((b) => b.billNumber == backendBill.billNumber);
    bills.insert(0, backendBill);
    await _store.saveBills(bills);
    debugPrint('✅ Bill Persisted & Saved: ${backendBill.billNumber}');
    notifyListeners();
    return backendBill;
  }

  /// Manual status override
  Future<void> setStatus(String billNumber, BillStatus status) async {
    SavedBill? target;
    for (final b in bills) {
      if (b.billNumber == billNumber) {
        target = b;
        break;
      }
    }
    if (target == null) return;

    target.status = status;
    target.paidAmount = status == BillStatus.paid ? target.total : 0;

    debugPrint('🔄 Bill Status Updated: ${target.billNumber} -> ${status.label}');
    await _store.saveBills(bills);
    notifyListeners();
    try {
      await _supabaseService.updateBillStatus(target.billNumber, status, paidAmount: target.paidAmount);
    } catch (e) {
      lastDriveSyncError = e.toString();
    }
  }

  Future<void> deleteBill(String billNumber) async {
    bills.removeWhere((b) => b.billNumber == billNumber);
    await _store.saveBills(bills);
    notifyListeners();
  }

  /// Records a payment against [bill] — marks it Paid, generates a
  /// Payment Collect Receipt, saves locally, and syncs to Supabase PostgreSQL.
  Future<SavedPayment> receivePayment({
    required SavedBill bill,
    required double amount,
    required PaymentMethod method,
    String customerId = '',
    String transactionId = '',
    String remarks = '',
  }) async {
    final receiptNumber = await _paymentsStore.nextReceiptNumber();

    bill.paidAmount = (bill.paidAmount + amount).clamp(0, bill.total);
    const epsilon = 0.01;
    bill.status = (bill.total - bill.paidAmount) <= epsilon
        ? BillStatus.paid
        : BillStatus.unpaid;

    final remainingDue = billsForParty(bill.customerName)
        .where((b) => b.status != BillStatus.cancelled)
        .fold(0.0, (s, b) => s + b.due);

    final payment = SavedPayment(
      receiptNumber: receiptNumber,
      date: DateTime.now(),
      customerName: bill.customerName,
      customerId: customerId,
      billNumber: bill.billNumber,
      amount: amount,
      method: method,
      transactionId: transactionId,
      remarks: remarks,
      outstandingBalanceAfter: remainingDue,
    );

    paymentReceipts.insert(0, payment);
    await _paymentsStore.savePayments(paymentReceipts);
    await _store.saveBills(bills);
    notifyListeners();

    debugPrint('💸 Payment Recorded for Bill: ${bill.billNumber} '
        '(₹$amount collected, ₹${bill.due} still due)');

    try {
      await _supabaseService.recordPayment(payment);
      await _supabaseService.updateBillStatus(bill.billNumber, bill.status, paidAmount: bill.paidAmount);
    } catch (e) {
      lastPaymentSyncError = e.toString();
    }
    return payment;
  }

  // ---- Home dashboard stats ----

  double get totalSales => bills
      .where((b) => b.status != BillStatus.cancelled)
      .fold(0, (s, b) => s + b.total);

  double get totalDue => bills
      .where((b) => b.status == BillStatus.unpaid)
      .fold(0, (s, b) => s + b.due);

  int get totalBillsCount => bills.length;

  bool _isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  double get todaysSales {
    final now = DateTime.now();
    return bills
        .where(
            (b) => b.status != BillStatus.cancelled && _isSameDay(b.date, now))
        .fold(0, (s, b) => s + b.total);
  }

  int get todaysBillsCount {
    final now = DateTime.now();
    return bills.where((b) => _isSameDay(b.date, now)).length;
  }

  double get monthlySales {
    final now = DateTime.now();
    return bills
        .where((b) =>
            b.status != BillStatus.cancelled &&
            b.date.year == now.year &&
            b.date.month == now.month)
        .fold(0, (s, b) => s + b.total);
  }

  List<SavedBill> get recentBills => bills.take(4).toList();

  // ---- Bills list (All / Paid / Unpaid / Cancelled) ----

  List<SavedBill> billsByStatus(BillStatus? status) {
    if (status == null) return bills;
    return bills.where((b) => b.status == status).toList();
  }

  List<SavedBill> search(List<SavedBill> source, String query) {
    if (query.trim().isEmpty) return source;
    final q = query.toLowerCase();
    return source
        .where((b) =>
            b.billNumber.toLowerCase().contains(q) ||
            b.customerName.toLowerCase().contains(q) ||
            b.customerBillLabel.toLowerCase().contains(q))
        .toList();
  }

  // ---- Ledger (Parties) ----

  List<LedgerParty> get parties {
    final map = <String, List<SavedBill>>{};
    for (final b in bills) {
      if (b.customerName.trim().isEmpty) continue;
      map.putIfAbsent(b.customerName, () => []).add(b);
    }
    return map.entries
        .map((e) => LedgerParty(
              name: e.key,
              totalDue: e.value
                  .where((b) => b.status == BillStatus.unpaid)
                  .fold(0.0, (s, b) => s + b.due),
              billCount: e.value.length,
            ))
        .toList()
      ..sort((a, b) => b.totalDue.compareTo(a.totalDue));
  }

  double get totalPartyDue => parties.fold(0, (s, p) => s + p.totalDue);

  int get totalPartyCount => parties.length;

  List<SavedBill> get payments =>
      bills.where((b) => b.status == BillStatus.paid).toList();

  List<SavedBill> billsForParty(String name) {
    final list = bills.where((b) => b.customerName == name).toList();
    list.sort((a, b) => a.date.compareTo(b.date));
    return list;
  }

  List<LedgerParty> get outstandingParties =>
      parties.where((p) => p.totalDue > 0).toList();
}
