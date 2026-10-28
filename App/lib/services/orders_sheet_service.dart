import 'package:intl/intl.dart';

import '../models/saved_order.dart';
import 'drive_sheet_ids.dart';
import 'google_sheets_write_service.dart';

/// Reads Orders.xlsx and Order_Items.xlsx from Google Drive via the service
/// account — same auth and column layout as [BillsSheetService]:
/// Orders: OrderNumber | Date | Customer | Total | Status
/// Order_Items: OrderNumber | Desc | Qty | Price
class OrdersSheetService {
  final GoogleSheetsWriteService _sheets;

  OrdersSheetService({GoogleSheetsWriteService? sheets})
      : _sheets = sheets ?? GoogleSheetsWriteService();

  static final _dateFmt = DateFormat('yyyy-MM-dd');

  Future<List<SavedOrder>> fetchOrders() async {
    final orderRows =
        await _sheets.readRows(DriveSheetIds.orders, DriveSheetIds.ordersTab);
    final itemRows = await _sheets.readRows(
        DriveSheetIds.orderItems, DriveSheetIds.orderItemsTab);

    final itemsByOrder = _parseItems(itemRows);
    return _parseOrders(orderRows, itemsByOrder);
  }

  Map<String, List<SavedOrderItem>> _parseItems(List<List<dynamic>> rows) {
    final map = <String, List<SavedOrderItem>>{};
    if (rows.isEmpty) return map;

    var start = 0;
    if (_isItemHeader(rows.first)) start = 1;

    for (var i = start; i < rows.length; i++) {
      final row = rows[i];
      if (row.isEmpty || _rowEmpty(row)) continue;
      final orderNo = _cell(row, 0);
      if (orderNo.isEmpty) continue;
      map.putIfAbsent(orderNo, () => []).add(SavedOrderItem(
            desc: _cell(row, 1),
            qty: _parseInt(row, 2),
            price: _parseDouble(row, 3),
          ));
    }
    return map;
  }

  List<SavedOrder> _parseOrders(
    List<List<dynamic>> rows,
    Map<String, List<SavedOrderItem>> itemsByOrder,
  ) {
    if (rows.isEmpty) return [];

    var start = 0;
    if (_isOrderHeader(rows.first)) start = 1;

    final orders = <SavedOrder>[];
    for (var i = start; i < rows.length; i++) {
      final row = rows[i];
      if (row.isEmpty || _rowEmpty(row)) continue;

      final orderNumber = _cell(row, 0);
      if (orderNumber.isEmpty) continue;

      final sheetTotal = _parseDouble(row, 3);
      var items = itemsByOrder[orderNumber] ?? [];
      if (items.isEmpty && sheetTotal > 0) {
        items = [SavedOrderItem(desc: 'Order items', qty: 1, price: sheetTotal)];
      }

      final statusLabel = _cell(row, 4);
      orders.add(SavedOrder(
        orderNumber: orderNumber,
        date: _parseDate(_cell(row, 1)),
        customerName: _cell(row, 2),
        items: items,
        status: statusLabel.isEmpty
            ? OrderStatus.pending
            : OrderStatusLabel.fromLabel(statusLabel),
      ));
    }
    return orders;
  }

  bool _isOrderHeader(List<dynamic> row) {
    final first = _cell(row, 0).toLowerCase();
    return first.contains('order') || first == 'order no' || first == 'order no.';
  }

  bool _isItemHeader(List<dynamic> row) {
    final first = _cell(row, 0).toLowerCase();
    return first.contains('order') || first.contains('desc');
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
