class Product {
  final int sno;
  final String code;
  final String? referenceCode;
  final String desc;
  final String spec;
  final int pkg;
  final String category;
  final String? brand;
  final String? barcode;
  final double purchase;
  final double marginPrice;
  final double sellingPrice;
  final int stock;

  Product({
    required this.sno,
    required this.code,
    this.referenceCode,
    required this.desc,
    required this.spec,
    required this.pkg,
    required this.category,
    this.brand,
    this.barcode,
    required this.purchase,
    required this.marginPrice,
    required this.sellingPrice,
    required this.stock,
  });

  /// Kept for backward compatibility with code that expects "the price to
  /// sell at" — this is the Selling Price column
  /// (Purchase Price + Margin Price).
  double get slPrice => sellingPrice;

  /// Margin amount in ₹ (Selling Price - Purchase Price)
  double get marginAmount =>
      marginPrice > 0 ? marginPrice : (sellingPrice - purchase);

  /// Margin percentage relative to selling price:
  /// ((Selling Price - Purchase Price) / Selling Price) * 100.
  /// Returns 0.0 safely when sellingPrice <= 0.
  double get marginPercent {
    if (sellingPrice <= 0) return 0.0;
    final m = marginAmount;
    return (m / sellingPrice) * 100.0;
  }

  /// Reads a cell from [row] given a header->index map [col], trying each
  /// name in [names] in order (case-insensitive, whitespace-normalized).
  static String readCell(
      List<dynamic> row, Map<String, int> col, List<String> names) {
    for (final n in names) {
      final idx = col[n];
      if (idx != null && idx < row.length && row[idx] != null) {
        final v = row[idx].toString().trim();
        if (v.isNotEmpty) return v;
      }
    }
    return '';
  }

  /// Builds a Product from a raw CSV row, given a header->index map.
  /// Matches the Product.xlsx columns:
  /// S.No. | Code | Description | Category | Voltage/Amp/Type | Std.Pkg. |
  /// Purchase Price | Margin Price | Selling Price | Stock
  factory Product.fromRow(
    List<dynamic> row,
    Map<String, int> col, {
    String? fallbackCategory,
  }) {
    final snoStr = readCell(row, col, ['sno', 's.no.', 's.no', 'sr no', 'sr.no', '#']);
    final pkgStr = readCell(row, col, [
      'pkg',
      'std.pkg.',
      'std.pkg',
      'std pkg',
      'package',
      'pack',
      'moq',
    ]);
    final categoryFromSheet = readCell(row, col, ['category', 'cat', 'group']);
    final purchaseStr = readCell(row, col, [
      'purchase',
      'purchase price',
      'cost',
      'cost price',
      'price',
      'price (incl. gst)',
      'mrp',
      'rate',
    ]);
    final marginStr = readCell(row, col, [
      'margin price',
      'margin (₹)',
      'margin(rs)',
      'margin rs',
      'margin',
    ]);
    final sellingStr = readCell(row, col, [
      'selling price',
      'selling',
      'sale price',
      'sl-price',
      'sl price',
      'slprice',
    ]);
    final stockStr = readCell(row, col, ['stock', 'qty', 'quantity', 'in stock']);

    final purchase = double.tryParse(purchaseStr.replaceAll(',', '')) ?? 0;
    final margin = double.tryParse(marginStr.replaceAll(',', '')) ?? 0;
    final sellingFromSheet = double.tryParse(sellingStr.replaceAll(',', ''));
    final selling = sellingFromSheet ?? (purchase + margin);

    return Product(
      sno: int.tryParse(snoStr) ?? 0,
      code: readCell(row, col, [
        'code',
        'code no.',
        'code no',
        'item code',
        'product code',
        'sku',
      ]),
      desc: readCell(row, col, [
        'description',
        'product description',
        'product',
        'product name',
        'item',
        'desc',
      ]),
      spec: readCell(row, col, [
        'voltage/amp/type',
        'spec',
        'specification',
        'specifications',
      ]),
      pkg: int.tryParse(pkgStr) ?? 0,
      category: categoryFromSheet.isNotEmpty
          ? categoryFromSheet
          : (fallbackCategory ?? 'Other'),
      purchase: purchase,
      marginPrice: margin,
      sellingPrice: selling,
      stock: int.tryParse(stockStr) ?? 0,
    );
  }

  /// Builds a Product from Supabase PostgreSQL record
  factory Product.fromSupabase(Map<String, dynamic> json, {int? index}) {
    final purchase = (json['purchase_price'] != null)
        ? (double.tryParse(json['purchase_price'].toString()) ?? 0.0)
        : 0.0;
    final selling = (json['selling_price'] != null)
        ? (double.tryParse(json['selling_price'].toString()) ?? 0.0)
        : 0.0;
    final margin = (selling - purchase) > 0 ? (selling - purchase) : 0.0;

    int currentStock = 0;
    if (json['stocks'] is List && (json['stocks'] as List).isNotEmpty) {
      final firstStock = (json['stocks'] as List).first;
      if (firstStock is Map) {
        currentStock = int.tryParse(firstStock['current_stock']?.toString() ?? '0') ?? 0;
      }
    } else if (json['stock'] != null) {
      currentStock = int.tryParse(json['stock'].toString()) ?? 0;
    } else if (json['current_stock'] != null) {
      currentStock = int.tryParse(json['current_stock'].toString()) ?? 0;
    }

    String categoryName = 'Other';
    if (json['category'] is Map) {
      categoryName = json['category']['name']?.toString() ?? 'Other';
    } else if (json['category'] != null && json['category'].toString().isNotEmpty) {
      categoryName = json['category'].toString();
    } else if (json['brand'] != null && json['brand'].toString().isNotEmpty) {
      categoryName = json['brand'].toString();
    }

    final idVal = json['id'];
    final snoVal = index ?? (idVal is int ? idVal : int.tryParse(idVal?.toString() ?? '')) ?? 1;
    final refCode = json['reference_code']?.toString() ?? json['referenceCode']?.toString();
    final barcodeVal = json['barcode']?.toString();
    final brandVal = json['brand']?.toString();

    return Product(
      sno: snoVal,
      code: json['sku']?.toString() ?? json['code']?.toString() ?? '',
      referenceCode: refCode,
      desc: json['name']?.toString() ?? json['desc']?.toString() ?? '',
      spec: json['description']?.toString() ?? json['spec']?.toString() ?? '',
      pkg: int.tryParse(json['min_stock']?.toString() ?? json['pkg']?.toString() ?? '1') ?? 1,
      category: categoryName,
      brand: brandVal,
      barcode: barcodeVal,
      purchase: purchase,
      marginPrice: margin,
      sellingPrice: selling,
      stock: currentStock,
    );
  }

  Product copyWith({
    double? marginPrice,
    double? sellingPrice,
    int? stock,
    String? referenceCode,
  }) => Product(
        sno: sno,
        code: code,
        referenceCode: referenceCode ?? this.referenceCode,
        desc: desc,
        spec: spec,
        pkg: pkg,
        category: category,
        brand: brand,
        barcode: barcode,
        purchase: purchase,
        marginPrice: marginPrice ?? this.marginPrice,
        sellingPrice: sellingPrice ?? this.sellingPrice,
        stock: stock ?? this.stock,
      );

  bool matchesQuery(String q) {
    if (q.isEmpty) return true;
    final needle = q.toLowerCase();
    return code.toLowerCase().contains(needle) ||
        (referenceCode?.toLowerCase().contains(needle) ?? false) ||
        desc.toLowerCase().contains(needle) ||
        spec.toLowerCase().contains(needle) ||
        (brand?.toLowerCase().contains(needle) ?? false) ||
        (barcode?.toLowerCase().contains(needle) ?? false);
  }
}
