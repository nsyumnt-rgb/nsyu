import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../config/supabase_config.dart';
import '../../providers/auth_provider.dart';
import '../../providers/settings_provider.dart';
import '../../services/business_service.dart';
import '../../theme/app_theme.dart';
import 'business_ui.dart';

/// Invoice numbering, tax, payment and stock rules for the current shop.
/// Same settings as the website's Settings › Invoice / Tax & GST / Payment / Inventory rules.
class ShopSettingsScreen extends StatefulWidget {
  const ShopSettingsScreen({super.key});

  @override
  State<ShopSettingsScreen> createState() => _ShopSettingsScreenState();
}

class _ShopSettingsScreenState extends State<ShopSettingsScreen> {
  final _svc = BusinessService();
  final _form = GlobalKey<FormState>();
  final _prefix = TextEditingController();
  final _gstin = TextEditingController();
  final _gstRate = TextEditingController();
  bool _pricesIncludeTax = false;
  bool _cash = true, _upi = true, _bank = true, _credit = true;
  bool _allowNegative = true;

  bool _loading = true;
  bool _saving = false;
  bool _dirty = false;
  String? _error;

  static final _gstinRe = RegExp(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');

  @override
  void initState() {
    super.initState();
    for (final c in [_prefix, _gstin, _gstRate]) {
      c.addListener(_markDirty);
    }
    _load();
  }

  @override
  void dispose() {
    for (final c in [_prefix, _gstin, _gstRate]) {
      c.dispose();
    }
    super.dispose();
  }

  void _markDirty() {
    if (!_loading && !_dirty) setState(() => _dirty = true);
  }

  bool _b(dynamic v, bool fallback) => v == null ? fallback : v == true || v == 'true';

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final s = await _svc.shopSettings(SupabaseConfig.shopId);
      _prefix.text = '${s['invoicePrefix'] ?? 'INV-'}';
      _gstin.text = '${s['gstin'] ?? ''}';
      _gstRate.text = num0(s['defaultGstRate']).toStringAsFixed(num0(s['defaultGstRate']) % 1 == 0 ? 0 : 2);
      _pricesIncludeTax = _b(s['pricesIncludeTax'], false);
      _cash = _b(s['enableCash'], true);
      _upi = _b(s['enableUpi'], true);
      _bank = _b(s['enableBank'], true);
      _credit = _b(s['enableCredit'], true);
      _allowNegative = _b(s['allowNegativeStock'], true);
      if (mounted) setState(() => _dirty = false);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    if (!_cash && !_upi && !_bank && !_credit) {
      return bizToast(context, 'Keep at least one payment method on', ok: false);
    }
    setState(() => _saving = true);
    try {
      await _svc.saveShopSettings(SupabaseConfig.shopId, {
        'invoicePrefix': _prefix.text.trim(),
        'gstin': _gstin.text.trim().toUpperCase(),
        'defaultGstRate': double.parse(_gstRate.text.trim()),
        'pricesIncludeTax': _pricesIncludeTax,
        'enableCash': _cash,
        'enableUpi': _upi,
        'enableBank': _bank,
        'enableCredit': _credit,
        'allowNegativeStock': _allowNegative,
      });
      if (!mounted) return;
      // Billing screens read these from SettingsProvider
      context.read<SettingsProvider>().syncFromSupabase();
      setState(() => _dirty = false);
      bizToast(context, 'Settings saved');
    } catch (e) {
      if (mounted) bizToast(context, '$e', ok: false);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _section(String title, List<Widget> children) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 6),
            child: Text(title, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 0.6, color: AppColors.textSecondary)),
          ),
          BizCard(padding: const EdgeInsets.fromLTRB(14, 12, 6, 8), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children)),
        ]),
      );

  Widget _switch(String title, String subtitle, bool value, ValueChanged<bool> onChanged) => SwitchListTile(
        contentPadding: const EdgeInsets.only(right: 4),
        dense: true,
        activeThumbColor: AppColors.emerald,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
        value: value,
        onChanged: (v) => setState(() {
          onChanged(v);
          _dirty = true;
        }),
      );

  @override
  Widget build(BuildContext context) {
    final isOwner = context.watch<AuthProvider>().isOwner;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: bizAppBar('Billing & tax settings'),
      bottomNavigationBar: _loading || _error != null || !isOwner
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: bizPrimaryButton(label: _saving ? 'Saving…' : (_dirty ? 'Save settings' : 'Saved'), onPressed: _dirty && !_saving ? _save : null),
              ),
            ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? BizState(icon: Icons.cloud_off_rounded, title: 'Could not load settings', text: _error, error: true, action: 'Try again', onAction: _load)
              : AbsorbPointer(
                  absorbing: !isOwner,
                  child: Form(
                    key: _form,
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      if (!isOwner)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 12),
                          child: Text('Only the shop owner can change these settings.', style: TextStyle(color: AppColors.textSecondary)),
                        ),
                      _section('INVOICE', [
                        TextFormField(
                          controller: _prefix,
                          textCapitalization: TextCapitalization.characters,
                          inputFormatters: [LengthLimitingTextInputFormatter(10)],
                          decoration: bizInput('Invoice number prefix', hint: 'INV-'),
                          validator: (v) => RegExp(r'[A-Za-z0-9]').hasMatch(v ?? '') ? null : 'Use at least one letter or number',
                        ),
                      ]),
                      _section('TAX & GST', [
                        TextFormField(
                          controller: _gstin,
                          textCapitalization: TextCapitalization.characters,
                          inputFormatters: [LengthLimitingTextInputFormatter(15)],
                          decoration: bizInput('GSTIN (optional)', hint: '22AAAAA0000A1Z5'),
                          validator: (v) {
                            final t = (v ?? '').trim().toUpperCase();
                            return t.isEmpty || _gstinRe.hasMatch(t) ? null : 'Enter a valid 15-character GSTIN';
                          },
                        ),
                        const SizedBox(height: 10),
                        TextFormField(
                          controller: _gstRate,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: bizInput('Default GST rate (%)'),
                          validator: (v) {
                            final n = double.tryParse((v ?? '').trim());
                            return n != null && n >= 0 && n <= 28 ? null : 'Enter a rate from 0 to 28';
                          },
                        ),
                        _switch('Prices include GST', 'Selling prices already contain tax', _pricesIncludeTax, (v) => _pricesIncludeTax = v),
                      ]),
                      _section('PAYMENT METHODS', [
                        _switch('Cash', 'Accept cash at billing', _cash, (v) => _cash = v),
                        _switch('UPI', 'Accept UPI payments', _upi, (v) => _upi = v),
                        _switch('Bank transfer / card', 'Accept bank and card payments', _bank, (v) => _bank = v),
                        _switch('Customer credit (udhaar)', 'Allow unpaid or part-paid bills', _credit, (v) => _credit = v),
                      ]),
                      _section('STOCK', [
                        _switch('Sell when stock is 0', 'Allow billing below zero stock', _allowNegative, (v) => _allowNegative = v),
                      ]),
                    ]),
                  ),
                ),
    );
  }
}
