import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/business_service.dart';
import '../../theme/app_theme.dart';
import 'business_ui.dart';
import 'purchases_screen.dart';

const _types = <String, String>{
  'purchase': 'Stock in (purchase)',
  'customer_return': 'Customer return',
  'sale': 'Stock out (sale)',
  'damage': 'Damaged / lost',
  'adjustment': 'Count correction',
};

String _typeLabel(String t) => const {
      'opening': 'Opening stock',
      'purchase': 'Stock in',
      'sale': 'Sale',
      'customer_return': 'Return',
      'damage': 'Damage',
      'adjustment': 'Correction',
      'transfer_in': 'Transfer in',
      'transfer_out': 'Transfer out',
    }[t] ??
    t;

/// Stock in/out with a logged movement history (the website's Inventory › history).
class StockScreen extends StatefulWidget {
  const StockScreen({super.key});

  @override
  State<StockScreen> createState() => _StockScreenState();
}

class _StockScreenState extends State<StockScreen> {
  final _svc = BusinessService();
  Future<List<Map<String, dynamic>>>? _future;

  @override
  void initState() {
    super.initState();
    _future = _svc.stockHistory();
  }

  Future<void> _reload() async {
    final f = _svc.stockHistory();
    setState(() => _future = f);
    await f.catchError((_) => <Map<String, dynamic>>[]);
  }

  Future<void> _record() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const StockMovementSheet(),
    );
    if (saved == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('Stock movements'),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.emerald,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.swap_vert_rounded),
        label: const Text('Stock in / out'),
        onPressed: _record,
      ),
      body: BizListBody<Map<String, dynamic>>(
        future: _future,
        onRefresh: _reload,
        empty: BizState(icon: Icons.inventory_rounded, title: 'No stock movements yet', action: 'Record one', onAction: _record),
        builder: (items) => ListView.builder(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          itemCount: items.length,
          itemBuilder: (_, i) {
            final m = items[i];
            final q = (num0(m['signed_quantity'])).toInt();
            final up = q >= 0;
            final when = DateTime.tryParse('${m['created_at'] ?? m['createdAt'] ?? ''}');
            return BizCard(
              child: Row(children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(color: (up ? AppColors.success : AppColors.danger).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                  child: Icon(up ? Icons.south_west_rounded : Icons.north_east_rounded, color: up ? AppColors.success : AppColors.danger, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${(m['product'] as Map?)?['name'] ?? 'Product #${m['product_id']}'}',
                        style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
                    Text(
                      [_typeLabel('${m['type']}'), if (when != null) DateFormat('d MMM, h:mm a').format(when.toLocal()), if ((m['notes'] ?? '').toString().isNotEmpty) m['notes']].join(' · '),
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('${up ? '+' : ''}$q', style: TextStyle(fontWeight: FontWeight.w900, color: up ? AppColors.success : AppColors.danger)),
                  if (m['balance_after'] != null) Text('Bal ${m['balance_after']}', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                ]),
              ]),
            );
          },
        ),
      ),
    );
  }
}

class StockMovementSheet extends StatefulWidget {
  const StockMovementSheet({super.key});

  @override
  State<StockMovementSheet> createState() => _StockMovementSheetState();
}

class _StockMovementSheetState extends State<StockMovementSheet> {
  final _svc = BusinessService();
  List<Map<String, dynamic>>? _products;
  Map<String, dynamic>? _product;
  String _type = 'purchase';
  final _qty = TextEditingController();
  final _notes = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _svc.products().then((p) {
      if (mounted) setState(() => _products = p);
    }).catchError((e) {
      if (mounted) setState(() => _error = '$e');
    });
  }

  Future<void> _save() async {
    final q = int.tryParse(_qty.text.trim()) ?? 0;
    if (_product == null) return bizToast(context, 'Choose a product', ok: false);
    if (_type == 'adjustment' ? q == 0 : q <= 0) {
      return bizToast(context, _type == 'adjustment' ? 'Enter a non-zero number (use − to reduce)' : 'Enter a quantity above 0', ok: false);
    }
    setState(() => _saving = true);
    try {
      final msg = await _svc.recordMovement(productId: (_product!['id'] as num).toInt(), type: _type, quantity: q, notes: _notes.text.trim());
      if (!mounted) return;
      bizToast(context, msg);
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      padding: EdgeInsets.fromLTRB(16, 10, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(child: Container(width: 42, height: 4.5, decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(3)))),
          const SizedBox(height: 12),
          const Text('Stock in / out', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navy900)),
          const SizedBox(height: 14),
          if (_error != null) Text(_error!, style: const TextStyle(color: AppColors.danger)),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              alignment: Alignment.centerLeft,
              padding: const EdgeInsets.all(14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: _products == null
                ? null
                : () async {
                    final p = await showModalBottomSheet<Map<String, dynamic>>(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.white,
                      builder: (_) => ProductPickerSheet(products: _products!),
                    );
                    if (p != null) setState(() => _product = p);
                  },
            icon: const Icon(Icons.inventory_2_outlined),
            label: Text(
              _product == null
                  ? (_products == null ? 'Loading products…' : 'Choose product')
                  : '${_product!['name']} · stock ${_product!['current_stock'] ?? _product!['stock'] ?? 0}',
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            value: _type,
            decoration: bizInput('Type'),
            items: [for (final e in _types.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: (v) => setState(() => _type = v ?? 'purchase'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _qty,
            keyboardType: const TextInputType.numberWithOptions(signed: true),
            decoration: bizInput(_type == 'adjustment' ? 'Change (+ adds, − removes)' : 'Quantity'),
          ),
          const SizedBox(height: 10),
          TextField(controller: _notes, decoration: bizInput('Note (optional)')),
          const SizedBox(height: 16),
          bizPrimaryButton(label: _saving ? 'Saving…' : 'Save', onPressed: _saving ? null : _save),
        ]),
      ),
    );
  }
}
