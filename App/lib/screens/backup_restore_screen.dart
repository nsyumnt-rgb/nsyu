import 'dart:convert';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../providers/auth_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/customer_provider.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';

class BackupRestoreScreen extends StatefulWidget {
  const BackupRestoreScreen({super.key});

  @override
  State<BackupRestoreScreen> createState() => _BackupRestoreScreenState();
}

class _BackupRestoreScreenState extends State<BackupRestoreScreen> {
  final _supabase = SupabaseService();

  bool _isExporting = false;
  bool _isValidating = false;
  bool _isRestoring = false;

  Map<String, dynamic>? _lastBackupData;
  Map<String, dynamic>? _validatedData;
  String? _selectedFileName;

  Future<void> _createBackup() async {
    setState(() => _isExporting = true);
    try {
      final backup = await _supabase.exportBackupData();
      setState(() {
        _lastBackupData = backup;
        _isExporting = false;
      });

      if (!mounted) return;
      showAppSnackBar(context, 'Backup generated and verified successfully!');
    } catch (e) {
      if (!mounted) return;
      setState(() => _isExporting = false);
      showAppSnackBar(context, 'Backup failed: $e', isError: true);
    }
  }

  Future<void> _shareBackupFile() async {
    if (_lastBackupData == null) return;
    try {
      final jsonStr = const JsonEncoder.withIndent('  ').convert(_lastBackupData);
      final tempDir = await getTemporaryDirectory();
      final dateStr = DateFormat('yyyy_MM_dd_HHmm').format(DateTime.now());
      final file = File('${tempDir.path}/nsyu_backup_$dateStr.json');
      await file.writeAsString(jsonStr);

      await Share.shareXFiles(
        [XFile(file.path)],
        subject: 'NSYU Business Backup — $dateStr',
        text: 'NSYU Business verified backup file generated on ${DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.now())}.',
      );
    } catch (e) {
      if (!mounted) return;
      showAppSnackBar(context, 'Could not share backup file: $e', isError: true);
    }
  }

  Future<void> _pickAndValidateBackup() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['json'],
      );

      final path = result?.files.single.path;
      if (path == null) return;

      setState(() {
        _isValidating = true;
        _selectedFileName = result!.files.single.name;
        _validatedData = null;
      });

      final content = await File(path).readAsString();
      final decoded = jsonDecode(content) as Map<String, dynamic>;

      final validation = await _supabase.validateBackupData(decoded);

      if (!mounted) return;
      setState(() {
        _isValidating = false;
        _validatedData = decoded;
      });

      final stats = validation['stats'] ?? {};
      showAppSnackBar(
        context,
        'File verified: ${stats['productsCount'] ?? 0} products, ${stats['customersCount'] ?? 0} customers found.',
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isValidating = false;
        _validatedData = null;
      });
      showAppSnackBar(context, 'Invalid backup file: $e', isError: true);
    }
  }

  Future<void> _confirmAndRestore() async {
    if (_validatedData == null) return;
    final auth = context.read<AuthProvider>();

    if (!auth.isOwner) {
      showAppSnackBar(context, 'Permission denied: Only business Owner can restore backups.', isError: true);
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 28),
            SizedBox(width: 8),
            Text('Confirm Restore'),
          ],
        ),
        content: const Text(
          'Warning: Restoring this backup will update matching existing records and insert new data into your Supabase database.\n\nThis operation cannot be undone. Are you sure you wish to proceed?',
          style: TextStyle(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Proceed & Overwrite'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isRestoring = true);

    try {
      final res = await _supabase.restoreBackupData(_validatedData!);

      if (!mounted) return;
      setState(() {
        _isRestoring = false;
        _validatedData = null;
        _selectedFileName = null;
      });

      // Refresh app providers so changes appear everywhere immediately
      context.read<CatalogProvider>().loadProducts();
      context.read<CustomerProvider>().load();

      final msg = res['message'] ?? 'Backup restored and verified successfully!';
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.check_circle_outline, color: Color(0xFF16A34A)),
              SizedBox(width: 8),
              Text('Restoration Complete'),
            ],
          ),
          content: Text(msg),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isRestoring = false);
      showAppSnackBar(context, 'Restoration failed: $e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isOwner = auth.isOwner;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Backup & Restore', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Section 1: Backup
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.cloud_upload_outlined, color: Color(0xFF1565C0), size: 24),
                      SizedBox(width: 10),
                      Text(
                        'Create Cloud & Local Backup',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Export all authorized business data including products, categories, customers, invoices, and payments directly from Supabase PostgreSQL.',
                    style: TextStyle(fontSize: 13, color: AppColors.muted),
                  ),
                  const SizedBox(height: 16),
                  if (_lastBackupData != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFBFDBFE)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.verified, color: Color(0xFF2563EB), size: 18),
                              SizedBox(width: 6),
                              Text('Verified Backup Ready',
                                  style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E40AF))),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text('Products: ${_lastBackupData!['stats']?['productsCount'] ?? 0} | '
                              'Customers: ${_lastBackupData!['stats']?['customersCount'] ?? 0} | '
                              'Sales: ${_lastBackupData!['stats']?['salesCount'] ?? 0}'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _isExporting ? null : _createBackup,
                          icon: _isExporting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.refresh),
                          label: Text(_isExporting ? 'Generating...' : 'Generate Backup'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      if (_lastBackupData != null) ...[
                        const SizedBox(width: 10),
                        FilledButton.icon(
                          onPressed: _shareBackupFile,
                          icon: const Icon(Icons.share, size: 18),
                          label: const Text('Share File'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF1565C0),
                            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 20),

          // Section 2: Restore
          Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.settings_backup_restore, color: Color(0xFFD97706), size: 24),
                      SizedBox(width: 10),
                      Text(
                        'Restore from Backup File',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Select a valid NSYU .json backup file to inspect and safely restore records to the database.',
                    style: TextStyle(fontSize: 13, color: AppColors.muted),
                  ),
                  const SizedBox(height: 16),
                  if (!isOwner) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFF59E0B)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.lock_outline, color: Color(0xFFB45309), size: 20),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Only the business Owner can restore database records.',
                              style: TextStyle(color: Color(0xFF92400E), fontSize: 12.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (_selectedFileName != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.insert_drive_file_outlined, color: AppColors.steelBlue),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _selectedFileName!,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (_validatedData != null)
                            const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 20),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _isValidating ? null : _pickAndValidateBackup,
                          icon: _isValidating
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.folder_open),
                          label: Text(_isValidating ? 'Validating...' : 'Select File'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      if (_validatedData != null && isOwner) ...[
                        const SizedBox(width: 10),
                        FilledButton.icon(
                          onPressed: _isRestoring ? null : _confirmAndRestore,
                          icon: _isRestoring
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : const Icon(Icons.restore, size: 18),
                          label: Text(_isRestoring ? 'Restoring...' : 'Restore Now'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFFDC2626),
                            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
