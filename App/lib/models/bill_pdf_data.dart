/// Plain data the invoice builder needs. Both the live "current bill"
/// (CatalogProvider) and a saved history record (SavedBill) convert
/// themselves into this so [BillPdfService] only has to know one shape.
class BillPdfLineData {
  final String desc;
  final int qty;
  final double price;

  BillPdfLineData({required this.desc, required this.qty, required this.price});

  double get amount => price * qty;
}

class BillPdfData {
  final String billNumber;
  final DateTime date;
  final String customerName;
  final String customerPhone;
  final List<BillPdfLineData> items;
  final double discount;
  final double tax;
  final double previousOutstanding;
  final double paidAmount;

  BillPdfData({
    required this.billNumber,
    required this.date,
    required this.customerName,
    this.customerPhone = '',
    required this.items,
    this.discount = 0.0,
    this.tax = 0.0,
    this.previousOutstanding = 0.0,
    this.paidAmount = 0.0,
  });

  double get subtotal => items.fold(0, (s, i) => s + i.amount);
  double get finalBillTotal => (subtotal - discount + tax) < 0 ? 0 : (subtotal - discount + tax);
  double get total => finalBillTotal;
  double get totalAmountPayable => previousOutstanding + finalBillTotal;
  double get remainingOutstanding => (totalAmountPayable - paidAmount) < 0 ? 0 : (totalAmountPayable - paidAmount);
}
