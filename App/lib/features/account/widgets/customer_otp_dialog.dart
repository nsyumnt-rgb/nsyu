import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/auth_provider.dart';

class CustomerOtpDialog extends StatefulWidget {
  final String identifier;
  final String? maskedEmail;

  const CustomerOtpDialog({
    super.key,
    required this.identifier,
    this.maskedEmail,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String identifier,
    String? maskedEmail,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => CustomerOtpDialog(
        identifier: identifier,
        maskedEmail: maskedEmail,
      ),
    );
  }

  @override
  State<CustomerOtpDialog> createState() => _CustomerOtpDialogState();
}

class _CustomerOtpDialogState extends State<CustomerOtpDialog> {
  late final TextEditingController _otpCtrl;
  bool _verifying = false;
  String? _dialogErr;

  @override
  void initState() {
    super.initState();
    _otpCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _verifyOtp() async {
    final otp = _otpCtrl.text.trim();
    if (otp.length != 4) {
      setState(() => _dialogErr = 'Please enter the 4-digit code.');
      return;
    }

    setState(() {
      _verifying = true;
      _dialogErr = null;
    });

    final success = await context.read<AuthProvider>().loginAsCustomer(
          identifier: widget.identifier,
          otp: otp,
        );

    if (!mounted) return;

    if (success) {
      Navigator.pop(context, true);
    } else {
      setState(() {
        _verifying = false;
        _dialogErr = 'Invalid code. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.mark_email_read_outlined,
              color: Color(0xFF1D4ED8),
              size: 22,
            ),
          ),
          const SizedBox(width: 10),
          const Text(
            'Enter 4-Digit Code',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'A 4-digit verification code was sent to ${widget.maskedEmail ?? widget.identifier}.',
            style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: TextField(
              controller: _otpCtrl,
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              maxLength: 4,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                letterSpacing: 14,
              ),
              decoration: const InputDecoration(
                hintText: '••••',
                counterText: '',
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
          ),
          if (_dialogErr != null) ...[
            const SizedBox(height: 8),
            Text(
              _dialogErr!,
              style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _verifying ? null : _verifyOtp,
          child: _verifying
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Verify & Login'),
        ),
      ],
    );
  }
}
