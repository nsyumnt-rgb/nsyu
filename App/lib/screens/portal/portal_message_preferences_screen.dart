import 'package:flutter/material.dart';

import '../../services/messaging_service.dart';
import '../../theme/app_theme.dart';

/// Customer chooses how the shop may contact them: WhatsApp, email, both or neither.
class PortalMessagePreferencesScreen extends StatefulWidget {
  const PortalMessagePreferencesScreen({super.key});

  @override
  State<PortalMessagePreferencesScreen> createState() => _PortalMessagePreferencesScreenState();
}

class _PortalMessagePreferencesScreenState extends State<PortalMessagePreferencesScreen> {
  final _svc = MessagingService();
  Map<String, dynamic>? _p;
  String? _error;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _svc.myPreferences().then((p) {
      if (mounted) setState(() => _p = p);
    }).catchError((e) {
      if (mounted) setState(() => _error = e.toString());
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final p = await _svc.saveMyPreferences({
        'allowWhatsapp': _p!['allowWhatsapp'],
        'allowEmail': _p!['allowEmail'],
        'promoWhatsapp': _p!['promoWhatsapp'],
        'promoEmail': _p!['promoEmail'],
      });
      if (!mounted) return;
      setState(() => _p = p);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Preferences saved'), backgroundColor: AppColors.emerald));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: AppColors.danger));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _toggle(String key, String title) => SwitchListTile.adaptive(
        value: _p![key] == true,
        onChanged: (v) => setState(() => _p![key] = v),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        activeTrackColor: AppColors.emerald,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14),
      );

  Widget _group(String heading, List<Widget> children) => Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
            child: Text(heading, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textSecondary, letterSpacing: 0.5)),
          ),
          ...children,
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: const Text('Message preferences', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: Colors.white,
        foregroundColor: AppColors.navy900,
        elevation: 0,
      ),
      body: _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, style: const TextStyle(color: AppColors.danger))))
          : _p == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    const Text('Choose how the shop contacts you. You can use WhatsApp, email, both, or neither.',
                        style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    const SizedBox(height: 14),
                    _group('ORDER, BILL & PAYMENT UPDATES', [_toggle('allowWhatsapp', 'WhatsApp'), _toggle('allowEmail', 'Email')]),
                    _group('OFFERS & GREETINGS', [_toggle('promoWhatsapp', 'WhatsApp'), _toggle('promoEmail', 'Email')]),
                    const Text('On WhatsApp you can also reply STOP to stop offers, or START to get them again.',
                        style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                    const SizedBox(height: 18),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.emerald,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: _saving ? null : _save,
                        child: Text(_saving ? 'Saving…' : 'Save preferences'),
                      ),
                    ),
                  ],
                ),
    );
  }
}
