import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../providers/auth_provider.dart';
import '../providers/bills_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/customer_provider.dart';
import '../services/excel_import_service.dart';
import '../theme/app_theme.dart';

class ImportExportScreen extends StatefulWidget {
  const ImportExportScreen({super.key});

  @override
  State<ImportExportScreen> createState() => _ImportExportScreenState();
}

class _ImportExportScreenState extends State<ImportExportScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Import state
  final _excelService = ExcelImportService();
  bool _parsingImport = false;
  bool _applyingImport = false;
  String? _importFileName;
  ImportPlan? _importPlan;
  String? _importError;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // =========================================================================
  // EXPORT HANDLERS
  // =========================================================================

  Future<void> _exportProducts(bool includePurchasePrice) async {
    final catalog = context.read<CatalogProvider>();
    final products = catalog.products;
    if (products.isEmpty) {
      showAppSnackBar(context, 'No products available to export.', isError: true);
      return;
    }

    final buffer = StringBuffer();
    if (includePurchasePrice) {
      buffer.writeln('Code,Description,Category,Stock,Purchase Price,Selling Price,Margin Amount,Margin Percent');
      for (final p in products) {
        buffer.writeln(
            '"${p.code}","${p.desc.replaceAll('"', '""')}","${p.category}",${p.stock},${p.purchase},${p.sellingPrice},${p.marginAmount},${p.marginPercent}');
      }
    } else {
      buffer.writeln('Code,Description,Category,Stock,Selling Price');
      for (final p in products) {
        buffer.writeln(
            '"${p.code}","${p.desc.replaceAll('"', '""')}","${p.category}",${p.stock},${p.sellingPrice}');
      }
    }

    await _shareCsv(buffer.toString(), 'products_catalog');
  }

  Future<void> _exportCustomers() async {
    final customerProvider = context.read<CustomerProvider>();
    final customers = customerProvider.customers;
    if (customers.isEmpty) {
      showAppSnackBar(context, 'No customers available to export.', isError: true);
      return;
    }

    final buffer = StringBuffer();
    buffer.writeln('Name,Phone,Address,Outstanding Balance');
    for (final c in customers) {
      buffer.writeln(
          '"${c.name.replaceAll('"', '""')}","${c.mobile}","${c.address.replaceAll('"', '""')}",${c.currentBalance}');
    }

    await _shareCsv(buffer.toString(), 'customers_directory');
  }

  Future<void> _exportBills() async {
    final billsProvider = context.read<BillsProvider>();
    final bills = billsProvider.bills;
    if (bills.isEmpty) {
      showAppSnackBar(context, 'No bills available to export.', isError: true);
      return;
    }

    final buffer = StringBuffer();
    buffer.writeln('Bill No,Customer Name,Date,Total Amount,Status');
    for (final b in bills) {
      buffer.writeln(
          '"${b.billNumber}","${b.customerName.replaceAll('"', '""')}","${DateFormat('yyyy-MM-dd').format(b.date)}",${b.total},"${b.status.name.toUpperCase()}"');
    }

    await _shareCsv(buffer.toString(), 'sales_bills');
  }

  Future<void> _shareCsv(String content, String prefix) async {
    try {
      final tempDir = await getTemporaryDirectory();
      final dateStr = DateFormat('yyyy_MM_dd_HHmm').format(DateTime.now());
      final file = File('${tempDir.path}/${prefix}_$dateStr.csv');
      await file.writeAsString(content);

      await Share.shareXFiles(
        [XFile(file.path)],
        subject: '$prefix $dateStr',
      );
    } catch (e) {
      if (!mounted) return;
      showAppSnackBar(context, 'Export error: $e', isError: true);
    }
  }

  // =========================================================================
  // IMPORT HANDLERS
  // =========================================================================

  Future<void> _pickAndParseFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'csv'],
    );
    final path = result?.files.single.path;
    if (path == null) return;

    setState(() {
      _parsingImport = true;
      _importFileName = result!.files.single.name;
      _importError = null;
      _importPlan = null;
    });

    try {
      final rows = _excelService.parseFile(path);
      if (rows.isEmpty) {
        throw const FormatException('No valid product rows found in this file.');
      }
      final plan = await _excelService.buildPlan(rows);
      setState(() {
        _importPlan = plan;
        _parsingImport = false;
      });
    } catch (e) {
      setState(() {
        _importError = e.toString();
        _parsingImport = false;
      });
    }
  }

  Future<void> _applyImport() async {
    if (_importPlan == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Import'),
        content: Text(
          'This will update ${_importPlan!.priceChanges.length} existing products and add ${_importPlan!.newProducts.length} new products to your catalog.\n\nDo you want to proceed?',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF1565C0)),
            child: const Text('Confirm & Save'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _applyingImport = true);
    try {
      await _excelService.applyPlan(_importPlan!);
      if (!mounted) return;
      await context.read<CatalogProvider>().loadProducts();
      if (!mounted) return;

      setState(() {
        _applyingImport = false;
        _importPlan = null;
        _importFileName = null;
      });

      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.check_circle_outline, color: Color(0xFF16A34A)),
              SizedBox(width: 8),
              Text('Import Completed'),
            ],
          ),
          content: const Text('All products have been successfully imported and synced with the database.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK')),
          ],
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _applyingImport = false;
        _importError = e.toString();
      });
      showAppSnackBar(context, 'Import failed: $e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Import / Export', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          tabs: const [
            Tab(icon: Icon(Icons.download_rounded), text: 'Export Data'),
            Tab(icon: Icon(Icons.upload_rounded), text: 'Import Data'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildExportTab(),
          _buildImportTab(),
        ],
      ),
    );
  }

  Widget _buildExportTab() {
    final auth = context.watch<AuthProvider>();
    final canViewPurchase = auth.canViewPurchasePrice;

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _exportCard(
          icon: Icons.inventory_2_outlined,
          title: 'Export Products Catalog',
          subtitle: 'Download complete product details, SKU codes, categories, prices, and stock counts.',
          buttonLabel: 'Export Products (CSV)',
          onExport: () => _exportProducts(canViewPurchase),
        ),
        const SizedBox(height: 16),
        _exportCard(
          icon: Icons.people_outline,
          title: 'Export Customers Directory',
          subtitle: 'Download customer contact list, addresses, and current outstanding balances.',
          buttonLabel: 'Export Customers (CSV)',
          onExport: _exportCustomers,
        ),
        const SizedBox(height: 16),
        _exportCard(
          icon: Icons.receipt_long_outlined,
          title: 'Export Sales Bills & Invoices',
          subtitle: 'Download historical invoices, customer details, totals, and payment status.',
          buttonLabel: 'Export Bills (CSV)',
          onExport: _exportBills,
        ),
      ],
    );
  }

  Widget _exportCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required String buttonLabel,
    required VoidCallback onExport,
  }) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEBF3FE),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: const Color(0xFF1976D2), size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(subtitle, style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onExport,
                icon: const Icon(Icons.file_download_outlined, size: 18),
                label: Text(buttonLabel),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF1565C0),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImportTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
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
                    Icon(Icons.table_view_outlined, color: Color(0xFF1565C0), size: 24),
                    SizedBox(width: 10),
                    Text(
                      'Import Products from Excel / CSV',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Upload a standard supplier price list (.xlsx or .csv). New products will be added and existing items will have their purchase prices refreshed safely.',
                  style: TextStyle(fontSize: 13, color: AppColors.muted),
                ),
                const SizedBox(height: 16),
                if (_importFileName != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.description, color: Color(0xFF2563EB)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(_importFileName!,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
                if (_importError != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(_importError!,
                        style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13)),
                  ),
                  const SizedBox(height: 14),
                ],
                if (_importPlan != null) ...[
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Import Plan Preview',
                            style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF166534))),
                        const SizedBox(height: 6),
                        Text('• Existing products to update: ${_importPlan!.priceChanges.length}'),
                        Text('• Brand-new products to insert: ${_importPlan!.newProducts.length}'),
                        Text('• Unchanged products: ${_importPlan!.unchangedCount}'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _parsingImport ? null : _pickAndParseFile,
                        icon: _parsingImport
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.file_open_outlined),
                        label: Text(_parsingImport ? 'Reading File...' : 'Select File'),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                    if (_importPlan != null) ...[
                      const SizedBox(width: 10),
                      FilledButton.icon(
                        onPressed: _applyingImport ? null : _applyImport,
                        icon: _applyingImport
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Icon(Icons.check, size: 18),
                        label: Text(_applyingImport ? 'Saving...' : 'Confirm Import'),
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
      ],
    );
  }
}
