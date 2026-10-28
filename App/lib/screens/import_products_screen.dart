import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/catalog_provider.dart';
import '../services/excel_import_service.dart';
import '../theme/app_theme.dart';

enum _Step { pick, loading, preview, applying, done, error }

/// Lets the owner pick an updated Excel price list (same layout as the
/// live Product sheet: S.No | Code | Description | Voltage/Amp/Type |
/// STD.PKG. | REQ.QTY. | Price (Incl. GST) | Total) from their device and
/// import it: existing products get their Purchase Price refreshed (their
/// Margin Price is kept, so Selling Price is recalculated from it), and
/// any product codes not already in the sheet are added as new rows.
///
/// Nothing is written until the owner reviews the preview and taps
/// "Confirm Import".
class ImportProductsScreen extends StatefulWidget {
  const ImportProductsScreen({super.key});

  @override
  State<ImportProductsScreen> createState() => _ImportProductsScreenState();
}

class _ImportProductsScreenState extends State<ImportProductsScreen> {
  final _service = ExcelImportService();
  _Step _step = _Step.pick;
  String? _fileName;
  ImportPlan? _plan;
  String? _error;

  Future<void> _pickAndParse() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx'],
    );
    final path = result?.files.single.path;
    if (path == null) return; // user cancelled

    setState(() {
      _step = _Step.loading;
      _fileName = result!.files.single.name;
      _error = null;
    });

    try {
      final rows = _service.parseFile(path);
      if (rows.isEmpty) {
        throw const FormatException('No product rows found in this file.');
      }
      final plan = await _service.buildPlan(rows);
      setState(() {
        _plan = plan;
        _step = _Step.preview;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _step = _Step.error;
      });
    }
  }

  Future<void> _apply() async {
    if (_plan == null) return;
    setState(() => _step = _Step.applying);
    try {
      await _service.applyPlan(_plan!);
      if (!mounted) return;
      // Refresh the in-app catalog so Bills/Catalog/Inventory immediately
      // reflect the newly-imported prices without needing an app restart.
      await context.read<CatalogProvider>().loadProducts();
      setState(() => _step = _Step.done);
    } catch (e) {
      setState(() {
        _error = e.toString();
        _step = _Step.error;
      });
    }
  }

  void _reset() {
    setState(() {
      _step = _Step.pick;
      _plan = null;
      _fileName = null;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Import Products')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: _buildBody(),
        ),
      ),
    );
  }

  Widget _buildBody() {
    switch (_step) {
      case _Step.pick:
        return _pickView();
      case _Step.loading:
        return _loadingView('Reading $_fileName…');
      case _Step.preview:
        return _previewView();
      case _Step.applying:
        return _loadingView('Updating the Product sheet…');
      case _Step.done:
        return _doneView();
      case _Step.error:
        return _errorView();
    }
  }

  Widget _pickView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.upload_file_outlined, size: 56, color: AppColors.steelBlue),
        const SizedBox(height: 16),
        const Text('Import an updated price list', style: AppTextStyles.section),
        const SizedBox(height: 8),
        const Text(
          'Choose a .xlsx file with the same layout as your Product sheet '
          '(Code, Description, Voltage/Amp/Type, STD.PKG., Price). Existing '
          'products get their Purchase Price refreshed — their Margin Price is '
          'kept, so Selling Price updates automatically. New product codes '
          'are added at the end of the sheet. Nothing is written until you '
          'review and confirm on the next screen.',
          style: TextStyle(color: AppColors.muted, fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _pickAndParse,
            icon: const Icon(Icons.folder_open_outlined),
            label: const Text('Choose Excel File'),
          ),
        ),
      ],
    );
  }

  Widget _loadingView(String message) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: AppColors.steelBlue),
          const SizedBox(height: 16),
          Text(message, style: const TextStyle(color: AppColors.muted)),
        ],
      ),
    );
  }

  Widget _previewView() {
    final plan = _plan!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(_fileName ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        const Text('Review these changes before they\'re written to the Product sheet.',
            style: TextStyle(color: AppColors.muted, fontSize: 12.5)),
        const SizedBox(height: 16),
        Row(
          children: [
            _summaryChip('${plan.priceChanges.length}', 'to update', AppColors.steelBlue),
            const SizedBox(width: 10),
            _summaryChip('${plan.newProducts.length}', 'new products', Colors.green),
            const SizedBox(width: 10),
            _summaryChip('${plan.unchangedCount}', 'unchanged', AppColors.muted),
          ],
        ),
        const SizedBox(height: 16),
        Expanded(
          child: plan.isEmpty
              ? const Center(
                  child: Text('Nothing changed — this file matches the live sheet already.',
                      style: TextStyle(color: AppColors.muted)))
              : ListView(
                  children: [
                    if (plan.priceChanges.isNotEmpty) ...[
                      _listHeader('Price updates (${plan.priceChanges.length})'),
                      for (final u in plan.priceChanges.take(50))
                        _changeTile(
                          title: u.desc,
                          subtitle: u.code,
                          trailing:
                              '₹${u.oldPurchase.toStringAsFixed(2)} → ₹${u.newPurchase.toStringAsFixed(2)}',
                        ),
                      if (plan.priceChanges.length > 50)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Text('…and ${plan.priceChanges.length - 50} more',
                              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                        ),
                    ],
                    if (plan.newProducts.isNotEmpty) ...[
                      _listHeader('New products (${plan.newProducts.length})'),
                      for (final p in plan.newProducts.take(50))
                        _changeTile(
                          title: p.desc,
                          subtitle: '${p.code} · ${p.category}',
                          trailing: '₹${p.purchase.toStringAsFixed(2)}',
                        ),
                      if (plan.newProducts.length > 50)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Text('…and ${plan.newProducts.length - 50} more',
                              style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                        ),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(onPressed: _reset, child: const Text('Cancel')),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: plan.isEmpty ? null : _apply,
                child: const Text('Confirm Import'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _summaryChip(String count, String label, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(count, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
            Text(label, style: const TextStyle(fontSize: 10.5, color: AppColors.muted)),
          ],
        ),
      ),
    );
  }

  Widget _listHeader(String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
      );

  Widget _changeTile({required String title, required String subtitle, required String trailing}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: ListTile(
        dense: true,
        title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 11.5)),
        trailing: Text(trailing, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
      ),
    );
  }

  Widget _doneView() {
    final plan = _plan!;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.check_circle, size: 56, color: Colors.green),
          const SizedBox(height: 16),
          const Text('Import complete', style: AppTextStyles.section),
          const SizedBox(height: 8),
          Text(
            '${plan.priceChanges.length} product(s) updated, '
            '${plan.newProducts.length} new product(s) added.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted),
          ),
          const SizedBox(height: 20),
          ElevatedButton(onPressed: () => Navigator.pop(context), child: const Text('Done')),
        ],
      ),
    );
  }

  Widget _errorView() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 56, color: AppColors.red),
          const SizedBox(height: 16),
          Text(_error ?? 'Something went wrong', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 20),
          ElevatedButton(onPressed: _reset, child: const Text('Try Again')),
        ],
      ),
    );
  }
}
