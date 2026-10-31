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
        return 'Converted to Bill';
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

class SavedOrderItem {
  final String desc;
  final String sku;
  final int availableStock;
  final int qty;
  final double price;
  final double discountPercent;
  final double amount;

  SavedOrderItem({
    required this.desc,
    this.sku = '',
    this.availableStock = 0,
    required this.qty,
    required this.price,
    this.discountPercent = 0.0,
    double? amount,
  }) : amount = amount ?? (price * qty * (1 - (discountPercent / 100)));

  Map<String, dynamic> toJson() => {
        'desc': desc,
        'sku': sku,
        'availableStock': availableStock,
        'qty': qty,
        'price': price,
        'discountPercent': discountPercent,
        'amount': amount,
      };

  factory SavedOrderItem.fromJson(Map<String, dynamic> j) => SavedOrderItem(
        desc: j['desc'] ?? j['product_name'] ?? '',
        sku: j['sku'] ?? j['code'] ?? '',
        availableStock: (j['availableStock'] ?? j['available_stock'] ?? 0) as int,
        qty: ((j['qty'] ?? j['quantity']) ?? 1) as int,
        price: ((j['price'] ?? j['rate']) ?? 0.0).toDouble(),
        discountPercent: ((j['discountPercent'] ?? j['discount_percent']) ?? 0.0).toDouble(),
        amount: (j['amount'] != null) ? (j['amount'] as num).toDouble() : null,
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
  OrderStatus status;

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
        'status': status.label,
      };

  factory SavedOrder.fromJson(Map<String, dynamic> j) => SavedOrder(
        id: j['id'] is int ? j['id'] : int.tryParse(j['id']?.toString() ?? ''),
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
        subtotal: (j['subtotal'] != null) ? (j['subtotal'] as num).toDouble() : null,
        discountAmount: (j['discountAmount'] ?? j['discount_amount'] ?? 0.0).toDouble(),
        taxAmount: (j['taxAmount'] ?? j['tax_amount'] ?? 0.0).toDouble(),
        totalAmount: (j['totalAmount'] ?? j['total_amount'] ?? 0.0).toDouble(),
        remarks: j['remarks'] ?? '',
        convertedSaleId: j['convertedSaleId'] ?? j['converted_sale_id'],
        status: OrderStatusLabel.fromLabel(j['status'] ?? 'pending'),
      );
}
