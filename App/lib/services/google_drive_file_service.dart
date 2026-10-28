import 'dart:io';
import 'dart:typed_data';

import 'package:googleapis/drive/v3.dart' as drive;
import 'package:googleapis_auth/googleapis_auth.dart' as auth;
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

import '../config/google_oauth_config.dart';
import 'drive_folder_ids.dart';

/// Uploads generated bill PDFs/images into
/// Bills/{year}/{Month}/{day}/ inside the NSYU Drive folder, creating
/// any missing folders along the way.
///
/// Unlike [GoogleSheetsWriteService] (which still uses the service account),
/// this uses OAuth with a pre-authorized refresh token for your own Google
/// account (see [GoogleOAuthConfig]) — service accounts have no Drive
/// storage quota of their own, so file uploads through them fail. Sheet
/// writes don't have that problem, so Sheets stays on the service account.
class GoogleDriveFileService {
  static const _scopes = ['https://www.googleapis.com/auth/drive'];

  auth.AutoRefreshingAuthClient? _client;
  bool _isInitialized = false;

  Future<void> init() async {
    if (_isInitialized) return;

    final clientId = auth.ClientId(
      GoogleOAuthConfig.clientId,
      GoogleOAuthConfig.clientSecret,
    );

    // AccessToken is deliberately expired (year 2000) so the very first API
    // call forces an immediate refresh using the refresh token below.
    final credentials = auth.AccessCredentials(
      auth.AccessToken('Bearer', '', DateTime.utc(2000)),
      GoogleOAuthConfig.refreshToken,
      _scopes,
    );

    _client = auth.autoRefreshingClient(
      clientId,
      credentials,
      http.Client(),
    );
    _isInitialized = true;
  }

  /// Uploads [pdfFile] (and [imageFile], if given) into the Drive folder
  /// Bills/{year}/{MonthName}/{dd}/, named after [billNumber].
  Future<void> uploadBillFiles({
    required DateTime date,
    required String billNumber,
    required File pdfFile,
    File? imageFile,
  }) async {
    await init();
    final billsFolderId =
        await _findOrCreateFolder(_client!, 'Bills', DriveFolderIds.nsyuRoot);
    final yearFolderId =
        await _findOrCreateFolder(_client!, '${date.year}', billsFolderId);
    final monthFolderId = await _findOrCreateFolder(
        _client!, DateFormat('MMMM').format(date), yearFolderId);
    final dayFolderName = date.day.toString().padLeft(2, '0');
    final dayFolderId =
        await _findOrCreateFolder(_client!, dayFolderName, monthFolderId);

    final safeName = billNumber.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');

    if (await pdfFile.exists()) {
      await _uploadFile(
        _client!,
        name: '$safeName.pdf',
        parentId: dayFolderId,
        bytes: await pdfFile.readAsBytes(),
        mimeType: 'application/pdf',
      );
    }

    if (imageFile != null && await imageFile.exists()) {
      final ext = imageFile.path.split('.').last.toLowerCase();
      final mime = ext == 'png' ? 'image/png' : 'image/jpeg';
      await _uploadFile(
        _client!,
        name: '$safeName.$ext',
        parentId: dayFolderId,
        bytes: await imageFile.readAsBytes(),
        mimeType: mime,
      );
    }
  }

  Future<void> uploadPaymentReceipt({
    required DateTime date,
    required String paymentId,
    required File pdfFile,
  }) async {
    await init();
    final rootFolderId = await _findOrCreateFolder(
        _client!, 'NSYU App Data', DriveFolderIds.nsyuRoot);
    final paymentsFolderId =
        await _findOrCreateFolder(_client!, 'Payments', rootFolderId);
    final yearFolderId =
        await _findOrCreateFolder(_client!, '${date.year}', paymentsFolderId);
    final monthFolderId = await _findOrCreateFolder(
        _client!, DateFormat('MMMM').format(date), yearFolderId);

    final fileName = 'Receipt_${paymentId.substring(0, 8)}.pdf';
    await _uploadFile(_client!,
        name: fileName,
        parentId: monthFolderId,
        bytes: await pdfFile.readAsBytes(),
        mimeType: 'application/pdf');
  }

  Future<String> _findOrCreateFolder(
    auth.AutoRefreshingAuthClient client,
    String name,
    String parentId,
  ) async {
    final driveApi = drive.DriveApi(client);
    try {
      final escapedName = name.replaceAll("'", "\\'");
      final q = "name='$escapedName' and '$parentId' in parents and "
          "mimeType='application/vnd.google-apps.folder' and trashed=false";

      final fileList = await driveApi.files.list(
        q: q,
        $fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      );

      if (fileList.files != null && fileList.files!.isNotEmpty) {
        return fileList.files!.first.id!;
      }

      // If not found, create it.
      final folder = drive.File()
        ..name = name
        ..mimeType = 'application/vnd.google-apps.folder'
        ..parents = [parentId];

      final createdFolder =
          await driveApi.files.create(folder, supportsAllDrives: true);
      return createdFolder.id!;
    } catch (e) {
      throw DriveUploadException(
          'Could not find or create folder "$name". Error: ${e.toString()}');
    }
  }

  Future<String> _uploadFile(
    auth.AutoRefreshingAuthClient client, {
    required String name,
    required String parentId,
    required Uint8List bytes,
    required String mimeType,
  }) async {
    try {
      final driveApi = drive.DriveApi(client);
      final file = drive.File()
        ..name = name
        ..parents = [parentId];

      final media = drive.Media(Stream.value(bytes), bytes.length);

      final uploadedFile = await driveApi.files.create(
        file,
        uploadMedia: media,
        supportsAllDrives: true, // Important for Shared Drives
      );
      return uploadedFile.id!;
    } catch (e) {
      throw DriveUploadException(
        'Could not upload "$name" to Drive. Error: ${e.toString()}',
      );
    }
  }

  void dispose() {
    if (_isInitialized) {
      _client?.close();
      _isInitialized = false;
    }
  }
}

class DriveUploadException implements Exception {
  final String message;
  DriveUploadException(this.message);
  @override
  String toString() => message;
}
