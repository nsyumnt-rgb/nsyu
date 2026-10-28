import 'package:uuid/uuid.dart';

enum PaymentMethod {
  cash('Cash'),
  upi('UPI'),
  bank('Bank Transfer'),
  cheque('Cheque');

  const PaymentMethod(this.label);
  final String label;

  static PaymentMethod fromLabel(String label) {
    for (final method in values) {
      if (method.label.toLowerCase() == label.toLowerCase()) {
        return method;
      }
    }
    return PaymentMethod.cash;
  }
}

class Payment {
  final String id;
  final DateTime date;
  final String customerName;
  final double amount;
  final PaymentMethod method;
  final String? transactionId;
  final String? remarks;

  Payment({
    String? id,
    required this.date,
    required this.customerName,
    required this.amount,
    required this.method,
    this.transactionId,
    this.remarks,
  }) : id = id ?? const Uuid().v4();

  List<dynamic> toSheetRow() => [
        id,
        '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
        customerName,
        amount,
        method.label,
        transactionId ?? '',
        remarks ?? '',
      ];
}
