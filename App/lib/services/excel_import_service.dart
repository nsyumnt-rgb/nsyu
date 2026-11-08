import 'dart:convert';
import 'dart:io';

import 'package:csv/csv.dart';
import 'package:excel/excel.dart' as xls;

import '../models/product.dart';
import 'supabase_service.dart';

/// One row parsed out of the supplier's Excel or CSV file.
class ImportedProductRow {
  final String category;
  final String code;
  final String desc;
  final String spec;
  final String pkg;
  final double purchase;
  final String? barcode;
  final String? brand;

  ImportedProductRow({
    required this.category,
    required this.code,
    required this.desc,
    required this.spec,
    required this.pkg,
    required this.purchase,
    this.barcode,
    this.brand,
  });
}

/// One planned change to the live Product catalog.
class ProductUpdate {
  final String code;
  final String desc;
  final int rowNumber; // 1-based index
  final double oldPurchase;
  final double newPurchase;
  final double oldMarginPrice;
  final double newSellingPrice;
  final bool descChanged;
  final String newDesc, newSpec, newPkg;

  ProductUpdate({
    required this.code,
    required this.desc,
    required this.rowNumber,
    required this.oldPurchase,
    required this.newPurchase,
    required this.oldMarginPrice,
    required this.newSellingPrice,
    required this.descChanged,
    required this.newDesc,
    required this.newSpec,
    required this.newPkg,
  });
}

class ProductAdd {
  final String category;
  final String code;
  final String desc;
  final String spec;
  final String pkg;
  final double purchase;
  final double marginPrice;
  final double sellingPrice;

  ProductAdd({
    required this.category,
    required this.code,
    required this.desc,
    required this.spec,
    required this.pkg,
    required this.purchase,
    required this.marginPrice,
    required this.sellingPrice,
  });
}

/// Full diff between an imported file and what's currently live in
/// the Supabase PostgreSQL database.
class ImportPlan {
  final List<ProductUpdate> priceChanges;
  final List<ProductAdd> newProducts;
  final int unchangedCount;

  ImportPlan({
    required this.priceChanges,
    required this.newProducts,
    required this.unchangedCount,
  });

  bool get isEmpty => priceChanges.isEmpty && newProducts.isEmpty;
}

class ExcelImportService {
  final SupabaseService _supabase;
  static const double _defaultMarginPrice = 0;

  ExcelImportService({SupabaseService? supabase})
      : _supabase = supabase ?? SupabaseService();

  static String _norm(dynamic v) => (v ?? '')
      .toString()
      .replaceAll('\n', ' ')
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), ' ');

  /// Pulls the raw value out of an excel cell.
  static dynamic _cellValue(xls.Data? cell) {
    final v = cell?.value;
    if (v == null) return null;
    if (v is xls.TextCellValue) return v.value.toString();
    if (v is xls.IntCellValue) return v.value;
    if (v is xls.DoubleCellValue) return v.value;
    if (v is xls.BoolCellValue) return v.value;
    return v.toString();
  }

  static double _asDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString().replaceAll(',', '').trim()) ?? 0;
  }

  static String _asString(dynamic v) => v == null ? '' : v.toString().trim();

  /// Reads a .csv, .xlsx, or .xls file at [path] and parses it into product rows.
  List<ImportedProductRow> parseFile(String path) {
    final bytes = File(path).readAsBytesSync();
    final lowerPath = path.toLowerCase();

    List<List<dynamic>> allRows = [];

    if (lowerPath.endsWith('.csv')) {
      final content = utf8.decode(bytes).replaceAll('\uFEFF', '');
      allRows = const CsvToListConverter().convert(content);
    } else {
      final book = xls.Excel.decodeBytes(bytes);
      if (book.tables.isEmpty) {
        throw const FormatException('The Excel file has no sheets.');
      }
      final sheet = book.tables.values.reduce((a, b) => a.rows.length >= b.rows.length ? a : b);
      allRows = sheet.rows.map((row) => row.map(_cellValue).toList()).toList();
    }

    if (allRows.isEmpty) {
      throw const FormatException('The file is empty.');
    }

    // Find the header row in first 15 rows
    var headerRowIndex = -1;
    var col = <String, int>{};
    for (var i = 0; i < allRows.length && i < 15; i++) {
      final cells = allRows[i].map(_norm).toList();
      final hasCode = cells.any((c) => c.contains('code') || c == 'sku');
      final hasDesc = cells.any((c) => c.contains('description') || c.contains('name') || c.contains('product'));
      if (hasCode || hasDesc) {
        headerRowIndex = i;
        for (var c = 0; c < cells.length; c++) {
          col[cells[c]] = c;
        }
        break;
      }
    }

    if (headerRowIndex == -1) {
      throw const FormatException('Could not find a header row with Code/SKU or Product Name in the file.');
    }

    int? findCol(List<String> names) {
      for (final n in names) {
        if (col.containsKey(n)) return col[n];
      }
      return null;
    }

    final codeCol = findCol(['sku', 'code no.', 'code no', 'code', 'item code', 'product code']);
    final descCol = findCol(['product name', 'name', 'product description', 'description', 'title', 'product']);
    final specCol = findCol(['voltage/amp/type', 'spec', 'specification', 'model']);
    final pkgCol = findCol(['std.pkg.', 'std pkg', 'pkg', 'current stock', 'stock', 'qty']);
    final priceCol = findCol(['purchase price', 'purchase', 'cost', 'price (incl. gst)', 'price \n(incl. gst)', 'price']);
    final brandCol = findCol(['brand', 'brand name', 'make']);
    final barcodeCol = findCol(['barcode', 'upc', 'ean']);
    final catCol = findCol(['category', 'category name', 'cat']);

    final rows = <ImportedProductRow>[];
    var currentCategory = 'General';

    for (var i = headerRowIndex + 1; i < allRows.length; i++) {
      final row = allRows[i];
      dynamic cellAt(int? idx) => (idx == null || idx >= row.length) ? null : row[idx];

      final code = _asString(cellAt(codeCol));
      final desc = _asString(cellAt(descCol));
      final cat = _asString(cellAt(catCol));

      // Category banner row (ERD sheet format): description present, code empty
      if (code.isEmpty && desc.isNotEmpty && cat.isEmpty && !desc.toLowerCase().contains('total')) {
        currentCategory = desc;
        continue;
      }
      if (code.isEmpty && desc.isEmpty) continue; // blank row

      rows.add(ImportedProductRow(
        category: cat.isNotEmpty ? cat : currentCategory,
        code: code.isNotEmpty ? code : desc,
        desc: desc.isNotEmpty ? desc : code,
        spec: _asString(cellAt(specCol)),
        pkg: _asString(cellAt(pkgCol)),
        purchase: _asDouble(cellAt(priceCol)),
        brand: _asString(cellAt(brandCol)),
        barcode: _asString(cellAt(barcodeCol)),
      ));
    }
    return rows;
  }

  /// Compares [imported] rows against live database records using 3-tier matching
  /// (Priority 1: SKU/Code -> Priority 2: Barcode -> Priority 3: Name+Brand)
  /// and detects duplicates within the imported file.
  Future<ImportPlan> buildPlan(List<ImportedProductRow> imported) async {
    final liveProducts = await _supabase.fetchProducts();

    final liveByCode = <String, Product>{};
    final liveByBarcode = <String, Product>{};
    final liveByNameBrand = <String, Product>{};

    for (final p in liveProducts) {
      if (p.code.isNotEmpty) {
        liveByCode[p.code.trim().toLowerCase()] = p;
      }
      if (p.barcode != null && p.barcode!.trim().isNotEmpty) {
        liveByBarcode[p.barcode!.trim().toLowerCase()] = p;
      }
      final nameKey = '${_norm(p.desc)}|${_norm(p.brand ?? '')}';
      liveByNameBrand[nameKey] = p;
    }

    final updates = <ProductUpdate>[];
    final adds = <ProductAdd>[];
    var unchanged = 0;

    // Detect duplicate rows within the uploaded file
    final seenSkus = <String>{};

    for (final r in imported) {
      final normCode = r.code.trim().toLowerCase();
      if (normCode.isNotEmpty && seenSkus.contains(normCode)) {
        continue; // skip in-file duplicate
      }
      if (normCode.isNotEmpty) seenSkus.add(normCode);

      // 3-Tier Matching Priority
      final normBarcode = (r.barcode ?? '').trim().toLowerCase();
      final normNameKey = '${_norm(r.desc)}|${_norm(r.brand ?? '')}';

      final live = liveByCode[normCode] ??
          (normBarcode.isNotEmpty ? liveByBarcode[normBarcode] : null) ??
          liveByNameBrand[normNameKey];

      if (live == null) {
        const marginPrice = _defaultMarginPrice;
        adds.add(ProductAdd(
          category: r.category,
          code: r.code,
          desc: r.desc,
          spec: r.spec,
          pkg: r.pkg,
          purchase: r.purchase,
          marginPrice: marginPrice,
          sellingPrice: r.purchase + marginPrice,
        ));
        continue;
      }

      final priceChanged = (r.purchase - live.purchase).abs() > 0.005;
      final descChanged = r.desc.isNotEmpty && r.desc.trim().toLowerCase() != live.desc.trim().toLowerCase();
      if (!priceChanged && !descChanged) {
        unchanged++;
        continue;
      }

      final marginPrice = live.marginPrice;
      final newSelling = priceChanged ? r.purchase + marginPrice : live.sellingPrice;

      updates.add(ProductUpdate(
        code: live.code,
        desc: r.desc.isEmpty ? live.desc : r.desc,
        rowNumber: live.sno,
        oldPurchase: live.purchase,
        newPurchase: r.purchase,
        oldMarginPrice: marginPrice,
        newSellingPrice: newSelling,
        descChanged: descChanged,
        newDesc: r.desc.isEmpty ? live.desc : r.desc,
        newSpec: r.spec.isEmpty ? live.spec : r.spec,
        newPkg: r.pkg.isEmpty ? live.pkg.toString() : r.pkg,
      ));
    }

    return ImportPlan(priceChanges: updates, newProducts: adds, unchangedCount: unchanged);
  }

  /// Applies [plan] directly to Supabase PostgreSQL database.
  Future<void> applyPlan(ImportPlan plan) async {
    for (final u in plan.priceChanges) {
      try {
        await _supabase.updateMarginPrice(
          productCode: u.code,
          purchase: u.newPurchase,
          newMarginPrice: u.oldMarginPrice,
        );
      } catch (e) {
        // Continue processing other products
      }
    }

    for (final p in plan.newProducts) {
      try {
        await _supabase.addProduct(
          code: p.code,
          desc: p.desc,
          spec: p.spec,
          category: p.category,
          pkg: int.tryParse(p.pkg) ?? 1,
          purchase: p.purchase,
          marginPrice: p.marginPrice,
          sellingPrice: p.sellingPrice,
        );
      } catch (e) {
        // Continue processing other products
      }
    }
  }
}
