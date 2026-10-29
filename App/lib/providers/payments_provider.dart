import 'package:flutter/foundation.dart';

import '../models/payment.dart';
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
          .map((sp) => Payment(
                id: sp.receiptNumber,
                customerName: sp.customerName,
                date: sp.date,
                amount: sp.amount,
                method: PaymentMethod.fromLabel(sp.method.name),
                transactionId: sp.transactionId,
                remarks: sp.remarks,
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

  Future<bool> addPayment(Payment payment) async {
    _syncing = true;
    notifyListeners();

    try {
      _payments.add(payment);
      _syncing = false;
      notifyListeners();
      return true;
    } catch (e) {
      _syncError = 'Failed to save payment: $e';
      _syncing = false;
      notifyListeners();
      return false;
    }
  }
}
