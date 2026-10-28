import 'drive_sheet_ids.dart';
import 'google_sheets_write_service.dart';

/// Writes a single product's Margin Price (and its recomputed Selling
/// Price) back to the Product Google Sheet — used by the Inventory screen.
///
/// This only ever touches the Margin Price and Selling Price cells of the
/// matching row; it never rewrites the whole row, so Code/Description/
/// Stock/etc are left completely untouched.
class ProductWriteService {
  final GoogleSheetsWriteService _sheets;

  ProductWriteService({GoogleSheetsWriteService? sheets})
      : _sheets = sheets ?? GoogleSheetsWriteService();

  static String _norm(dynamic v) => v
      .toString()
      .replaceAll('\n', ' ')
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'\s+'), ' ');

  /// 0-based column index -> spreadsheet column letter (0->A, 25->Z, 26->AA…).
  static String columnLetter(int index) {
    var n = index + 1;
    var s = '';
    while (n > 0) {
      final rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = (n - 1) ~/ 26;
    }
    return s;
  }

  /// Finds [productCode] in the Product sheet and overwrites its Margin
  /// Price (and Selling Price, if that column exists) for the given
  /// [purchase] price. Returns the newly-computed selling price.
  Future<double> updateMarginPrice({
    required String productCode,
    required double purchase,
    required double newMarginPrice,
  }) async {
    final rows =
        await _sheets.readRows(DriveSheetIds.product, DriveSheetIds.productTab);
    if (rows.isEmpty) {
      throw SheetWriteException('The Product sheet appears to be empty.');
    }

    // Same header-detection as the read-only catalog fetch: the real header
    // row isn't always row 1 (some sheets have a merged title banner above
    // it), so scan the first few rows for one containing both a
    // "code"-like and a "description"-like column.
    var headerRowIndex = 0;
    for (var i = 0; i < rows.length && i < 6; i++) {
      final normalized = rows[i].map(_norm).toList();
      final hasCode = normalized.any((c) => c.contains('code'));
      final hasDesc = normalized
          .any((c) => c.contains('description') || c.contains('product'));
      if (hasCode && hasDesc) {
        headerRowIndex = i;
        break;
      }
    }

    final header = rows[headerRowIndex].map(_norm).toList();
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

    final codeCol = findCol(
        ['code', 'code no.', 'code no', 'item code', 'product code', 'sku']);
    final marginCol =
        findCol(['margin price', 'margin (₹)', 'margin(rs)', 'margin rs', 'margin']);
    final sellingCol = findCol(
        ['selling price', 'selling', 'sale price', 'sl-price', 'sl price', 'slprice']);

    if (codeCol == null) {
      throw SheetWriteException(
          'Could not find a "Code" column in the Product sheet.');
    }
    if (marginCol == null) {
      throw SheetWriteException(
          'Could not find a "Margin Price" column in the Product sheet.');
    }

    int? rowNumber;
    for (var i = headerRowIndex + 1; i < rows.length; i++) {
      final row = rows[i];
      if (codeCol < row.length &&
          row[codeCol].toString().trim() == productCode) {
        rowNumber = i + 1; // Sheets rows are 1-based
        break;
      }
    }
    if (rowNumber == null) {
      throw SheetWriteException(
          'Could not find product "$productCode" in the Product sheet.');
    }

    final newSelling = purchase + newMarginPrice;

    await _sheets.updateCell(
      DriveSheetIds.product,
      DriveSheetIds.productTab,
      '${columnLetter(marginCol)}$rowNumber',
      newMarginPrice,
    );
    if (sellingCol != null) {
      await _sheets.updateCell(
        DriveSheetIds.product,
        DriveSheetIds.productTab,
        '${columnLetter(sellingCol)}$rowNumber',
        newSelling,
      );
    }
    return newSelling;
  }

  /// Appends a brand-new row to the Product sheet for a new catalog item.
  /// Works out the next S.No automatically and computes Selling Price as
  /// Purchase Price + Margin Price (unless [sellingPrice] is passed
  /// explicitly).
  ///
  /// Only ADDS a row — every existing row/column in the sheet is left
  /// completely untouched, exactly like [updateMarginPrice] only ever
  /// touches the cells it needs.
  Future<int> addProduct({
    required String code,
    required String desc,
    String spec = '',
    String category = '',
    int pkg = 1,
    required double purchase,
    double marginPrice = 0,
    double? sellingPrice,
    int stock = 0,
  }) async {
    final rows =
        await _sheets.readRows(DriveSheetIds.product, DriveSheetIds.productTab);
    if (rows.isEmpty) {
      throw SheetWriteException('The Product sheet appears to be empty.');
    }

    // Same header-row detection used by updateMarginPrice (some sheets have
    // a merged title banner above the real header row).
    var headerRowIndex = 0;
    for (var i = 0; i < rows.length && i < 6; i++) {
      final normalized = rows[i].map(_norm).toList();
      final hasCode = normalized.any((c) => c.contains('code'));
      final hasDesc = normalized
          .any((c) => c.contains('description') || c.contains('product'));
      if (hasCode && hasDesc) {
        headerRowIndex = i;
        break;
      }
    }

    final header = rows[headerRowIndex].map(_norm).toList();
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

    final snoCol = findCol(['sno', 's.no.', 's.no', 'sr no', 'sr.no', '#']);
    final codeCol = findCol(
        ['code', 'code no.', 'code no', 'item code', 'product code', 'sku']);
    final descCol = findCol([
      'description',
      'product description',
      'product',
      'product name',
      'item',
      'desc',
    ]);
    final specCol = findCol(
        ['voltage/amp/type', 'spec', 'specification', 'specifications']);
    final categoryCol = findCol(['category', 'cat', 'group']);
    final pkgCol = findCol(
        ['pkg', 'std.pkg.', 'std.pkg', 'std pkg', 'package', 'pack', 'moq']);
    final purchaseCol = findCol([
      'purchase',
      'purchase price',
      'cost',
      'cost price',
      'price',
      'price (incl. gst)',
      'mrp',
      'rate',
    ]);
    final marginCol =
        findCol(['margin price', 'margin (₹)', 'margin(rs)', 'margin rs', 'margin']);
    final sellingCol = findCol([
      'selling price',
      'selling',
      'sale price',
      'sl-price',
      'sl price',
      'slprice',
    ]);
    final stockCol = findCol(['stock', 'qty', 'quantity', 'in stock']);

    if (codeCol == null) {
      throw SheetWriteException(
          'Could not find a "Code" column in the Product sheet.');
    }
    if (descCol == null) {
      throw SheetWriteException(
          'Could not find a "Description" column in the Product sheet.');
    }

    // Work out the next S.No by scanning existing data rows for the
    // highest number already used.
    var nextSno = rows.length - headerRowIndex; // sensible fallback
    if (snoCol != null) {
      var maxSno = 0;
      for (var i = headerRowIndex + 1; i < rows.length; i++) {
        final row = rows[i];
        if (snoCol < row.length) {
          final n = int.tryParse(row[snoCol].toString().trim());
          if (n != null && n > maxSno) maxSno = n;
        }
      }
      nextSno = maxSno + 1;
    }

    final computedSelling = sellingPrice ?? (purchase + marginPrice);

    final width = header.length;
    final newRow = List<dynamic>.filled(width, '', growable: true);
    void setCell(int? colIdx, dynamic value) {
      if (colIdx == null) return;
      if (colIdx >= newRow.length) {
        newRow.length = colIdx + 1;
        for (var i = 0; i < newRow.length; i++) {
          newRow[i] ??= '';
        }
      }
      newRow[colIdx] = value;
    }

    setCell(snoCol, nextSno);
    setCell(codeCol, code);
    setCell(descCol, desc);
    setCell(specCol, spec);
    setCell(categoryCol, category);
    setCell(pkgCol, pkg);
    setCell(purchaseCol, purchase);
    setCell(marginCol, marginPrice);
    setCell(sellingCol, computedSelling);
    setCell(stockCol, stock);

    await _sheets.appendRow(DriveSheetIds.product, DriveSheetIds.productTab, newRow);
    return nextSno;
  }
}
