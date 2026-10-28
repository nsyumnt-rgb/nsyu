import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:googleapis_auth/auth_io.dart';

/// Writes to Google Sheets using the service account key bundled in
/// `assets/service_account/nsyu_service_account.json`.
///
/// ⚠️ Security note: because this key ships inside the app, anyone who
/// extracts it from the installed app could write to (or read) every file
/// the service account has access to. Only use this build on devices you
/// control — never publish it to a public app store.
class GoogleSheetsWriteService {
  static const _keyAssetPath =
      'assets/service_account/nsyu_service_account.json';
  static const _scopes = ['https://www.googleapis.com/auth/spreadsheets'];

  late AutoRefreshingAuthClient _client;
  bool _isInitialized = false;

  Future<void> init() async {
    if (_isInitialized) return;
    final jsonStr = await rootBundle.loadString(_keyAssetPath);
    final credentials = ServiceAccountCredentials.fromJson(jsonDecode(jsonStr));
    _client = await clientViaServiceAccount(credentials, _scopes);
    _isInitialized = true;
  }

  Future<void> _ensureInitialized() => init();

  /// Appends one row to the end of [sheetName] inside spreadsheet
  /// [spreadsheetId]. Values are written left-to-right starting at column A.
  Future<void> appendRow(
    String spreadsheetId,
    String sheetName,
    List<dynamic> values,
  ) async {
    await _ensureInitialized();
    final range = Uri.encodeComponent('$sheetName!A:Z');
    final url = Uri.parse(
      'https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/$range'
      ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
    );
    final res = await _client.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'values': [values],
      }),
    );
    if (res.statusCode >= 300) {
      throw SheetWriteException(
        'Could not write to $sheetName (HTTP ${res.statusCode}): ${res.body}',
      );
    }
  }

  /// Appends several rows at once (fewer network calls than one-by-one).
  Future<void> appendRows(
    String spreadsheetId,
    String sheetName,
    List<List<dynamic>> rows,
  ) async {
    await _ensureInitialized();
    if (rows.isEmpty) return;
    final range = Uri.encodeComponent('$sheetName!A:Z');
    final url = Uri.parse(
      'https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/$range'
      ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
    );
    final res = await _client.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'values': rows}),
    );
    if (res.statusCode >= 300) {
      throw SheetWriteException(
        'Could not write to $sheetName (HTTP ${res.statusCode}): ${res.body}',
      );
    }
  }

  /// Reads all rows from [sheetName] inside spreadsheet [spreadsheetId].
  /// Returns an empty list when the tab has no data.
  Future<List<List<dynamic>>> readRows(
    String spreadsheetId,
    String sheetName,
  ) async {
    await _ensureInitialized();
    final range = Uri.encodeComponent('$sheetName!A:Z');
    final url = Uri.parse(
      'https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/$range',
    );
    final res = await _client.get(url);
    if (res.statusCode >= 300) {
      throw SheetWriteException(
        'Could not read $sheetName (HTTP ${res.statusCode}): ${res.body}',
      );
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final values = (data['values'] as List?) ?? [];
    return values.map((row) => (row as List).toList()).toList();
  }

  /// Returns the 1-based row number (including header) of the first row in
  /// column A of [sheetName] that equals [matchValue], or null if not found.
  Future<int?> findRowByFirstColumn(
    String spreadsheetId,
    String sheetName,
    String matchValue,
  ) async {
    await _ensureInitialized();
    final range = Uri.encodeComponent('$sheetName!A:A');
    final url = Uri.parse(
      'https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/$range',
    );
    final res = await _client.get(url);
    if (res.statusCode >= 300) {
      throw SheetWriteException(
        'Could not read $sheetName (HTTP ${res.statusCode}): ${res.body}',
      );
    }
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final values = (data['values'] as List?) ?? [];
    for (var i = 0; i < values.length; i++) {
      final row = values[i] as List;
      if (row.isNotEmpty && row[0].toString().trim() == matchValue) {
        return i + 1; // Sheets rows are 1-based
      }
    }
    return null;
  }

  /// Overwrites a single existing row (e.g. to update a Bill's status).
  /// [rowNumber] is 1-based (as returned by [findRowByFirstColumn]).
  Future<void> updateRow(
    String spreadsheetId,
    String sheetName,
    int rowNumber,
    List<dynamic> values,
  ) async {
    await _ensureInitialized();
    final endCol = String.fromCharCode('A'.codeUnitAt(0) + values.length - 1);
    final range =
        Uri.encodeComponent('$sheetName!A$rowNumber:$endCol$rowNumber');
    // NOTE: unlike values.append (which needs the ":append" custom-method
    // suffix), values.update is a plain PUT to /values/{range} — no verb
    // suffix. Adding ":update" here made Google try to parse "{range}:update"
    // as one A1 range and fail with "Unable to parse range: ...:update".
    final url = Uri.parse(
      'https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/$range'
      '?valueInputOption=USER_ENTERED',
    );
    final res = await _client.put(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'values': [values],
      }),
    );
    if (res.statusCode >= 300) {
      throw SheetWriteException(
        'Could not update $sheetName (HTTP ${res.statusCode}): ${res.body}',
      );
    }
  }

  /// Overwrites a single cell (e.g. "H12") — used when only one or two
  /// columns of a row need to change, without touching the rest of the row.
  Future<void> updateCell(
    String spreadsheetId,
    String sheetName,
    String a1Cell,
    dynamic value,
  ) async {
    await _ensureInitialized();
    final range = Uri.encodeComponent('$sheetName!$a1Cell');
    final url = Uri.parse(
      'https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values/$range'
      '?valueInputOption=USER_ENTERED',
    );
    final res = await _client.put(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'values': [
          [value]
        ],
      }),
    );
    if (res.statusCode >= 300) {
      throw SheetWriteException(
        'Could not update $sheetName!$a1Cell (HTTP ${res.statusCode}): ${res.body}',
      );
    }
  }

  /// Updates many separate cell ranges in a SINGLE request — e.g. bulk
  /// price updates during an Excel import, where each product's Purchase
  /// Price and Selling Price live on a different row. Doing this with
  /// individual [updateCell] calls for a 300+ product catalog would be
  /// hundreds of network round-trips; this does it in one.
  ///
  /// [updates] maps an A1 cell/range (e.g. "G12" or "G12:H12") to the row
  /// of values to place there (e.g. [69.0] or [69.0, 82.8]).
  Future<void> batchUpdateCells(
    String spreadsheetId,
    String sheetName,
    Map<String, List<dynamic>> updates,
  ) async {
    await _ensureInitialized();
    if (updates.isEmpty) return;
    final url = Uri.parse(
      'https://sheets.googleapis.com/v4/spreadsheets/$spreadsheetId/values:batchUpdate',
    );
    final data = updates.entries
        .map((e) => {
              'range': '$sheetName!${e.key}',
              'values': [e.value],
            })
        .toList();
    final res = await _client.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'valueInputOption': 'USER_ENTERED',
        'data': data,
      }),
    );
    if (res.statusCode >= 300) {
      throw SheetWriteException(
        'Could not batch-update $sheetName (HTTP ${res.statusCode}): ${res.body}',
      );
    }
  }

  void dispose() {
    if (_isInitialized) {
      _client.close();
      _isInitialized = false;
    }
  }
}

class SheetWriteException implements Exception {
  final String message;
  SheetWriteException(this.message);
  @override
  String toString() => message;
}
