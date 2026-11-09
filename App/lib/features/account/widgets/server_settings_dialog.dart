import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../config/supabase_config.dart';

class ServerSettingsDialog extends StatefulWidget {
  final VoidCallback onSaved;

  const ServerSettingsDialog({super.key, required this.onSaved});

  static Future<void> show(BuildContext context, {required VoidCallback onSaved}) {
    return showDialog(
      context: context,
      builder: (ctx) => ServerSettingsDialog(onSaved: onSaved),
    );
  }

  @override
  State<ServerSettingsDialog> createState() => _ServerSettingsDialogState();
}

class _ServerSettingsDialogState extends State<ServerSettingsDialog> {
  late final TextEditingController _urlCtrl;
  late final TextEditingController _supabaseUrlCtrl;
  late final TextEditingController _anonKeyCtrl;

  bool _testing = false;
  String? _testResult;
  bool? _testSuccess;

  @override
  void initState() {
    super.initState();
    _urlCtrl = TextEditingController(text: SupabaseConfig.apiUrl);
    _supabaseUrlCtrl = TextEditingController(text: SupabaseConfig.supabaseUrl);
    _anonKeyCtrl = TextEditingController(text: SupabaseConfig.publishableKey);
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _supabaseUrlCtrl.dispose();
    _anonKeyCtrl.dispose();
    super.dispose();
  }

  Future<void> _testConnection() async {
    setState(() {
      _testing = true;
      _testResult = null;
    });

    try {
      final uri = Uri.parse('${_urlCtrl.text.trim()}/health');
      final res = await http.get(uri).timeout(const Duration(seconds: 12));
      if (!mounted) return;

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        String clientMsg = '';
        if (_anonKeyCtrl.text.trim().isNotEmpty) {
          clientMsg = '\n• Publishable key configured';
        }
        setState(() {
          _testing = false;
          _testSuccess = true;
          _testResult =
              '✅ Connected: ${data['database'] ?? 'Supabase'} (${data['status'] ?? 'OK'})$clientMsg';
        });
      } else {
        setState(() {
          _testing = false;
          _testSuccess = false;
          _testResult = 'HTTP ${res.statusCode}: ${res.body}';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _testing = false;
        _testSuccess = false;
        _testResult = 'Failed: $e';
      });
    }
  }

  Future<void> _saveConfig() async {
    final newUrl = _urlCtrl.text.trim();
    final newSupabaseUrl = _supabaseUrlCtrl.text.trim();
    final newKey = _anonKeyCtrl.text.trim();

    await SupabaseConfig.updateConfig(
      apiUrl: newUrl,
      supabaseUrl: newSupabaseUrl,
      publishableKey: newKey,
    );

    if (mounted) {
      Navigator.pop(context);
      widget.onSaved();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Row(
        children: [
          Icon(Icons.dns_rounded, color: Color(0xFF1D4ED8)),
          SizedBox(width: 8),
          Text(
            'Server & Supabase',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'Configure your API server and Supabase credentials. Changes persist locally.',
                style: TextStyle(fontSize: 12, color: Color(0xFF475569)),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Backend API URL',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _urlCtrl,
              style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
              decoration: InputDecoration(
                hintText: 'https://...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Supabase URL',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _supabaseUrlCtrl,
              style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
              decoration: InputDecoration(
                hintText: 'https://xxx.supabase.co',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Publishable / Anon Key',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            TextField(
              controller: _anonKeyCtrl,
              style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
              decoration: InputDecoration(
                hintText: 'sb_publishable_...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              ),
            ),
            if (_testResult != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: _testSuccess == true ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: _testSuccess == true ? const Color(0xFFA7F3D0) : const Color(0xFFFECACA),
                  ),
                ),
                child: Text(
                  _testResult!,
                  style: TextStyle(
                    fontSize: 11.5,
                    color: _testSuccess == true ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        OutlinedButton(
          onPressed: _testing ? null : _testConnection,
          child: _testing
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Test Connection'),
        ),
        FilledButton(
          onPressed: _saveConfig,
          child: const Text('Save'),
        ),
      ],
    );
  }
}
