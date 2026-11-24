import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../services/business_service.dart';
import '../../theme/app_theme.dart';
import 'business_ui.dart';
import 'purchases_screen.dart';

/// Suppliers (the same supplier records as the website), with dues and purchase history.
class SuppliersScreen extends StatefulWidget {
  const SuppliersScreen({super.key});

  @override
  State<SuppliersScreen> createState() => _SuppliersScreenState();
}

class _SuppliersScreenState extends State<SuppliersScreen> {
  final _svc = BusinessService();
  Future<List<Map<String, dynamic>>>? _future;
  String _q = '';

  @override
  void initState() {
    super.initState();
    _future = _svc.suppliers();
  }

  Future<void> _reload() async {
    final f = _svc.suppliers();
    setState(() => _future = f);
    await f.catchError((_) => <Map<String, dynamic>>[]);
  }

  Future<void> _openForm([Map<String, dynamic>? s]) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SupplierForm(supplier: s),
    );
    if (saved == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('Suppliers', actions: [
        IconButton(
          tooltip: 'Purchases',
          icon: const Icon(Icons.receipt_long_rounded),
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PurchasesScreen())),
        ),
      ]),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.emerald,
        foregroundColor: Colors.white,
        onPressed: () => _openForm(),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Supplier'),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(onChanged: (v) => setState(() => _q = v.toLowerCase()), decoration: bizInput('Search name or phone', icon: Icons.search_rounded)),
        ),
        Expanded(
          child: BizListBody<Map<String, dynamic>>(
            future: _future,
            onRefresh: _reload,
            empty: BizState(icon: Icons.local_shipping_rounded, title: 'No suppliers yet', text: 'Add the people you buy stock from.', action: 'Add supplier', onAction: () => _openForm()),
            builder: (items) {
              final list = items.where((s) => '${s['name']} ${s['phone'] ?? ''}'.toLowerCase().contains(_q)).toList();
              final totalDue = list.fold<double>(0, (a, s) => a + num0(s['current_balance']));
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                children: [
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF064E3B), Color(0xFF047857)]),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Text('You owe suppliers', style: TextStyle(color: Colors.white70, fontSize: 12)),
                          Text(inr(totalDue), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22)),
                        ]),
                      ),
                      Text('${list.length} suppliers', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    ]),
                  ),
                  for (final s in list)
                    BizCard(
                      onTap: () async {
                        await Navigator.push(context, MaterialPageRoute(builder: (_) => SupplierDetailScreen(supplierId: (s['id'] as num).toInt())));
                        _reload();
                      },
                      child: Row(children: [
                        CircleAvatar(
                          backgroundColor: const Color(0xFFF5F3FF),
                          child: Text('${s['name']}'.isEmpty ? '?' : '${s['name']}'[0].toUpperCase(),
                              style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF7C3AED))),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${s['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5), overflow: TextOverflow.ellipsis),
                            Text(s['phone']?.toString() ?? 'No phone', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          ]),
                        ),
                        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text(inr(s['current_balance']),
                              style: TextStyle(fontWeight: FontWeight.w800, color: num0(s['current_balance']) > 0 ? AppColors.danger : AppColors.success)),
                          if (s['status'] == 'inactive') const BizPill('Inactive'),
                        ]),
                      ]),
                    ),
                ],
              );
            },
          ),
        ),
      ]),
    );
  }
}

class SupplierForm extends StatefulWidget {
  final Map<String, dynamic>? supplier;
  const SupplierForm({super.key, this.supplier});

  @override
  State<SupplierForm> createState() => _SupplierFormState();
}

class _SupplierFormState extends State<SupplierForm> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.supplier?['name']?.toString() ?? '');
  late final _phone = TextEditingController(text: widget.supplier?['phone']?.toString() ?? '');
  late final _email = TextEditingController(text: widget.supplier?['email']?.toString() ?? '');
  late final _gstin = TextEditingController(text: widget.supplier?['gstin']?.toString() ?? '');
  late final _address = TextEditingController(text: widget.supplier?['address']?.toString() ?? '');
  final _opening = TextEditingController();
  bool _saving = false;

  bool get _isNew => widget.supplier == null;

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await BusinessService().saveSupplier({
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        'email': _email.text.trim(),
        'gstin': _gstin.text.trim(),
        'address': _address.text.trim(),
        if (_isNew && _opening.text.trim().isNotEmpty) 'openingBalance': double.tryParse(_opening.text.trim()) ?? 0,
      }, id: _isNew ? null : (widget.supplier!['id'] as num).toInt());
      if (!mounted) return;
      bizToast(context, _isNew ? 'Supplier added' : 'Supplier updated');
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
        child: Form(
          key: _form,
          child: SingleChildScrollView(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Center(child: Container(width: 42, height: 4.5, decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(3)))),
              const SizedBox(height: 12),
              Text(_isNew ? 'New supplier' : 'Edit supplier', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navy900)),
              const SizedBox(height: 14),
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: bizInput('Name *'),
                validator: (v) => (v ?? '').trim().isEmpty ? 'Name is required' : null,
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: bizInput('Phone'),
                validator: (v) {
                  final d = (v ?? '').replaceAll(RegExp(r'\D'), '');
                  return d.isNotEmpty && d.length < 10 ? 'Enter a 10-digit number' : null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: bizInput('Email'),
                validator: (v) => (v ?? '').isNotEmpty && !RegExp(r'^\S+@\S+\.\S+$').hasMatch(v!.trim()) ? 'Email is not valid' : null,
              ),
              const SizedBox(height: 10),
              TextFormField(controller: _gstin, textCapitalization: TextCapitalization.characters, decoration: bizInput('GSTIN')),
              const SizedBox(height: 10),
              TextFormField(controller: _address, maxLines: 2, decoration: bizInput('Address')),
              if (_isNew) ...[
                const SizedBox(height: 10),
                TextFormField(
                  controller: _opening,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: bizInput('Opening balance (you owe)', hint: '0'),
                ),
              ],
              const SizedBox(height: 16),
              bizPrimaryButton(label: _saving ? 'Saving…' : 'Save supplier', onPressed: _saving ? null : _save),
            ]),
          ),
        ),
      ),
    );
  }
}

class SupplierDetailScreen extends StatefulWidget {
  final int supplierId;
  const SupplierDetailScreen({super.key, required this.supplierId});

  @override
  State<SupplierDetailScreen> createState() => _SupplierDetailScreenState();
}

class _SupplierDetailScreenState extends State<SupplierDetailScreen> {
  final _svc = BusinessService();
  Map<String, dynamic>? _s;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final s = await _svc.supplier(widget.supplierId);
      if (mounted) setState(() {
        _s = s;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _s;
    final purchases = ((s?['purchases'] as List?) ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar(s?['name']?.toString() ?? 'Supplier', actions: [
        if (s != null)
          IconButton(
            icon: const Icon(Icons.edit_rounded),
            onPressed: () async {
              final saved = await showModalBottomSheet<bool>(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => SupplierForm(supplier: s),
              );
              if (saved == true) _load();
            },
          ),
      ]),
      floatingActionButton: s == null
          ? null
          : FloatingActionButton.extended(
              backgroundColor: AppColors.emerald,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_shopping_cart_rounded),
              label: const Text('New purchase'),
              onPressed: () async {
                await Navigator.push(context, MaterialPageRoute(builder: (_) => NewPurchaseScreen(supplierId: widget.supplierId)));
                _load();
              },
            ),
      body: _error != null
          ? BizState(icon: Icons.cloud_off_rounded, title: 'Could not load', text: _error, action: 'Try again', onAction: _load, error: true)
          : s == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 96), children: [
                    BizCard(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Balance you owe', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        Text(inr(s['current_balance']),
                            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: num0(s['current_balance']) > 0 ? AppColors.danger : AppColors.success)),
                        const Divider(height: 22),
                        if ((s['phone'] ?? '').toString().isNotEmpty)
                          _row(Icons.phone_rounded, s['phone'].toString(), onTap: () => launchUrl(Uri.parse('tel:${s['phone']}'))),
                        if ((s['email'] ?? '').toString().isNotEmpty) _row(Icons.mail_rounded, s['email'].toString()),
                        if ((s['gstin'] ?? '').toString().isNotEmpty) _row(Icons.badge_rounded, 'GSTIN ${s['gstin']}'),
                        if ((s['address'] ?? '').toString().isNotEmpty) _row(Icons.place_rounded, s['address'].toString()),
                      ]),
                    ),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(4, 8, 4, 8),
                      child: Text('PURCHASES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textSecondary, letterSpacing: 0.6)),
                    ),
                    if (purchases.isEmpty) const BizState(icon: Icons.receipt_long_rounded, title: 'No purchases yet'),
                    for (final p in purchases) PurchaseTile(p: p, onChanged: _load),
                  ]),
                ),
    );
  }

  Widget _row(IconData icon, String text, {VoidCallback? onTap}) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(children: [
            Icon(icon, size: 16, color: AppColors.textSecondary),
            const SizedBox(width: 8),
            Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
          ]),
        ),
      );
}
