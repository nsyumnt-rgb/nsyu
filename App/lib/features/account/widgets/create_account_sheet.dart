import 'package:flutter/material.dart';
import '../../../services/customer_portal_service.dart';

class CreateAccountSheetHelper {
  static void show(
    BuildContext context, {
    required bool isCustomerMode,
    required Function(String phone) onAccountCreated,
  }) {
    if (!isCustomerMode) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text(
            'Store & Staff Registration',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
          ),
          content: const Text(
            'New shop owner or employee accounts are provisioned by the system administrator.\n\nPlease contact nsyu.mnt@gmail.com to create your shop account.',
            style: TextStyle(fontSize: 13, color: Color(0xFF475569), height: 1.4),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _CustomerRegisterSheet(onAccountCreated: onAccountCreated),
    );
  }
}

class _CustomerRegisterSheet extends StatefulWidget {
  final Function(String phone) onAccountCreated;

  const _CustomerRegisterSheet({required this.onAccountCreated});

  @override
  State<_CustomerRegisterSheet> createState() => _CustomerRegisterSheetState();
}

class _CustomerRegisterSheetState extends State<_CustomerRegisterSheet> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _shopCodeCtrl;

  bool _registering = false;
  String? _regErr;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController();
    _phoneCtrl = TextEditingController();
    _emailCtrl = TextEditingController();
    _shopCodeCtrl = TextEditingController(text: 'NSYU-01');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _shopCodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    final email = _emailCtrl.text.trim();
    final shopCode = _shopCodeCtrl.text.trim();

    if (name.isEmpty || phone.isEmpty || email.isEmpty) {
      setState(() => _regErr = 'Please fill all required fields.');
      return;
    }

    setState(() {
      _registering = true;
      _regErr = null;
    });

    try {
      await CustomerPortalService().register(
        shopCode: shopCode.isNotEmpty ? shopCode : 'NSYU-01',
        name: name,
        phone: phone,
        email: email,
      );

      if (!mounted) return;

      Navigator.pop(context);
      widget.onAccountCreated(phone);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _registering = false;
        _regErr = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.person_add_alt_1_outlined,
                    color: Color(0xFF1D4ED8),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'Create Customer Account',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: 'Full Name *',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'Mobile Number *',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                labelText: 'Email Address (for login OTP) *',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _shopCodeCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText: 'Shop Code',
                hintText: 'e.g. NSYU-01',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
            if (_regErr != null) ...[
              const SizedBox(height: 10),
              Text(_regErr!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
            ],
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _registering ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _registering
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Text(
                      'Register Account',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
