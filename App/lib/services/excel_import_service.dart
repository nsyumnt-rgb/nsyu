import 'dart:io';

import 'package:excel/excel.dart' as xls;

import '../models/product.dart';
import 'supabase_service.dart';

/// One row parsed out of the supplier's Excel file.
class ImportedProductRow {
  final String category;
  final String code;
  final String desc;
  final String spec;
  final String pkg;
  final double purchase;

  ImportedProductRow({
    required this.category,
    required this.code,
    required this.desc,
    required this.spec,
    required this.pkg,
    required this.purchase,
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

/// Full diff between an imported Excel file and what's currently live in
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

  static String _norm(dynamic v) => v
      .toString()
      .replaceAll('\n', ' ')
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), ' ');

  /// Pulls the raw value out of a cell regardless of which typed
  /// CellValue subclass the `excel` package wrapped it in.
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

  /// Reads the .xlsx at [path] and parses it into flat product rows,
  /// carrying along whichever category banner row it fell under.
  List<ImportedProductRow> parseFile(String path) {
    final bytes = File(path).readAsBytesSync();
    final book = xls.Excel.decodeBytes(bytes);
    if (book.tables.isEmpty) {
      throw const FormatException('The Excel file has no sheets.');
    }
    // Use whichever sheet has the most rows (the real data), rather than
    // assuming a specific sheet name.
    final sheet = book.tables.values.reduce((a, b) => a.rows.length >= b.rows.length ? a : b);

    // Find the header row: scan the first ~6 rows for one containing both
    // a "code"-like and a "description"-like column.
    var headerRowIndex = -1;
    var col = <String, int>{};
    for (var i = 0; i < sheet.rows.length && i < 6; i++) {
      final cells = sheet.rows[i].map(_cellValue).map(_norm).toList();
      final hasCode = cells.any((c) => c.contains('code'));
      final hasDesc = cells.any((c) => c.contains('description') || c.contains('product'));
      if (hasCode && hasDesc) {
        headerRowIndex = i;
        for (var c = 0; c < cells.length; c++) {
          col[cells[c]] = c;
        }
        break;
      }
    }
    if (headerRowIndex == -1) {
      throw const FormatException(
          'Could not find a header row with "Code" and "Description" columns.');
    }

    int? findCol(List<String> names) {
      for (final n in names) {
        if (col.containsKey(n)) return col[n];
      }
      return null;
    }

    final codeCol = findCol(['code no.', 'code no', 'code', 'item code', 'product code']);
    final descCol = findCol(['product description', 'description']);
    final specCol = findCol(['voltage/amp/type', 'spec', 'specification']);
    final pkgCol = findCol(['std.pkg.', 'std pkg', 'pkg']);
    final priceCol = findCol(['price \n(incl. gst)', 'price (incl. gst)', 'price', 'purchase', 'purchase price']);

    if (codeCol == null || descCol == null) {
      throw const FormatException('Could not find Code / Description columns in the file.');
    }

    final rows = <ImportedProductRow>[];
    var currentCategory = 'Imported';

    for (var i = headerRowIndex + 1; i < sheet.rows.length; i++) {
      final row = sheet.rows[i];
      dynamic cellAt(int? idx) => (idx == null || idx >= row.length) ? null : _cellValue(row[idx]);

      final code = _asString(cellAt(codeCol));
      final desc = _asString(cellAt(descCol));

      // A category banner row: description present, but no code
      if (code.isEmpty && desc.isNotEmpty) {
        currentCategory = desc;
        continue;
      }
      if (code.isEmpty) continue; // blank separator row

      rows.add(ImportedProductRow(
        category: currentCategory,
        code: code,
        desc: desc,
        spec: _asString(cellAt(specCol)),
        pkg: _asString(cellAt(pkgCol)),
        purchase: _asDouble(cellAt(priceCol)),
      ));
    }
    return rows;
  }

  /// Compares [imported] rows against what's currently live in the Supabase
  /// PostgreSQL database and builds a plan of changes.
  Future<ImportPlan> buildPlan(List<ImportedProductRow> imported) async {
    final liveProducts = await _supabase.fetchProducts();

    final liveByCode = <String, Product>{};
    for (final p in liveProducts) {
      if (p.code.isNotEmpty) {
        liveByCode[p.code.trim().toLowerCase()] = p;
      }
    }

    final updates = <ProductUpdate>[];
    final adds = <ProductAdd>[];
    var unchanged = 0;

    for (final r in imported) {
      final live = liveByCode[r.code.trim().toLowerCase()];
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
        code: r.code,
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
