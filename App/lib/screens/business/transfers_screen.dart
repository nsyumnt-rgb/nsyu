import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../config/supabase_config.dart';
import '../../services/business_service.dart';
import '../../theme/app_theme.dart';
import 'business_ui.dart';
import 'purchases_screen.dart';

const _statusLabel = {
  'pending': 'Pending',
  'in_transit': 'In transit',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
};

Color _statusColor(String s) => switch (s) {
      'pending' => AppColors.warning,
      'in_transit' => AppColors.blue600,
      'completed' => AppColors.success,
      _ => AppColors.textSecondary,
    };

List<Map<String, dynamic>> _itemsOf(Map<String, dynamic> t) {
  final items = t['items'];
  if (items is List && items.isNotEmpty) return items.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  final p = t['product'] as Map?;
  return p == null ? [] : [{'productName': p['name'], 'quantity': t['quantity'] ?? 0}];
}

String _when(dynamic v) {
  final d = DateTime.tryParse('${v ?? ''}');
  return d == null ? '' : DateFormat('d MMM, h:mm a').format(d.toLocal());
}

/// Move stock between the owner's shops (website: Settings › Inventory › Stock Transfers).
class TransfersScreen extends StatefulWidget {
  const TransfersScreen({super.key});

  @override
  State<TransfersScreen> createState() => _TransfersScreenState();
}

class _TransfersScreenState extends State<TransfersScreen> {
  final _svc = BusinessService();
  String _status = 'all';
  final List<Map<String, dynamic>> _items = [];
  Map<String, dynamic> _metrics = {};
  int _page = 1;
  int _pages = 1;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  List<Map<String, dynamic>> _shops = [];

  @override
  void initState() {
    super.initState();
    _load();
    _svc.shops().then((s) {
      if (mounted) setState(() => _shops = s.where((x) => x['status'] != 'inactive').toList());
    }).catchError((_) {});
  }

  Future<void> _load({bool more = false}) async {
    setState(() {
      if (more) {
        _loadingMore = true;
      } else {
        _loading = true;
        _error = null;
      }
    });
    try {
      final page = more ? _page + 1 : 1;
      final d = await _svc.transfers(status: _status, page: page);
      final list = ((d['transfers'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      if (!mounted) return;
      setState(() {
        if (!more) _items.clear();
        _items.addAll(list);
        _page = page;
        _pages = (d['totalPages'] as num?)?.toInt() ?? 1;
        _metrics = Map<String, dynamic>.from((d['metrics'] as Map?) ?? {});
      });
    } catch (e) {
      if (mounted && !more) setState(() => _error = '$e');
      if (mounted && more) bizToast(context, '$e', ok: false);
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _new() async {
    if (_shops.length < 2) {
      return bizToast(context, 'You need at least two shops to transfer stock', ok: false);
    }
    final saved = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => NewTransferScreen(shops: _shops)));
    if (saved == true) _load();
  }

  Future<void> _open(Map<String, dynamic> t) async {
    final changed = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => TransferDetailScreen(id: (t['id'] as num).toInt())));
    if (changed == true) _load();
  }

  Widget _metric(String label, dynamic v, Color c) => Expanded(
        child: BizCard(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          child: Column(children: [
            Text('${v ?? '—'}', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: c)),
            Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary), textAlign: TextAlign.center),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('Stock transfers'),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.emerald,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.swap_horiz_rounded),
        label: const Text('New transfer'),
        onPressed: _new,
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            Row(children: [
              _metric('Transfers', _metrics['totalTransfers'], AppColors.navy900),
              const SizedBox(width: 6),
              _metric('Pending', _metrics['pendingTransfers'], AppColors.warning),
              const SizedBox(width: 6),
              _metric('Completed', _metrics['completedTransfers'], AppColors.success),
            ]),
            const SizedBox(height: 6),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                for (final s in ['all', 'pending', 'in_transit', 'completed', 'cancelled'])
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(s == 'all' ? 'All' : _statusLabel[s]!),
                      selected: _status == s,
                      selectedColor: AppColors.blue100,
                      onSelected: (_) {
                        setState(() => _status = s);
                        _load();
                      },
                    ),
                  ),
              ]),
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              BizState(icon: Icons.cloud_off_rounded, title: 'Could not load transfers', text: _error, error: true, action: 'Try again', onAction: _load)
            else if (_items.isEmpty)
              BizState(
                icon: Icons.swap_horiz_rounded,
                title: 'No transfers',
                text: _status == 'all' ? 'Stock you move between shops shows up here.' : 'Nothing with this status.',
                action: _shops.length >= 2 ? 'New transfer' : null,
                onAction: _shops.length >= 2 ? _new : null,
              )
            else ...[
              for (final t in _items) _TransferTile(t: t, onTap: () => _open(t)),
              if (_page < _pages)
                Center(
                  child: TextButton(
                    onPressed: _loadingMore ? null : () => _load(more: true),
                    child: Text(_loadingMore ? 'Loading…' : 'Load more'),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TransferTile extends StatelessWidget {
  final Map<String, dynamic> t;
  final VoidCallback onTap;
  const _TransferTile({required this.t, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final status = '${t['status'] ?? 'completed'}';
    final items = _itemsOf(t);
    final units = items.fold<int>(0, (s, i) => s + num0(i['quantity']).toInt());
    return BizCard(
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('${t['transfer_no'] ?? '#${t['id']}'}', style: const TextStyle(fontWeight: FontWeight.w800))),
          BizPill(_statusLabel[status] ?? status, color: _statusColor(status)),
        ]),
        const SizedBox(height: 4),
        Row(children: [
          Flexible(child: Text('${(t['fromShop'] as Map?)?['name'] ?? 'Shop ${t['from_shop_id']}'}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 6), child: Icon(Icons.arrow_forward_rounded, size: 15, color: AppColors.textSecondary)),
          Flexible(child: Text('${(t['toShop'] as Map?)?['name'] ?? 'Shop ${t['to_shop_id']}'}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
        ]),
        const SizedBox(height: 2),
        Text(
          '$units unit${units == 1 ? '' : 's'} · ${items.map((i) => '${i['productName']} × ${i['quantity']}').join(', ')} · ${_when(t['created_at'] ?? t['createdAt'])}',
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
      ]),
    );
  }
}

class TransferDetailScreen extends StatefulWidget {
  final int id;
  const TransferDetailScreen({super.key, required this.id});

  @override
  State<TransferDetailScreen> createState() => _TransferDetailScreenState();
}

class _TransferDetailScreenState extends State<TransferDetailScreen> {
  final _svc = BusinessService();
  Map<String, dynamic>? _t;
  String? _error;
  bool _busy = false;
  bool _changed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final t = await _svc.transfer(widget.id);
      if (mounted) setState(() => _t = t);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  Future<void> _run(Future<String> Function() action) async {
    setState(() => _busy = true);
    try {
      final msg = await action();
      if (!mounted) return;
      bizToast(context, msg);
      _changed = true;
      await _load();
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final t = _t!;
    final reason = TextEditingController();
    final from = (t['fromShop'] as Map?)?['name'] ?? 'the source shop';
    final to = (t['toShop'] as Map?)?['name'] ?? 'the destination shop';
    final effect = switch ('${t['status']}') {
      'completed' => 'The stock goes back: it is taken out of $to and returned to $from.',
      'in_transit' => 'The stock already taken out of $from is put back.',
      _ => 'No stock has moved yet, so nothing changes in either shop.',
    };
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: Text('Cancel ${t['transfer_no'] ?? 'transfer'}?'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(effect, style: const TextStyle(fontSize: 13.5)),
          const SizedBox(height: 12),
          TextField(controller: reason, maxLength: 200, decoration: bizInput('Reason (optional)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep it')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: AppColors.danger), onPressed: () => Navigator.pop(ctx, true), child: const Text('Cancel transfer')),
        ],
      ),
    );
    if (ok == true) await _run(() => _svc.cancelTransfer(widget.id, reason.text.trim()));
    reason.dispose();
  }

  Widget _row(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 92, child: Text(k, style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary))),
          Expanded(child: Text(v, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final t = _t;
    final status = '${t?['status'] ?? ''}';
    final myShop = SupabaseConfig.shopId;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.pop(context, _changed);
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: bizAppBar('${t?['transfer_no'] ?? 'Transfer'}'),
        bottomNavigationBar: t == null || status == 'cancelled'
            ? null
            : SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                  child: Row(children: [
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger, padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                        onPressed: _busy ? null : _cancel,
                        child: const Text('Cancel'),
                      ),
                    ),
                    if (status == 'pending') ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                          onPressed: _busy ? null : () => _run(() => _svc.dispatchTransfer(widget.id)),
                          icon: const Icon(Icons.local_shipping_outlined, size: 18),
                          label: const Text('Dispatch'),
                        ),
                      ),
                    ],
                    if (status == 'pending' || status == 'in_transit') ...[
                      const SizedBox(width: 8),
                      Expanded(child: bizPrimaryButton(label: 'Receive', icon: Icons.check_rounded, onPressed: _busy ? null : () => _run(() => _svc.receiveTransfer(widget.id)))),
                    ],
                  ]),
                ),
              ),
        body: _error != null
            ? BizState(icon: Icons.cloud_off_rounded, title: 'Could not load', text: _error, error: true)
            : t == null
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      BizCard(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(child: Text('${t['transfer_no'] ?? '#${t['id']}'}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16))),
                            BizPill(_statusLabel[status] ?? status, color: _statusColor(status)),
                          ]),
                          const Divider(height: 20),
                          _row('From', '${(t['fromShop'] as Map?)?['name'] ?? t['from_shop_id']}${t['from_shop_id'] == myShop ? ' (this shop)' : ''}'),
                          _row('To', '${(t['toShop'] as Map?)?['name'] ?? t['to_shop_id']}${t['to_shop_id'] == myShop ? ' (this shop)' : ''}'),
                          _row('Created', _when(t['created_at'] ?? t['createdAt'])),
                          if (t['received_at'] != null) _row('Received', _when(t['received_at'])),
                          if (t['cancelled_at'] != null) _row('Cancelled', _when(t['cancelled_at'])),
                          if ((t['cancellation_reason'] ?? '').toString().isNotEmpty) _row('Reason', '${t['cancellation_reason']}'),
                          if ((t['notes'] ?? '').toString().isNotEmpty) _row('Note', '${t['notes']}'),
                        ]),
                      ),
                      const Padding(padding: EdgeInsets.fromLTRB(4, 8, 4, 6), child: Text('PRODUCTS', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: AppColors.textSecondary))),
                      for (final i in _itemsOf(t))
                        BizCard(
                          child: Row(children: [
                            Expanded(child: Text('${i['productName']}', style: const TextStyle(fontWeight: FontWeight.w600))),
                            Text('× ${i['quantity']}', style: const TextStyle(fontWeight: FontWeight.w900)),
                          ]),
                        ),
                      if ((t['transactions'] as List?)?.isNotEmpty == true) ...[
                        const Padding(padding: EdgeInsets.fromLTRB(4, 8, 4, 6), child: Text('STOCK MOVEMENTS', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: AppColors.textSecondary))),
                        for (final m in (t['transactions'] as List).map((e) => Map<String, dynamic>.from(e as Map)))
                          BizCard(
                            child: Row(children: [
                              Expanded(
                                child: Text(
                                  '${(m['shop'] as Map?)?['name'] ?? 'Shop'} · ${(m['product'] as Map?)?['name'] ?? ''}',
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                              Builder(builder: (_) {
                                final q = num0(m['signed_quantity']).toInt();
                                return Text('${q > 0 ? '+' : ''}$q', style: TextStyle(fontWeight: FontWeight.w900, color: q >= 0 ? AppColors.success : AppColors.danger));
                              }),
                            ]),
                          ),
                      ],
                    ]),
                  ),
      ),
    );
  }
}

class NewTransferScreen extends StatefulWidget {
  final List<Map<String, dynamic>> shops;
  const NewTransferScreen({super.key, required this.shops});

  @override
  State<NewTransferScreen> createState() => _NewTransferScreenState();
}

class _Line {
  final Map<String, dynamic> product;
  final TextEditingController qty = TextEditingController(text: '1');
  _Line(this.product);
}

class _NewTransferScreenState extends State<NewTransferScreen> {
  final _svc = BusinessService();
  late int _from;
  late int _to;
  String _mode = 'completed';
  final _notes = TextEditingController();
  List<Map<String, dynamic>>? _products;
  String? _productsError;
  final List<_Line> _lines = [];
  bool _saving = false;

  int _id(Map<String, dynamic> m) => (m['id'] as num).toInt();

  @override
  void initState() {
    super.initState();
    final ids = widget.shops.map(_id).toList();
    _from = ids.contains(SupabaseConfig.shopId) ? SupabaseConfig.shopId : ids.first;
    _to = ids.firstWhere((i) => i != _from);
    _loadProducts();
  }

  @override
  void dispose() {
    _notes.dispose();
    for (final l in _lines) {
      l.qty.dispose();
    }
    super.dispose();
  }

  /// Products with stock at the SOURCE shop.
  Future<void> _loadProducts() async {
    setState(() {
      _products = null;
      _productsError = null;
    });
    try {
      final p = await _svc.products(shopId: _from);
      if (!mounted) return;
      setState(() {
        _products = p;
        // keep chosen lines, refreshing their stock figure
        for (var i = 0; i < _lines.length; i++) {
          final fresh = p.where((x) => x['id'] == _lines[i].product['id']);
          if (fresh.isNotEmpty) _lines[i].product.addAll(fresh.first);
        }
      });
    } catch (e) {
      if (mounted) setState(() => _productsError = '$e');
    }
  }

  int _stock(Map<String, dynamic> p) => num0(p['current_stock'] ?? p['stock']).toInt();

  Future<void> _addProduct() async {
    final chosen = _lines.map((l) => l.product['id']).toSet();
    final p = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      builder: (_) => ProductPickerSheet(products: _products!.where((x) => !chosen.contains(x['id'])).toList()),
    );
    if (p != null) setState(() => _lines.add(_Line(Map<String, dynamic>.from(p))));
  }

  Future<void> _save() async {
    if (_from == _to) return bizToast(context, 'Choose two different shops', ok: false);
    if (_lines.isEmpty) return bizToast(context, 'Add at least one product', ok: false);
    final items = <Map<String, int>>[];
    for (final l in _lines) {
      final q = int.tryParse(l.qty.text.trim()) ?? 0;
      if (q <= 0) return bizToast(context, 'Quantity for ${l.product['name']} must be at least 1', ok: false);
      if (_mode != 'pending' && q > _stock(l.product)) {
        return bizToast(context, 'Only ${_stock(l.product)} of ${l.product['name']} in the source shop', ok: false);
      }
      items.add({'productId': _id(l.product), 'quantity': q});
    }
    setState(() => _saving = true);
    try {
      final msg = await _svc.createTransfer(fromShopId: _from, toShopId: _to, items: items, status: _mode, notes: _notes.text.trim());
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
    final shops = widget.shops;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('New transfer'),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
          child: bizPrimaryButton(label: _saving ? 'Saving…' : 'Create transfer', icon: Icons.swap_horiz_rounded, onPressed: _saving || _lines.isEmpty ? null : _save),
        ),
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        DropdownButtonFormField<int>(
          value: _from,
          isExpanded: true,
          decoration: bizInput('From shop', icon: Icons.storefront_outlined),
          items: [for (final s in shops) DropdownMenuItem(value: _id(s), child: Text('${s['name']}', overflow: TextOverflow.ellipsis))],
          onChanged: (v) {
            if (v == null || v == _from) return;
            setState(() {
              _from = v;
              if (_to == v) _to = shops.map(_id).firstWhere((i) => i != v);
            });
            _loadProducts();
          },
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<int>(
          key: ValueKey('to-$_from'),
          value: _to,
          isExpanded: true,
          decoration: bizInput('To shop', icon: Icons.store_mall_directory_outlined),
          items: [for (final s in shops.where((s) => _id(s) != _from)) DropdownMenuItem(value: _id(s), child: Text('${s['name']}', overflow: TextOverflow.ellipsis))],
          onChanged: (v) => setState(() => _to = v ?? _to),
        ),
        const SizedBox(height: 14),
        const Text('When does the stock move?', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'completed', label: Text('Now')),
            ButtonSegment(value: 'in_transit', label: Text('Send now')),
            ButtonSegment(value: 'pending', label: Text('Plan only')),
          ],
          selected: {_mode},
          onSelectionChanged: (s) => setState(() => _mode = s.first),
        ),
        const SizedBox(height: 6),
        Text(
          switch (_mode) {
            'completed' => 'Stock leaves the source and arrives at the destination immediately.',
            'in_transit' => 'Stock leaves the source now. The destination adds it when they press Receive.',
            _ => 'Nothing moves until someone presses Dispatch or Receive.',
          },
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 16),
        Row(children: [
          const Expanded(child: Text('Products', style: TextStyle(fontWeight: FontWeight.w700))),
          TextButton.icon(
            onPressed: _products == null ? null : _addProduct,
            icon: const Icon(Icons.add_rounded),
            label: Text(_products == null ? (_productsError == null ? 'Loading…' : 'Unavailable') : 'Add product'),
          ),
        ]),
        if (_productsError != null) Text(_productsError!, style: const TextStyle(color: AppColors.danger, fontSize: 12.5)),
        if (_lines.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('No products yet. Tap “Add product”.', style: TextStyle(color: AppColors.textSecondary)),
          ),
        for (var i = 0; i < _lines.length; i++)
          BizCard(
            padding: const EdgeInsets.fromLTRB(14, 8, 4, 8),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${_lines[i].product['name']}', style: const TextStyle(fontWeight: FontWeight.w700), overflow: TextOverflow.ellipsis),
                  Text('${_stock(_lines[i].product)} in source shop', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ]),
              ),
              SizedBox(
                width: 74,
                child: TextField(
                  controller: _lines[i].qty,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.right,
                  decoration: bizInput('Qty'),
                ),
              ),
              IconButton(
                tooltip: 'Remove',
                icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                onPressed: () => setState(() => _lines.removeAt(i).qty.dispose()),
              ),
            ]),
          ),
        const SizedBox(height: 12),
        TextField(controller: _notes, maxLength: 250, decoration: bizInput('Note (optional)')),
      ]),
    );
  }
}
