import 'bill_pdf_data.dart';

enum BillStatus { paid, unpaid, cancelled }

extension BillStatusLabel on BillStatus {
  String get label {
    switch (this) {
      case BillStatus.paid:
        return 'Paid';
      case BillStatus.unpaid:
        return 'Unpaid';
      case BillStatus.cancelled:
        return 'Cancelled';
    }
  }

  static BillStatus fromLabel(String s) {
    switch (s.toLowerCase()) {
      case 'paid':
        return BillStatus.paid;
      case 'cancelled':
        return BillStatus.cancelled;
      default:
        return BillStatus.unpaid;
    }
  }
}

class SavedBillItem {
  final int? productId;
  final String? sku;
  final String desc;
  final int qty;
  final double price;

  SavedBillItem({
    this.productId,
    this.sku,
    required this.desc,
    required this.qty,
    required this.price,
  });

  double get amount => price * qty;

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'sku': sku,
        'desc': desc,
        'qty': qty,
        'price': price,
      };

  factory SavedBillItem.fromJson(Map<String, dynamic> j) => SavedBillItem(
        productId: j['productId'] is int ? j['productId'] : int.tryParse(j['productId']?.toString() ?? ''),
        sku: j['sku']?.toString(),
        desc: j['desc'] ?? '',
        qty: (j['qty'] ?? 0) as int,
        price: (j['price'] ?? 0).toDouble(),
      );
}

/// One generated bill/invoice, kept locally so it can show up on the Home
/// dashboard, the Bills list, and the customer Ledger.
class SavedBill {
  final int? id;
  final String billNumber;
  final DateTime date;
  final String customerName;
  final String customerPhone;
  final List<SavedBillItem> items;
  BillStatus status;

  /// Running total of everything collected against this bill so far
  /// (across one or more partial payments). A bill only flips to
  /// [BillStatus.paid] once this reaches [totalAmountPayable].
  double paidAmount;

  /// Line or flat bill discount
  double discount;

  /// Taxes applied to the bill
  double tax;

  /// Previous customer outstanding balance carried forward
  double previousOutstanding;

  /// Where this bill's generated PDF and rendered image were saved on
  /// device, inside the `nsyu_Bill_Photo_Image_pdf` folder.
  String? pdfPath;
  String? imagePath;

  SavedBill({
    this.id,
    required this.billNumber,
    required this.date,
    required this.customerName,
    this.customerPhone = '',
    required this.items,
    this.status = BillStatus.unpaid,
    this.paidAmount = 0,
    this.discount = 0.0,
    this.tax = 0.0,
    this.previousOutstanding = 0.0,
    this.pdfPath,
    this.imagePath,
  });

  /// Subtotal before discount and taxes
  double get subtotal => items.fold(0, (s, i) => s + i.amount);

  /// Final Bill Total = Subtotal - Discount + Taxes
  double get finalBillTotal => (subtotal - discount + tax) < 0 ? 0 : (subtotal - discount + tax);

  /// Current bill total
  double get total => finalBillTotal;

  /// Whether this bill has been completely paid
  bool get isPaid => status == BillStatus.paid;

  /// Due amount remaining
  double get dueAmount => due;

  /// Total Amount Payable = Previous Outstanding + Final Bill Total
  double get totalAmountPayable => previousOutstanding + finalBillTotal;

  /// What's still owed after payment received
  /// Remaining Outstanding = Total Amount Payable - Payment Received
  double get due => (totalAmountPayable - paidAmount) < 0 ? 0 : (totalAmountPayable - paidAmount);


  /// Helper to sanitize a customer name into an underscore-separated identifier
  /// replacing spaces and unsupported characters with underscores.
  static String sanitizeCustomerName(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return 'Walk_in_Customer';
    }
    // Replace spaces and unsupported characters with underscores
    String sanitized = raw.trim().replaceAll(RegExp(r'[^a-zA-Z0-9]+'), '_');
    // Collapse multiple consecutive underscores
    sanitized = sanitized.replaceAll(RegExp(r'_+'), '_');
    // Strip leading and trailing underscores
    sanitized = sanitized.replaceAll(RegExp(r'^_+|_+$'), '');
    if (sanitized.isEmpty) {
      return 'Customer';
    }
    return sanitized;
  }

  /// Generates the dynamic customer-based bill label in exact format:
  /// `<Sanitized_Customer_Name>_<yyyy>_<MM>_<dd>_<HHmm>`
  /// e.g. `Mohd_Nazim_2026_10_28_0001`
  ///
  /// Strictly uses the persisted bill timestamp converted to local business timezone.
  String get customerBillLabel {
    final cleanName = sanitizeCustomerName(customerName);

    // Convert UTC persisted timestamp to local business timezone (+05:30)
    final localTime = date.isUtc ? date.toLocal() : date;
    final yyyy = localTime.year.toString().padLeft(4, '0');
    final mm = localTime.month.toString().padLeft(2, '0');
    final dd = localTime.day.toString().padLeft(2, '0');
    final hh = localTime.hour.toString().padLeft(2, '0');
    final min = localTime.minute.toString().padLeft(2, '0');

    return '${cleanName}_${yyyy}_${mm}_${dd}_$hh$min';
  }

  BillPdfData toPdfData() => BillPdfData(
        billNumber: billNumber,
        date: date,
        customerName: customerName,
        customerPhone: customerPhone,
        items: items
            .map((i) => BillPdfLineData(desc: i.desc, qty: i.qty, price: i.price))
            .toList(),
        discount: discount,
        tax: tax,
        previousOutstanding: previousOutstanding,
        paidAmount: paidAmount,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'billNumber': billNumber,
        'date': date.toIso8601String(),
        'customerName': customerName,
        'customerPhone': customerPhone,
        'items': items.map((i) => i.toJson()).toList(),
        'status': status.label,
        'paidAmount': paidAmount,
        'discount': discount,
        'tax': tax,
        'previousOutstanding': previousOutstanding,
        'pdfPath': pdfPath,
        'imagePath': imagePath,
      };

  factory SavedBill.fromJson(Map<String, dynamic> j) {
    final dateRaw = j['date']?.toString();
    final parsed = dateRaw != null && dateRaw.isNotEmpty
        ? DateTime.tryParse(dateRaw)
        : null;
    final safeDate = parsed ?? DateTime(2026, 1, 1, 0, 0);
    final localDate = safeDate.isUtc ? safeDate.toLocal() : safeDate;

    return SavedBill(
      id: j['id'] is int ? j['id'] : int.tryParse(j['id']?.toString() ?? ''),
      billNumber: j['billNumber'] ?? '',
      date: localDate,
      customerName: j['customerName'] ?? '',
      customerPhone: j['customerPhone']?.toString() ?? '',
      items: ((j['items'] ?? []) as List)
          .map((e) => SavedBillItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      status: BillStatusLabel.fromLabel(j['status'] ?? 'Unpaid'),
      paidAmount: (j['paidAmount'] ?? 0).toDouble(),
      discount: double.tryParse(j['discount']?.toString() ?? '0') ?? 0.0,
      tax: double.tryParse(j['tax']?.toString() ?? '0') ?? 0.0,
      previousOutstanding: double.tryParse(j['previousOutstanding']?.toString() ?? '0') ?? 0.0,
      pdfPath: j['pdfPath'],
      imagePath: j['imagePath'],
    );
  }

  /// Builds a SavedBill from a Supabase PostgreSQL sales record
  factory SavedBill.fromSupabase(Map<String, dynamic> j) {
    String custName = 'Walk-in Customer';
    String custPhone = '';
    if (j['customer'] is Map) {
      final name = j['customer']['name']?.toString().trim();
      if (name != null && name.isNotEmpty) {
        custName = name;
      }
      custPhone = j['customer']['phone']?.toString().trim() ?? '';
    } else if (j['customer_name'] != null && j['customer_name'].toString().trim().isNotEmpty) {
      custName = j['customer_name'].toString().trim();
    } else if (j['customerName'] != null && j['customerName'].toString().trim().isNotEmpty) {
      custName = j['customerName'].toString().trim();
    }

    final rawItems = j['items'] ?? j['sale_items'] ?? [];
    final itemsList = <SavedBillItem>[];
    if (rawItems is List) {
      for (final item in rawItems) {
        if (item is Map<String, dynamic>) {
          final desc = item['product_name'] ??
              item['desc'] ??
              (item['product'] is Map ? item['product']['name'] : null) ??
              'Item';
          final qty = int.tryParse(item['quantity']?.toString() ?? item['qty']?.toString() ?? '1') ?? 1;
          final price = double.tryParse(item['unit_price']?.toString() ?? item['rate']?.toString() ?? item['price']?.toString() ?? '0') ?? 0.0;
          final pId = item['product_id'] is int
              ? item['product_id']
              : int.tryParse(item['product_id']?.toString() ?? item['productId']?.toString() ?? '');
          final pSku = item['sku']?.toString();
          itemsList.add(SavedBillItem(
            productId: pId,
            sku: pSku,
            desc: desc.toString(),
            qty: qty,
            price: price,
          ));
        }
      }
    }

    final statusStr = (j['status'] ?? 'unpaid').toString();
    BillStatus st;
    if (statusStr.toLowerCase() == 'paid') {
      st = BillStatus.paid;
    } else if (statusStr.toLowerCase() == 'cancelled') {
      st = BillStatus.cancelled;
    } else {
      st = BillStatus.unpaid;
    }

    final paid = double.tryParse(j['paid_amount']?.toString() ?? j['paidAmount']?.toString() ?? '0') ?? 0.0;
    final discount = double.tryParse(j['discount_amount']?.toString() ?? j['discountAmount']?.toString() ?? '0') ?? 0.0;
    final tax = double.tryParse(j['tax_amount']?.toString() ?? j['taxAmount']?.toString() ?? '0') ?? 0.0;

    // Persisted timestamp parsing with safe deterministic fallback (never DateTime.now)
    final dateRaw = j['invoice_date']?.toString() ??
        j['createdAt']?.toString() ??
        j['created_at']?.toString() ??
        j['date']?.toString();
    final parsed = dateRaw != null && dateRaw.isNotEmpty
        ? DateTime.tryParse(dateRaw)
        : null;
    final safeDate = parsed ?? DateTime(2026, 1, 1, 0, 0);
    final localDate = safeDate.isUtc ? safeDate.toLocal() : safeDate;

    return SavedBill(
      id: j['id'] is int ? j['id'] : int.tryParse(j['id']?.toString() ?? ''),
      billNumber: j['invoice_number']?.toString() ?? j['billNumber']?.toString() ?? '',
      date: localDate,
      customerName: custName,
      customerPhone: custPhone,
      items: itemsList,
      status: st,
      paidAmount: paid,
      discount: discount,
      tax: tax,
      pdfPath: j['pdf_url']?.toString() ?? j['pdfPath']?.toString(),
    );
  }
}

/// A party (customer) row for the Ledger tab, derived from saved bills.
class LedgerParty {
  final String name;
  final double totalDue;
  final int billCount;

  LedgerParty({required this.name, required this.totalDue, required this.billCount});
}
