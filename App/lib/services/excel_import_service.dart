import 'dart:io';

import 'package:excel/excel.dart' as xls;

import 'drive_sheet_ids.dart';
import 'google_sheets_write_service.dart';

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

/// One planned change to the live Product Google Sheet.
class ProductUpdate {
  final String code;
  final String desc;
  final int rowNumber; // 1-based, in the live sheet
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
/// the Product Google Sheet.
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
  final GoogleSheetsWriteService _sheets;
  // If Margin Price is missing on a live or newly-added row, treat it as 0
  // — no percentage guesswork, just plain Purchase Price + Margin Price.
  static const double _defaultMarginPrice = 0;

  ExcelImportService({GoogleSheetsWriteService? sheets})
      : _sheets = sheets ?? GoogleSheetsWriteService();

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
    // a "code"-like and a "description"-like column (same heuristic used
    // for the live Google Sheet, since both files share the same layout).
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

      // A category banner row: description present, but no code — every
      // other row either has both or neither.
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

  /// Compares [imported] rows against what's currently live in the Product
  /// Google Sheet and builds a plan of exactly what would change — nothing
  /// is written to the sheet until [applyPlan] is called.
  Future<ImportPlan> buildPlan(List<ImportedProductRow> imported) async {
    final liveRows =
        await _sheets.readRows(DriveSheetIds.product, DriveSheetIds.productTab);
    if (liveRows.isEmpty) {
      throw const FormatException('The live Product sheet appears to be empty.');
    }

    var headerRowIndex = 0;
    for (var i = 0; i < liveRows.length && i < 6; i++) {
      final normalized = liveRows[i].map(_norm).toList();
      final hasCode = normalized.any((c) => c.contains('code'));
      final hasDesc = normalized.any((c) => c.contains('description') || c.contains('product'));
      if (hasCode && hasDesc) {
        headerRowIndex = i;
        break;
      }
    }
    final header = liveRows[headerRowIndex].map(_norm).toList();
    final col = <String, int>{};
    for (var i = 0; i < header.length; i++) {
      col[header[i]] = i;
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
    final priceCol = findCol(['price \n(incl. gst)', 'price (incl. gst)', 'price', 'purchase']);
    final marginCol = findCol(['margin price', 'margin (₹)', 'margin rs', 'margin']);
    final sellingCol = findCol(['selling price', 'selling', 'sl-price', 'sl price', 'slprice']);

    if (codeCol == null || priceCol == null) {
      throw const FormatException(
          'Could not find Code / Price columns in the live Product sheet.');
    }

    // code -> (rowNumber 1-based, desc, spec, pkg, purchase, margin price)
    final liveByCode = <String, _LiveProduct>{};
    for (var i = headerRowIndex + 1; i < liveRows.length; i++) {
      final row = liveRows[i];
      final code = codeCol < row.length ? row[codeCol].toString().trim() : '';
      if (code.isEmpty) continue;
      liveByCode[code] = _LiveProduct(
        rowNumber: i + 1,
        desc: descCol != null && descCol < row.length ? row[descCol].toString().trim() : '',
        spec: specCol != null && specCol < row.length ? row[specCol].toString().trim() : '',
        pkg: pkgCol != null && pkgCol < row.length ? row[pkgCol].toString().trim() : '',
        purchase: priceCol < row.length ? _asDouble(row[priceCol]) : 0,
        marginPrice: marginCol != null && marginCol < row.length
            ? _asDouble(row[marginCol])
            : _defaultMarginPrice,
        sellingPrice: sellingCol != null && sellingCol < row.length ? _asDouble(row[sellingCol]) : 0,
      );
    }

    final updates = <ProductUpdate>[];
    final adds = <ProductAdd>[];
    var unchanged = 0;

    for (final r in imported) {
      final live = liveByCode[r.code];
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
      final descChanged = r.desc.isNotEmpty && r.desc != live.desc;
      if (!priceChanged && !descChanged) {
        unchanged++;
        continue;
      }

      // Preserve whatever Margin Price is already set for this product —
      // only the purchase price (and the selling price it drives) moves.
      final marginPrice = live.marginPrice;
      final newSelling = priceChanged ? r.purchase + marginPrice : live.sellingPrice;

      updates.add(ProductUpdate(
        code: r.code,
        desc: r.desc.isEmpty ? live.desc : r.desc,
        rowNumber: live.rowNumber,
        oldPurchase: live.purchase,
        newPurchase: r.purchase,
        oldMarginPrice: marginPrice,
        newSellingPrice: newSelling,
        descChanged: descChanged,
        newDesc: r.desc.isEmpty ? live.desc : r.desc,
        newSpec: r.spec.isEmpty ? live.spec : r.spec,
        newPkg: r.pkg.isEmpty ? live.pkg : r.pkg,
      ));
    }

    return ImportPlan(priceChanges: updates, newProducts: adds, unchangedCount: unchanged);
  }

  /// Writes everything in [plan] to the live Product Google Sheet: one
  /// batched call for all the changed cells across every updated row, plus
  /// one call to append every brand-new product (grouped under an
  /// "Imported" category banner).
  Future<void> applyPlan(ImportPlan plan) async {
    if (plan.priceChanges.isNotEmpty) {
      final cellUpdates = <String, List<dynamic>>{};
      for (final u in plan.priceChanges) {
        cellUpdates['G${u.rowNumber}'] = [u.newPurchase];
        cellUpdates['J${u.rowNumber}'] = [u.newSellingPrice];
        if (u.descChanged) {
          cellUpdates['C${u.rowNumber}'] = [u.newDesc];
          cellUpdates['D${u.rowNumber}'] = [u.newSpec];
          cellUpdates['E${u.rowNumber}'] = [u.newPkg];
        }
      }
      await _sheets.batchUpdateCells(
        DriveSheetIds.product,
        DriveSheetIds.productTab,
        cellUpdates,
      );
    }

    if (plan.newProducts.isNotEmpty) {
      final rows = <List<dynamic>>[
        [null, null, 'IMPORTED — NEW PRODUCTS', null, null, null, null, null, null, null],
        for (final p in plan.newProducts)
          [
            null, // S.No — left blank, sheet already has its own numbering
            p.code,
            p.desc,
            p.spec,
            p.pkg,
            null, // REQ. QTY.
            p.purchase,
            null, // TOTAL
            p.marginPrice,
            p.sellingPrice,
          ],
      ];
      await _sheets.appendRows(DriveSheetIds.product, DriveSheetIds.productTab, rows);
    }
  }
}

class _LiveProduct {
  final int rowNumber;
  final String desc, spec, pkg;
  final double purchase, marginPrice, sellingPrice;

  _LiveProduct({
    required this.rowNumber,
    required this.desc,
    required this.spec,
    required this.pkg,
    required this.purchase,
    required this.marginPrice,
    required this.sellingPrice,
  });
}
