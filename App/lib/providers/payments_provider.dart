import 'package:flutter/foundation.dart';

import '../models/payment.dart';
import '../models/saved_payment.dart' as sp;
import '../services/supabase_service.dart';

class PaymentsProvider with ChangeNotifier {
  final SupabaseService _supabaseService = SupabaseService();
  List<Payment> _payments = [];
  bool _loaded = false;
  bool _syncing = false;
  String? _syncError;

  List<Payment> get payments => _payments;
  bool get loaded => _loaded;
  bool get syncing => _syncing;
  String? get syncError => _syncError;

  Future<void> syncFromSupabase() async {
    if (_syncing) return;
    _syncing = true;
    _syncError = null;
    notifyListeners();

    try {
      final savedPayments = await _supabaseService.fetchPayments();
      _payments = savedPayments
          .map((spItem) => Payment(
                id: spItem.receiptNumber,
                customerName: spItem.customerName,
                date: spItem.date,
                amount: spItem.amount,
                method: PaymentMethod.fromLabel(spItem.method.name),
                transactionId: spItem.transactionId,
                remarks: spItem.remarks,
              ))
          .toList();
      _loaded = true;
    } catch (e) {
      _syncError = e.toString();
    } finally {
      _syncing = false;
      notifyListeners();
    }
  }

  /// Backward-compatible alias for syncFromDrive()
  Future<void> syncFromDrive() => syncFromSupabase();

  Future<bool> addPayment(Payment payment, {String? customerId}) async {
    _syncing = true;
    notifyListeners();

    try {
      sp.PaymentMethod spMethod = sp.PaymentMethod.cash;
      final mName = payment.method.label.toLowerCase();
      if (mName.contains('upi')) {
        spMethod = sp.PaymentMethod.upi;
      } else if (mName.contains('card')) {
        spMethod = sp.PaymentMethod.card;
      } else if (mName.contains('bank')) {
        spMethod = sp.PaymentMethod.bankTransfer;
      }

      final spPayment = sp.SavedPayment(
        receiptNumber: payment.id.isNotEmpty ? payment.id : 'RCP-${DateTime.now().millisecondsSinceEpoch}',
        date: payment.date,
        customerName: payment.customerName,
        customerId: customerId ?? '',
        billNumber: '',
        amount: payment.amount,
        method: spMethod,
        transactionId: payment.transactionId ?? '',
        remarks: payment.remarks ?? '',
        outstandingBalanceAfter: 0.0,
      );

      await _supabaseService.recordPayment(spPayment);
      _payments.insert(0, payment);
      _syncing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _syncError = 'Failed to save payment: $e';
      _syncing = false;
      notifyListeners();
      rethrow;
    }
  }
}
