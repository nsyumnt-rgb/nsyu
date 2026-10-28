import '../models/payment.dart';
import 'drive_sheet_ids.dart';
import 'google_sheets_write_service.dart';

class PaymentsSheetService {
  final GoogleSheetsWriteService _sheets;

  PaymentsSheetService({GoogleSheetsWriteService? sheets})
      : _sheets = sheets ?? GoogleSheetsWriteService();

  Future<List<Payment>> fetchPayments() async {
    final rows = await _sheets.readRows(
        DriveSheetIds.payments, DriveSheetIds.paymentsTab);
    if (rows.isEmpty) return [];

    var start = 0;
    if (_isHeader(rows.first)) start = 1;

    final payments = <Payment>[];
    for (var i = start; i < rows.length; i++) {
      final row = rows[i];
      if (row.isEmpty || _rowEmpty(row)) continue;

      payments.add(Payment(
        id: _cell(row, 0),
        date: _parseDate(_cell(row, 1)),
        customerName: _cell(row, 2),
        amount: _parseDouble(row, 3),
        method: PaymentMethod.fromLabel(_cell(row, 4)),
        transactionId: _cell(row, 5),
        remarks: _cell(row, 6),
      ));
    }
    return payments;
  }

  Future<void> addPayment(Payment payment) async {
    await _sheets.appendRow(
      DriveSheetIds.payments,
      DriveSheetIds.paymentsTab,
      payment.toSheetRow(),
    );
  }

  bool _isHeader(List<dynamic> row) {
    final first = _cell(row, 0).toLowerCase();
    return first.contains('id');
  }

  bool _rowEmpty(List<dynamic> row) =>
      row.every((c) => c == null || c.toString().trim().isEmpty);

  String _cell(List<dynamic> row, int index) {
    if (index >= row.length || row[index] == null) return '';
    return row[index].toString().trim();
  }

  double _parseDouble(List<dynamic> row, int index) {
    final s = _cell(row, index).replaceAll(',', '').replaceAll('₹', '');
    return double.tryParse(s) ?? 0;
  }

  DateTime _parseDate(String raw) {
    if (raw.isEmpty) return DateTime.now();
    try {
      return DateTime.parse(raw);
    } catch (_) {}
    return DateTime.tryParse(raw) ?? DateTime.now();
  }
}
