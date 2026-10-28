import '../models/app_settings.dart';
import 'drive_sheet_ids.dart';
import 'google_sheets_write_service.dart';

/// Reads the "Settings" tab (Field | Value rows: Company, Logo, Phone,
/// Email, Terms, Margin Price) from the combined "nsyu" Google Sheet, via
/// the same service account used for writes.
class SettingsSheetService {
  final GoogleSheetsWriteService _sheets;

  SettingsSheetService({GoogleSheetsWriteService? sheets})
      : _sheets = sheets ?? GoogleSheetsWriteService();

  Future<AppSettings> fetchSettings() async {
    final rows = await _sheets.readRows(
        DriveSheetIds.settings, 'Settings');
    final settings = AppSettings();

    for (final row in rows) {
      if (row.length < 2) continue;
      final field = row[0].toString().trim().toLowerCase();
      final value = row[1].toString().trim();
      if (value.isEmpty) continue;
      switch (field) {
        case 'company':
          settings.company = value;
          break;
        case 'logo':
          settings.logo = value;
          break;
        case 'phone':
          settings.phone = value;
          break;
        case 'email':
          settings.email = value;
          break;
        case 'terms':
          settings.terms = value;
          break;
        case 'margin price':
        case 'margin (₹)':
        case 'margin rs':
        case 'margin':
          settings.marginPrice = double.tryParse(value) ?? settings.marginPrice;
          break;
      }
    }
    return settings;
  }
}

class SettingsFetchException implements Exception {
  final String message;
  SettingsFetchException(this.message);
  @override
  String toString() => message;
}
