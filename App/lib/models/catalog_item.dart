/// Product model used for Card Catalog, Inventory and Product Editing
class CatalogItem {
  final int sNo;
  String code;
  String name;
  String specs;
  int stdPkg;
  int qty;
  double price;
  String margin;
  double slPrice;
  String category;
  String brand;
  String unit;
  String hsnSac;
  String description;
  String imageUrl;
  bool isActive;

  CatalogItem({
    required this.sNo,
    required this.code,
    required this.name,
    required this.specs,
    required this.stdPkg,
    required this.qty,
    required this.price,
    required this.margin,
    required this.slPrice,
    required this.category,
    required this.brand,
    required this.unit,
    required this.hsnSac,
    required this.description,
    this.imageUrl = 'https://example.com/images/tc001.jpg',
    this.isActive = true,
  });

  CatalogItem copyWith({
    int? sNo,
    String? code,
    String? name,
    String? specs,
    int? stdPkg,
    int? qty,
    double? price,
    String? margin,
    double? slPrice,
    String? category,
    String? brand,
    String? unit,
    String? hsnSac,
    String? description,
    String? imageUrl,
    bool? isActive,
  }) {
    return CatalogItem(
      sNo: sNo ?? this.sNo,
      code: code ?? this.code,
      name: name ?? this.name,
      specs: specs ?? this.specs,
      stdPkg: stdPkg ?? this.stdPkg,
      qty: qty ?? this.qty,
      price: price ?? this.price,
      margin: margin ?? this.margin,
      slPrice: slPrice ?? this.slPrice,
      category: category ?? this.category,
      brand: brand ?? this.brand,
      unit: unit ?? this.unit,
      hsnSac: hsnSac ?? this.hsnSac,
      description: description ?? this.description,
      imageUrl: imageUrl ?? this.imageUrl,
      isActive: isActive ?? this.isActive,
    );
  }
}

