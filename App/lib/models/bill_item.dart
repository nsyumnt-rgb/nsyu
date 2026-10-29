import 'product.dart';

class BillItem {
  final int? productId;
  final String code;
  final String desc;
  final String spec;
  double price; // SL price at time of adding (editable)
  int qty;
  int availableStock;

  BillItem({
    this.productId,
    required this.code,
    required this.desc,
    required this.spec,
    required this.price,
    this.qty = 1,
    this.availableStock = 0,
  });

  factory BillItem.fromProduct(Product p) => BillItem(
        productId: p.sno,
        code: p.code,
        desc: p.desc,
        spec: p.spec,
        price: p.slPrice,
        availableStock: p.stock,
      );

  double get amount => price * qty;
}
