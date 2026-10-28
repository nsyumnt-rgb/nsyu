import '../models/customer.dart';
import 'drive_sheet_ids.dart';
import 'google_sheets_write_service.dart';

/// Reads the "Customer" tab (ID | Customer | Mobile | Password | ADDRESS)
/// from the combined "nsyu" Google Sheet, via the same service account used
/// for writes — no public "Anyone with the link" sharing required.
class CustomerSheetService {
  final GoogleSheetsWriteService _sheets;

  CustomerSheetService({GoogleSheetsWriteService? sheets})
      : _sheets = sheets ?? GoogleSheetsWriteService();

  Future<List<Customer>> fetchCustomers() async {
    final rows = await _sheets.readRows(
        DriveSheetIds.customer, DriveSheetIds.customerTab);
    if (rows.isEmpty) return [];

    String norm(dynamic v) => v.toString().trim().toLowerCase();
    final header = rows.first.map(norm).toList();
    final col = <String, int>{};
    for (var i = 0; i < header.length; i++) {
      col[header[i]] = i;
    }

    String cell(List<dynamic> row, String name) {
      final idx = col[name];
      if (idx == null || idx >= row.length || row[idx] == null) return '';
      return row[idx].toString().trim();
    }

    final customers = <Customer>[];
    for (var i = 1; i < rows.length; i++) {
      final row = rows[i];
      if (row.every((c) => c == null || c.toString().trim().isEmpty)) continue;
      final id = cell(row, 'id');
      final name = cell(row, 'customer');
      final mobile = cell(row, 'mobile');
      if (id.isEmpty && name.isEmpty) continue;
      customers.add(Customer(id: id.isEmpty ? 'C${i.toString().padLeft(3, '0')}' : id,
          name: name, mobile: mobile));
    }
    return customers;
  }
}

class SheetFetchException implements Exception {
  final String message;
  SheetFetchException(this.message);
  @override
  String toString() => message;
}
