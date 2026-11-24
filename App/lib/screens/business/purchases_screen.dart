import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

import '../../services/business_service.dart';
import '../../theme/app_theme.dart';
import 'business_ui.dart';

const _uuid = Uuid();

Color _statusColor(String s) => switch (s) {
      'paid' => AppColors.success,
      'partial' => AppColors.warning,
      'cancelled' || 'returned' => AppColors.textSecondary,
      _ => AppColors.danger,
    };

/// Stock purchases from suppliers. Saving one adds the stock and the supplier due.
class PurchasesScreen extends StatefulWidget {
  const PurchasesScreen({super.key});

  @override
  State<PurchasesScreen> createState() => _PurchasesScreenState();
}

class _PurchasesScreenState extends State<PurchasesScreen> {
  final _svc = BusinessService();
  Future<List<Map<String, dynamic>>>? _future;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _future = _svc.purchases();
  }

  Future<void> _reload() async {
    final f = _svc.purchases();
    setState(() => _future = f);
    await f.catchError((_) => <Map<String, dynamic>>[]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('Purchases'),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.emerald,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_shopping_cart_rounded),
        label: const Text('New purchase'),
        onPressed: () async {
          await Navigator.push(context, MaterialPageRoute(builder: (_) => const NewPurchaseScreen()));
          _reload();
        },
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: SegmentedButton<String>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: 'all', label: Text('All')),
              ButtonSegment(value: 'due', label: Text('Unpaid')),
              ButtonSegment(value: 'paid', label: Text('Paid')),
            ],
            selected: {_filter},
            onSelectionChanged: (s) => setState(() => _filter = s.first),
          ),
        ),
        Expanded(
          child: BizListBody<Map<String, dynamic>>(
            future: _future,
            onRefresh: _reload,
            empty: const BizState(icon: Icons.receipt_long_rounded, title: 'No purchases yet', text: 'Record stock you buy from suppliers.'),
            builder: (items) {
              final list = items.where((p) {
                if (_filter == 'due') return num0(p['due_amount']) > 0 && p['status'] != 'cancelled';
                if (_filter == 'paid') return num0(p['due_amount']) <= 0;
                return true;
              }).toList();
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                children: [for (final p in list) PurchaseTile(p: p, onChanged: _reload)],
              );
            },
          ),
        ),
      ]),
    );
  }
}

class PurchaseTile extends StatelessWidget {
  final Map<String, dynamic> p;
  final VoidCallback onChanged;
  const PurchaseTile({super.key, required this.p, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final status = '${p['status'] ?? ''}';
    return BizCard(
      onTap: () async {
        await Navigator.push(context, MaterialPageRoute(builder: (_) => PurchaseDetailScreen(purchaseId: (p['id'] as num).toInt())));
        onChanged();
      },
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${p['purchase_number'] ?? 'Purchase'}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            Text('${(p['supplier'] as Map?)?['name'] ?? ''} · ${shortDate(p['purchase_date'])}',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary), overflow: TextOverflow.ellipsis),
          ]),
        ),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(inr(p['total_amount']), style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 3),
          num0(p['due_amount']) > 0 && status != 'cancelled'
              ? BizPill('Due ${inr(p['due_amount'])}', color: AppColors.danger)
              : BizPill(status.isEmpty ? 'paid' : status, color: _statusColor(status)),
        ]),
      ]),
    );
  }
}

class PurchaseDetailScreen extends StatefulWidget {
  final int purchaseId;
  const PurchaseDetailScreen({super.key, required this.purchaseId});

  @override
  State<PurchaseDetailScreen> createState() => _PurchaseDetailScreenState();
}

class _PurchaseDetailScreenState extends State<PurchaseDetailScreen> {
  final _svc = BusinessService();
  Map<String, dynamic>? _p;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p = await _svc.purchase(widget.purchaseId);
      if (mounted) setState(() {
        _p = p;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  Future<void> _pay() async {
    final due = num0(_p!['due_amount']);
    final amount = TextEditingController(text: due.toStringAsFixed(2));
    String method = 'cash';
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: const Text('Pay supplier'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: bizInput('Amount (due ${inr(due)})')),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              value: method,
              decoration: bizInput('Method'),
              items: const [
                DropdownMenuItem(value: 'cash', child: Text('Cash')),
                DropdownMenuItem(value: 'upi', child: Text('UPI')),
                DropdownMenuItem(value: 'bank', child: Text('Bank transfer')),
                DropdownMenuItem(value: 'cheque', child: Text('Cheque')),
              ],
              onChanged: (v) => set(() => method = v ?? 'cash'),
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(style: FilledButton.styleFrom(backgroundColor: AppColors.emerald), onPressed: () => Navigator.pop(ctx, true), child: const Text('Record payment')),
          ],
        ),
      ),
    );
    if (ok != true) return;
    final a = double.tryParse(amount.text.trim()) ?? 0;
    if (a <= 0 || a > due + 0.005) {
      if (mounted) bizToast(context, 'Enter an amount between ₹0 and the due', ok: false);
      return;
    }
    try {
      final msg = await _svc.payPurchase(widget.purchaseId, a, method, _uuid.v4());
      if (!mounted) return;
      bizToast(context, msg);
      _load();
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _p;
    final items = ((p?['items'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    final due = num0(p?['due_amount']);
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar(p?['purchase_number']?.toString() ?? 'Purchase'),
      bottomNavigationBar: p != null && due > 0 && p['status'] != 'cancelled'
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: bizPrimaryButton(label: 'Pay ${inr(due)}', icon: Icons.payments_rounded, onPressed: _pay),
              ),
            )
          : null,
      body: _error != null
          ? BizState(icon: Icons.cloud_off_rounded, title: 'Could not load', text: _error, action: 'Try again', onAction: _load, error: true)
          : p == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.all(16), children: [
                    BizCard(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${(p['supplier'] as Map?)?['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        Text(shortDate(p['purchase_date']), style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        const Divider(height: 20),
                        _kv('Subtotal', inr(p['subtotal'])),
                        if (num0(p['discount_amount']) > 0) _kv('Discount', '− ${inr(p['discount_amount'])}'),
                        if (num0(p['tax_amount']) > 0) _kv('Tax', inr(p['tax_amount'])),
                        _kv('Total', inr(p['total_amount']), bold: true),
                        _kv('Paid', inr(p['paid_amount'])),
                        _kv('Due', inr(p['due_amount']), color: due > 0 ? AppColors.danger : AppColors.success, bold: true),
                      ]),
                    ),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(4, 8, 4, 8),
                      child: Text('ITEMS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textSecondary, letterSpacing: 0.6)),
                    ),
                    for (final it in items)
                      BizCard(
                        child: Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('${it['product_name'] ?? (it['product'] as Map?)?['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                              Text('${it['quantity']} × ${inr(it['rate'])}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            ]),
                          ),
                          Text(inr(it['total_amount'] ?? num0(it['quantity']) * num0(it['rate'])), style: const TextStyle(fontWeight: FontWeight.w800)),
                        ]),
                      ),
                  ]),
                ),
    );
  }

  Widget _kv(String k, String v, {Color? color, bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(k, style: const TextStyle(color: AppColors.textSecondary))),
          Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w800 : FontWeight.w600, color: color)),
        ]),
      );
}

class _Line {
  Map<String, dynamic> product;
  int qty;
  double rate;
  double tax;
  _Line(this.product, this.qty, this.rate, this.tax);
  double get total => qty * rate * (1 + tax / 100);
}

class NewPurchaseScreen extends StatefulWidget {
  final int? supplierId;
  const NewPurchaseScreen({super.key, this.supplierId});

  @override
  State<NewPurchaseScreen> createState() => _NewPurchaseScreenState();
}

class _NewPurchaseScreenState extends State<NewPurchaseScreen> {
  final _svc = BusinessService();
  final _requestId = _uuid.v4(); // one id per purchase, so a double tap can't save it twice
  List<Map<String, dynamic>> _suppliers = [];
  List<Map<String, dynamic>> _products = [];
  int? _supplierId;
  final List<_Line> _lines = [];
  final _paid = TextEditingController(text: '0');
  final _notes = TextEditingController();
  String _method = 'cash';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _supplierId = widget.supplierId;
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await Future.wait([_svc.suppliers(), _svc.products()]);
      if (!mounted) return;
      setState(() {
        _suppliers = r[0].where((s) => s['status'] != 'inactive').toList();
        _products = r[1];
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  double get _total => _lines.fold(0, (a, l) => a + l.total);

  Future<void> _addLine() async {
    final picked = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => ProductPickerSheet(products: _products),
    );
    if (picked == null) return;
    setState(() => _lines.add(_Line(picked, 1, num0(picked['purchase_price'] ?? picked['cost_price']), 0)));
  }

  Future<void> _save() async {
    final paid = double.tryParse(_paid.text.trim()) ?? 0;
    if (_supplierId == null) return bizToast(context, 'Choose a supplier', ok: false);
    if (_lines.isEmpty) return bizToast(context, 'Add at least one product', ok: false);
    if (_lines.any((l) => l.qty <= 0 || l.rate < 0)) return bizToast(context, 'Each line needs a quantity above 0 and a rate', ok: false);
    if (paid < 0 || paid > _total + 0.005) return bizToast(context, 'Paid amount must be between ₹0 and the total', ok: false);
    setState(() => _saving = true);
    try {
      final msg = await _svc.createPurchase(
        supplierId: _supplierId!,
        items: [
          for (final l in _lines) {'productId': l.product['id'], 'quantity': l.qty, 'rate': l.rate, 'taxPercent': l.tax},
        ],
        paid: paid,
        paymentMethod: _method,
        notes: _notes.text.trim(),
        requestId: _requestId,
      );
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
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('New purchase'),
      bottomNavigationBar: _loading || _error != null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: bizPrimaryButton(label: _saving ? 'Saving…' : 'Save purchase · ${inr(_total)}', onPressed: _saving ? null : _save),
              ),
            ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? BizState(icon: Icons.cloud_off_rounded, title: 'Could not load', text: _error, action: 'Try again', onAction: _load, error: true)
              : ListView(padding: const EdgeInsets.all(16), children: [
                  DropdownButtonFormField<int>(
                    value: _supplierId,
                    isExpanded: true,
                    decoration: bizInput('Supplier *'),
                    items: [
                      for (final s in _suppliers) DropdownMenuItem(value: (s['id'] as num).toInt(), child: Text('${s['name']}', overflow: TextOverflow.ellipsis)),
                    ],
                    onChanged: (v) => setState(() => _supplierId = v),
                  ),
                  if (_suppliers.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 6),
                      child: Text('Add a supplier first (Suppliers › + Supplier).', style: TextStyle(fontSize: 12, color: AppColors.warning)),
                    ),
                  const SizedBox(height: 16),
                  Row(children: [
                    const Expanded(
                      child: Text('PRODUCTS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textSecondary, letterSpacing: 0.6)),
                    ),
                    TextButton.icon(onPressed: _addLine, icon: const Icon(Icons.add_rounded, size: 18), label: const Text('Add product')),
                  ]),
                  if (_lines.isEmpty) const BizState(icon: Icons.inventory_2_outlined, title: 'No products added'),
                  for (var i = 0; i < _lines.length; i++) _lineCard(i),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(
                      child: TextField(controller: _paid, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: bizInput('Paid now')),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: _method,
                        decoration: bizInput('Method'),
                        items: const [
                          DropdownMenuItem(value: 'cash', child: Text('Cash')),
                          DropdownMenuItem(value: 'upi', child: Text('UPI')),
                          DropdownMenuItem(value: 'bank', child: Text('Bank')),
                          DropdownMenuItem(value: 'credit', child: Text('Credit')),
                        ],
                        onChanged: (v) => setState(() => _method = v ?? 'cash'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 10),
                  TextField(controller: _notes, decoration: bizInput('Notes (bill no., remarks)')),
                ]),
    );
  }

  Widget _lineCard(int i) {
    final l = _lines[i];
    return BizCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('${l.product['name']}', style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis)),
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.textSecondary),
            onPressed: () => setState(() => _lines.removeAt(i)),
          ),
        ]),
        Row(children: [
          Expanded(
            child: TextFormField(
              initialValue: '${l.qty}',
              keyboardType: TextInputType.number,
              decoration: bizInput('Qty'),
              onChanged: (v) => setState(() => l.qty = int.tryParse(v) ?? 0),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextFormField(
              initialValue: l.rate.toStringAsFixed(2),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: bizInput('Rate ₹'),
              onChanged: (v) => setState(() => l.rate = double.tryParse(v) ?? -1),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextFormField(
              initialValue: '0',
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: bizInput('GST %'),
              onChanged: (v) => setState(() => l.tax = double.tryParse(v) ?? 0),
            ),
          ),
        ]),
        Align(alignment: Alignment.centerRight, child: Padding(padding: const EdgeInsets.only(top: 6), child: Text(inr(l.total), style: const TextStyle(fontWeight: FontWeight.w800)))),
      ]),
    );
  }
}

/// Searchable product list that returns the chosen product (with its real id).
class ProductPickerSheet extends StatefulWidget {
  final List<Map<String, dynamic>> products;
  const ProductPickerSheet({super.key, required this.products});

  @override
  State<ProductPickerSheet> createState() => _ProductPickerSheetState();
}

class _ProductPickerSheetState extends State<ProductPickerSheet> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final list = widget.products.where((p) => '${p['name']} ${p['sku'] ?? ''}'.toLowerCase().contains(_q)).take(80).toList();
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.8,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(autofocus: true, onChanged: (v) => setState(() => _q = v.toLowerCase()), decoration: bizInput('Search product or SKU', icon: Icons.search_rounded)),
          ),
          Expanded(
            child: list.isEmpty
                ? const BizState(icon: Icons.search_off_rounded, title: 'No matching products')
                : ListView.builder(
                    itemCount: list.length,
                    itemBuilder: (_, i) {
                      final p = list[i];
                      final stock = p['current_stock'] ?? p['stock'] ?? 0;
                      return ListTile(
                        title: Text('${p['name']}', overflow: TextOverflow.ellipsis),
                        subtitle: Text('${p['sku'] ?? ''} · Stock $stock'),
                        trailing: Text(inr(p['purchase_price'] ?? p['selling_price'])),
                        onTap: () => Navigator.pop(context, p),
                      );
                    },
                  ),
          ),
        ]),
      ),
    );
  }
}
