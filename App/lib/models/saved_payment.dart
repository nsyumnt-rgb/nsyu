enum PaymentMethod { upi, cash, card, bankTransfer }

extension PaymentMethodLabel on PaymentMethod {
  String get label {
    switch (this) {
      case PaymentMethod.upi:
        return 'UPI';
      case PaymentMethod.cash:
        return 'Cash';
      case PaymentMethod.card:
        return 'Card';
      case PaymentMethod.bankTransfer:
        return 'Bank Transfer';
    }
  }

  static PaymentMethod fromLabel(String s) {
    switch (s.toLowerCase()) {
      case 'cash':
        return PaymentMethod.cash;
      case 'card':
        return PaymentMethod.card;
      case 'bank transfer':
        return PaymentMethod.bankTransfer;
      default:
        return PaymentMethod.upi;
    }
  }
}

/// One "Payment Collect Receipt" — generated whenever a payment is received
/// against a customer's outstanding balance. Matches the NSYU receipt
/// design: receipt number, customer, amount, method, transaction ID,
/// remarks, and the outstanding balance left after this payment.
class SavedPayment {
  final String receiptNumber;
  final DateTime date;
  final String customerName;
  final String customerId;
  final String billNumber;
  final double amount;
  final PaymentMethod method;
  final String transactionId;
  final String remarks;
  final double outstandingBalanceAfter;

  SavedPayment({
    required this.receiptNumber,
    required this.date,
    required this.customerName,
    this.customerId = '',
    required this.billNumber,
    required this.amount,
    required this.method,
    this.transactionId = '',
    this.remarks = '',
    required this.outstandingBalanceAfter,
  });

  Map<String, dynamic> toJson() => {
        'receiptNumber': receiptNumber,
        'date': date.toIso8601String(),
        'customerName': customerName,
        'customerId': customerId,
        'billNumber': billNumber,
        'amount': amount,
        'method': method.label,
        'transactionId': transactionId,
        'remarks': remarks,
        'outstandingBalanceAfter': outstandingBalanceAfter,
      };

  factory SavedPayment.fromJson(Map<String, dynamic> j) => SavedPayment(
        receiptNumber: j['receiptNumber'] ?? '',
        date: DateTime.tryParse(j['date'] ?? '') ?? DateTime.now(),
        customerName: j['customerName'] ?? '',
        customerId: j['customerId'] ?? '',
        billNumber: j['billNumber'] ?? '',
        amount: (j['amount'] ?? 0).toDouble(),
        method: PaymentMethodLabel.fromLabel(j['method'] ?? 'UPI'),
        transactionId: j['transactionId'] ?? '',
        remarks: j['remarks'] ?? '',
        outstandingBalanceAfter: (j['outstandingBalanceAfter'] ?? 0).toDouble(),
      );

  /// Builds a SavedPayment from a Supabase PostgreSQL payment record
  factory SavedPayment.fromSupabase(Map<String, dynamic> j) {
    String custName = 'Customer';
    String custId = '';
    if (j['customer'] is Map) {
      custName = j['customer']['name']?.toString() ?? 'Customer';
      custId = j['customer']['id']?.toString() ?? '';
    } else if (j['customer_id'] != null) {
      custId = j['customer_id'].toString();
    }
    if (j['customerName'] != null && j['customerName'].toString().isNotEmpty) {
      custName = j['customerName'].toString();
    }

    String invoiceNum = '';
    if (j['sale'] is Map) {
      invoiceNum = j['sale']['invoice_number']?.toString() ?? '';
    } else if (j['billNumber'] != null) {
      invoiceNum = j['billNumber'].toString();
    }

    final id = j['id']?.toString() ?? '';
    final rcptNum = j['receiptNumber'] ?? (id.isNotEmpty ? 'RCPT-$id' : '');

    return SavedPayment(
      receiptNumber: rcptNum,
      date: DateTime.tryParse(j['payment_date']?.toString() ?? j['date']?.toString() ?? j['created_at']?.toString() ?? '') ?? DateTime.now(),
      customerName: custName,
      customerId: custId,
      billNumber: invoiceNum,
      amount: double.tryParse(j['amount']?.toString() ?? '0') ?? 0.0,
      method: PaymentMethodLabel.fromLabel(j['method']?.toString() ?? 'UPI'),
      transactionId: j['transaction_id']?.toString() ?? j['transactionId']?.toString() ?? '',
      remarks: j['notes']?.toString() ?? j['remarks']?.toString() ?? '',
      outstandingBalanceAfter: double.tryParse(j['outstanding_balance_after']?.toString() ?? j['outstandingBalanceAfter']?.toString() ?? '0') ?? 0.0,
    );
  }
}
