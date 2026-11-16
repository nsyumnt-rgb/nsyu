import 'bill_pdf_data.dart';

enum OrderStatus { pending, confirmed, delivered, cancelled, convertedToBill }

extension OrderStatusLabel on OrderStatus {
  String get label {
    switch (this) {
      case OrderStatus.pending:
        return 'Pending';
      case OrderStatus.confirmed:
        return 'Confirmed';
      case OrderStatus.delivered:
        return 'Delivered';
      case OrderStatus.cancelled:
        return 'Cancelled';
      case OrderStatus.convertedToBill:
        return 'Billed';
    }
  }

  // Alias for backward compatibility
  static OrderStatus get ordered => OrderStatus.pending;

  static OrderStatus fromLabel(String s) {
    switch (s.toLowerCase().trim()) {
      case 'confirmed':
        return OrderStatus.confirmed;
      case 'delivered':
        return OrderStatus.delivered;
      case 'cancelled':
        return OrderStatus.cancelled;
      case 'billed':
      case 'converted_to_bill':
      case 'converted to bill':
        return OrderStatus.convertedToBill;
      case 'pending':
      case 'order':
      case 'ordered':
      default:
        return OrderStatus.pending;
    }
  }
}

double _toDouble(dynamic val) {
  if (val == null) return 0.0;
  if (val is num) return val.toDouble();
  if (val is String) return double.tryParse(val) ?? 0.0;
  return 0.0;
}

int _toInt(dynamic val, {int defaultValue = 0}) {
  if (val == null) return defaultValue;
  if (val is int) return val;
  if (val is num) return val.toInt();
  if (val is String) return int.tryParse(val) ?? defaultValue;
  return defaultValue;
}

class SavedOrderItem {
  final int? productId;
  final String desc;
  final String sku;
  final int availableStock;
  final int qty;
  final double price;
  final double discountPercent;
  final double amount;

  SavedOrderItem({
    this.productId,
    required this.desc,
    this.sku = '',
    this.availableStock = 0,
    required this.qty,
    required this.price,
    this.discountPercent = 0.0,
    double? amount,
  }) : amount = amount ?? (price * qty * (1 - (discountPercent / 100)));

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'product_id': productId,
        'desc': desc,
        'sku': sku,
        'availableStock': availableStock,
        'qty': qty,
        'price': price,
        'discountPercent': discountPercent,
        'amount': amount,
      };

  factory SavedOrderItem.fromJson(Map<String, dynamic> j) => SavedOrderItem(
        productId: _toInt(j['productId'] ?? j['product_id']),
        desc: j['desc'] ?? j['product_name'] ?? '',
        sku: j['sku'] ?? j['code'] ?? '',
        availableStock: _toInt(j['availableStock'] ?? j['available_stock']),
        qty: _toInt(j['qty'] ?? j['quantity'], defaultValue: 1),
        price: _toDouble(j['price'] ?? j['rate']),
        discountPercent: _toDouble(j['discountPercent'] ?? j['discount_percent']),
        amount: j['amount'] != null ? _toDouble(j['amount']) : null,
      );
}

/// One customer order — built from the Catalog / Create Order screen,
/// tracked from Pending -> Confirmed -> Delivered, or Converted to Bill.
class SavedOrder {
  final int? id;
  final String orderNumber;
  final DateTime date;
  final DateTime? expectedDeliveryDate;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String customerAddress;
  final List<SavedOrderItem> items;
  final double subtotal;
  final double discountAmount;
  final double taxAmount;
  final double totalAmount;
  final String remarks;
  final int? convertedSaleId;
  final int? billedBillId;
  final DateTime? billedAt;
  OrderStatus status;

  bool get isBilled =>
      status == OrderStatus.convertedToBill ||
      convertedSaleId != null ||
      billedBillId != null;

  SavedOrder({
    this.id,
    required this.orderNumber,
    required this.date,
    this.expectedDeliveryDate,
    this.customerId = '',
    required this.customerName,
    this.customerPhone = '',
    this.customerAddress = '',
    required this.items,
    double? subtotal,
    this.discountAmount = 0.0,
    this.taxAmount = 0.0,
    double? totalAmount,
    this.remarks = '',
    this.convertedSaleId,
    this.billedBillId,
    this.billedAt,
    this.status = OrderStatus.pending,
  })  : subtotal = subtotal ?? items.fold(0.0, (s, i) => s + (i.price * i.qty)),
        totalAmount = totalAmount ??
            items.fold(0.0, (s, i) => s + i.amount) -
                discountAmount +
                taxAmount;

  double get total => totalAmount;

  BillPdfData toPdfData() => BillPdfData(
        billNumber: orderNumber,
        date: date,
        customerName: customerName,
        customerPhone: customerPhone,
        items: items
            .map((i) => BillPdfLineData(desc: i.desc, qty: i.qty, price: i.price))
            .toList(),
        discount: discountAmount,
        tax: taxAmount,
        previousOutstanding: 0.0,
        paidAmount: 0.0,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'orderNumber': orderNumber,
        'date': date.toIso8601String(),
        'expectedDeliveryDate': expectedDeliveryDate?.toIso8601String(),
        'customerId': customerId,
        'customerName': customerName,
        'customerPhone': customerPhone,
        'customerAddress': customerAddress,
        'items': items.map((i) => i.toJson()).toList(),
        'subtotal': subtotal,
        'discountAmount': discountAmount,
        'taxAmount': taxAmount,
        'totalAmount': totalAmount,
        'remarks': remarks,
        'convertedSaleId': convertedSaleId,
        'billedBillId': billedBillId,
        'billedAt': billedAt?.toIso8601String(),
        'status': status.label,
      };

  factory SavedOrder.fromJson(Map<String, dynamic> j) => SavedOrder(
        id: j['id'] is int ? j['id'] as int : int.tryParse(j['id']?.toString() ?? ''),
        orderNumber: j['orderNumber'] ?? j['order_number'] ?? '',
        date: DateTime.tryParse(j['date'] ?? j['order_date'] ?? '') ?? DateTime.now(),
        expectedDeliveryDate: DateTime.tryParse(j['expectedDeliveryDate'] ?? j['expected_delivery_date'] ?? ''),
        customerId: j['customerId']?.toString() ?? j['customer_id']?.toString() ?? '',
        customerName: (j['customer'] is Map ? j['customer']['name']?.toString() : null) ?? j['customerName'] ?? '',
        customerPhone: (j['customer'] is Map ? j['customer']['phone']?.toString() : null) ?? j['customerPhone'] ?? '',
        customerAddress: (j['customer'] is Map ? j['customer']['address']?.toString() : null) ?? j['customerAddress'] ?? '',
        items: ((j['items'] ?? []) as List)
            .map((e) => SavedOrderItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        subtotal: j['subtotal'] != null ? _toDouble(j['subtotal']) : null,
        discountAmount: _toDouble(j['discountAmount'] ?? j['discount_amount']),
        taxAmount: _toDouble(j['taxAmount'] ?? j['tax_amount']),
        totalAmount: _toDouble(j['totalAmount'] ?? j['total_amount']),
        remarks: j['remarks'] ?? '',
        convertedSaleId: int.tryParse((j['convertedSaleId'] ?? j['converted_sale_id'])?.toString() ?? ''),
        billedBillId: int.tryParse((j['billedBillId'] ?? j['billed_bill_id'])?.toString() ?? ''),
        billedAt: DateTime.tryParse((j['billedAt'] ?? j['billed_at'])?.toString() ?? ''),
        status: OrderStatusLabel.fromLabel(j['status'] ?? 'pending'),
      );
}
