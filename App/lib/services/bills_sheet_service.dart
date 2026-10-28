import 'package:intl/intl.dart';

import '../models/saved_bill.dart';
import 'drive_sheet_ids.dart';
import 'google_sheets_write_service.dart';

/// Reads Bills.xlsx and Bill_Items.xlsx from Google Drive via the service
/// account — same auth as [GoogleSheetsWriteService].
class BillsSheetService {
  final GoogleSheetsWriteService _sheets;

  BillsSheetService({GoogleSheetsWriteService? sheets})
      : _sheets = sheets ?? GoogleSheetsWriteService();

  static final _dateFmt = DateFormat('yyyy-MM-dd');

  Future<List<SavedBill>> fetchBills() async {
    final billRows =
        await _sheets.readRows(DriveSheetIds.bills, DriveSheetIds.billsTab);
    final itemRows = await _sheets.readRows(
        DriveSheetIds.billItems, DriveSheetIds.billItemsTab);

    final itemsByBill = _parseItems(itemRows);
    return _parseBills(billRows, itemsByBill);
  }

  Map<String, List<SavedBillItem>> _parseItems(List<List<dynamic>> rows) {
    final map = <String, List<SavedBillItem>>{};
    if (rows.isEmpty) return map;

    var start = 0;
    if (_isItemHeader(rows.first)) start = 1;

    for (var i = start; i < rows.length; i++) {
      final row = rows[i];
      if (row.isEmpty || _rowEmpty(row)) continue;
      final billNo = _cell(row, 0);
      if (billNo.isEmpty) continue;
      map.putIfAbsent(billNo, () => []).add(SavedBillItem(
            desc: _cell(row, 1),
            qty: _parseInt(row, 2),
            price: _parseDouble(row, 3),
          ));
    }
    return map;
  }

  List<SavedBill> _parseBills(
    List<List<dynamic>> rows,
    Map<String, List<SavedBillItem>> itemsByBill,
  ) {
    if (rows.isEmpty) return [];

    var start = 0;
    if (_isBillHeader(rows.first)) start = 1;

    final bills = <SavedBill>[];
    for (var i = start; i < rows.length; i++) {
      final row = rows[i];
      if (row.isEmpty || _rowEmpty(row)) continue;

      final billNumber = _cell(row, 0);
      if (billNumber.isEmpty) continue;

      final sheetTotal = _parseDouble(row, 3);
      var items = itemsByBill[billNumber] ?? [];
      if (items.isEmpty && sheetTotal > 0) {
        items = [SavedBillItem(desc: 'Bill items', qty: 1, price: sheetTotal)];
      }

      final statusLabel = _cell(row, 6);
      bills.add(SavedBill(
        billNumber: billNumber,
        date: _parseDate(_cell(row, 1)),
        customerName: _cell(row, 2),
        items: items,
        status: statusLabel.isEmpty
            ? BillStatus.unpaid
            : BillStatusLabel.fromLabel(statusLabel),
        // Column E ("Paid") — restores partial-payment progress on a
        // fresh sync so it isn't lost/reset to 0.
        paidAmount: _parseDouble(row, 4),
      ));
    }
    return bills;
  }

  bool _isBillHeader(List<dynamic> row) {
    final first = _cell(row, 0).toLowerCase();
    return first.contains('bill') || first == 'bill no' || first == 'bill no.';
  }

  bool _isItemHeader(List<dynamic> row) {
    final first = _cell(row, 0).toLowerCase();
    return first.contains('bill') || first.contains('desc');
  }

  bool _rowEmpty(List<dynamic> row) =>
      row.every((c) => c == null || c.toString().trim().isEmpty);

  String _cell(List<dynamic> row, int index) {
    if (index >= row.length || row[index] == null) return '';
    return row[index].toString().trim();
  }

  int _parseInt(List<dynamic> row, int index) {
    final s = _cell(row, index).replaceAll(',', '');
    return int.tryParse(s) ?? double.tryParse(s)?.round() ?? 0;
  }

  double _parseDouble(List<dynamic> row, int index) {
    final s = _cell(row, index).replaceAll(',', '').replaceAll('₹', '');
    return double.tryParse(s) ?? 0;
  }

  DateTime _parseDate(String raw) {
    if (raw.isEmpty) return DateTime.now();
    try {
      return _dateFmt.parse(raw);
    } catch (_) {}
    return DateTime.tryParse(raw) ?? DateTime.now();
  }
}
