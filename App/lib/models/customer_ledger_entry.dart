/// Represents a single chronological entry in the customer ledger
/// backed by the authoritative `customer_ledger` table in Supabase PostgreSQL.
class CustomerLedgerEntry {
  final int id;
  final int customerId;
  final int shopId;
  final String entryType; // 'debit' | 'credit'
  final double amount;
  final double runningBalance;
  final String referenceType; // 'Sale' | 'Payment' | 'EMIInstallment' | 'SaleReturn' | 'Opening' | 'Adjustment'
  final int? referenceId;
  final String description;
  final DateTime entryDate;
  final String status; // 'active' | 'reversed'
  final String? shopName;
  final String? shopCode;

  CustomerLedgerEntry({
    required this.id,
    required this.customerId,
    required this.shopId,
    required this.entryType,
    required this.amount,
    required this.runningBalance,
    required this.referenceType,
    this.referenceId,
    required this.description,
    required this.entryDate,
    this.status = 'active',
    this.shopName,
    this.shopCode,
  });

  bool get isDebit => entryType.toLowerCase() == 'debit';
  bool get isCredit => entryType.toLowerCase() == 'credit';

  double get debitAmount => isDebit ? amount : 0.0;
  double get creditAmount => isCredit ? amount : 0.0;

  String get typeDisplay {
    final ref = referenceType.toLowerCase();
    if (ref.contains('sale') || ref.contains('invoice') || ref.contains('bill')) {
      return 'Sale / Bill';
    } else if (ref.contains('payment')) {
      return 'Payment Received';
    } else if (ref.contains('emi')) {
      return 'EMI Installment';
    } else if (ref.contains('return')) {
      return 'Sales Return';
    } else if (ref.contains('opening')) {
      return 'Opening Balance';
    } else if (ref.contains('credit_note')) {
      return 'Credit Note';
    }
    return referenceType;
  }

  factory CustomerLedgerEntry.fromJson(Map<String, dynamic> json) {
    final dateRaw = json['entry_date']?.toString() ??
        json['entryDate']?.toString() ??
        json['created_at']?.toString() ??
        json['createdAt']?.toString();
    final parsed = dateRaw != null && dateRaw.isNotEmpty
        ? DateTime.tryParse(dateRaw)
        : null;
    final safeDate = parsed ?? DateTime(2026, 1, 1, 0, 0);
    final localDate = safeDate.isUtc ? safeDate.toLocal() : safeDate;

    String? sName;
    String? sCode;
    if (json['shop'] is Map) {
      sName = json['shop']['name']?.toString();
      sCode = json['shop']['code']?.toString();
    }

    return CustomerLedgerEntry(
      id: int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      customerId: int.tryParse(json['customer_id']?.toString() ?? json['customerId']?.toString() ?? '0') ?? 0,
      shopId: int.tryParse(json['shop_id']?.toString() ?? json['shopId']?.toString() ?? '0') ?? 0,
      entryType: json['entry_type']?.toString() ?? json['entryType']?.toString() ?? 'debit',
      amount: double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      runningBalance: double.tryParse(json['running_balance']?.toString() ?? json['runningBalance']?.toString() ?? '0') ?? 0.0,
      referenceType: json['reference_type']?.toString() ?? json['referenceType']?.toString() ?? 'Sale',
      referenceId: json['reference_id'] != null ? int.tryParse(json['reference_id'].toString()) : null,
      description: json['description']?.toString() ?? '',
      entryDate: localDate,
      status: json['status']?.toString() ?? 'active',
      shopName: sName,
      shopCode: sCode,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'customer_id': customerId,
        'shop_id': shopId,
        'entry_type': entryType,
        'amount': amount,
        'running_balance': runningBalance,
        'reference_type': referenceType,
        'reference_id': referenceId,
        'description': description,
        'entry_date': entryDate.toIso8601String(),
        'status': status,
      };
}
