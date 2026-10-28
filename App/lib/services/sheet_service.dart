import 'package:csv/csv.dart';
import 'package:http/http.dart' as http;

import '../models/product.dart';

class SheetService {
  /// Product.xlsx (converted to a Google Sheet) — "Product" tab, from your
  /// NSYU Drive folder.
  static const String sheetId = '1QfT6PNxOJKpT-PGjkYGWewsFLbtw0CBf8KQrMlEDlME';
  static const String gid = '372640203';

  /// Public CSV export endpoint. This ONLY works if the sheet's sharing
  /// setting is "Anyone with the link — Viewer". Go to Share > General
  /// access > Anyone with the link, in your Google Sheet.
  static String get csvUrl =>
      'https://docs.google.com/spreadsheets/d/$sheetId/export?format=csv&gid=$gid';

  Future<List<Product>> fetchProducts() async {
    final res = await http.get(Uri.parse(csvUrl));

    if (res.statusCode != 200) {
      throw SheetFetchException(
        'Could not load the sheet (HTTP ${res.statusCode}). '
        'Make sure it is shared as "Anyone with the link — Viewer".',
      );
    }

    // Google sometimes serves an HTML "sign in" page instead of CSV when
    // the sheet isn't public — detect that case and fail with a clear error.
    final body = res.body;
    if (body.trimLeft().startsWith('<')) {
      throw SheetFetchException(
        'This sheet is not publicly viewable, so the app received an HTML '
        'login page instead of data. Share it as "Anyone with the link — '
        'Viewer" and try again.',
      );
    }

    final rows = const CsvToListConverter().convert(body);
    if (rows.isEmpty) {
      throw SheetFetchException('The sheet appears to be empty.');
    }

    String norm(dynamic v) =>
        v.toString().replaceAll('\n', ' ').trim().toLowerCase().replaceAll(
            RegExp(r'\s+'), ' ');

    // Find the real header row: some sheets (like yours) have a merged
    // title banner in row 1, with the actual column headers a row or two
    // below. We scan the first few rows for one that contains both a
    // "code"-like and a "description"-like column.
    int headerRowIndex = 0;
    for (var i = 0; i < rows.length && i < 6; i++) {
      final normalized = rows[i].map(norm).toList();
      final hasCode = normalized.any((c) => c.contains('code'));
      final hasDesc = normalized.any(
          (c) => c.contains('description') || c.contains('product'));
      if (hasCode && hasDesc) {
        headerRowIndex = i;
        break;
      }
    }

    final header = rows[headerRowIndex].map(norm).toList();
    final col = <String, int>{};
    for (var i = 0; i < header.length; i++) {
      col[header[i]] = i;
    }

    String? currentCategory;
    final products = <Product>[];

    for (var i = headerRowIndex + 1; i < rows.length; i++) {
      final row = rows[i];
      if (row.every((c) => c == null || c.toString().trim().isEmpty)) {
        continue; // skip fully blank rows
      }

      final code = Product.readCell(row, col, [
        'code',
        'code no.',
        'code no',
        'item code',
        'product code',
        'sku',
      ]);
      final price = Product.readCell(row, col, [
        'price',
        'price (incl. gst)',
        'mrp',
        'rate',
      ]);
      final desc = Product.readCell(row, col, [
        'description',
        'product description',
        'product',
        'product name',
        'item',
        'desc',
      ]);

      // Category separator rows (merged cells) have a description-like
      // value but no code / no price — e.g. "TC - MOBILE CHARGER SINGLE USB".
      if (code.isEmpty && price.isEmpty && desc.isNotEmpty) {
        currentCategory = desc;
        continue;
      }

      if (code.isEmpty && desc.isEmpty) continue; // junk row

      final p = Product.fromRow(row, col, fallbackCategory: currentCategory);
      products.add(p);
    }

    return products;
  }
}

class SheetFetchException implements Exception {
  final String message;
  SheetFetchException(this.message);
  @override
  String toString() => message;
}
