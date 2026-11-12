import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../providers/auth_provider.dart';
import '../../../services/customer_portal_service.dart';

class CustomerOtpDialog extends StatefulWidget {
  final String identifier;
  final String? maskedEmail;
  final String? initialOtp;
  final String? message;

  const CustomerOtpDialog({
    super.key,
    required this.identifier,
    this.maskedEmail,
    this.initialOtp,
    this.message,
  });

  static Future<bool?> show(
    BuildContext context, {
    required String identifier,
    String? maskedEmail,
    String? initialOtp,
    String? message,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => CustomerOtpDialog(
        identifier: identifier,
        maskedEmail: maskedEmail,
        initialOtp: initialOtp,
        message: message,
      ),
    );
  }

  @override
  State<CustomerOtpDialog> createState() => _CustomerOtpDialogState();
}

class _CustomerOtpDialogState extends State<CustomerOtpDialog> {
  late final TextEditingController _otpCtrl;
  bool _verifying = false;
  bool _resending = false;
  String? _dialogErr;
  String? _infoMessage;
  String? _maskedEmail;

  @override
  void initState() {
    super.initState();
    _otpCtrl = TextEditingController(text: widget.initialOtp ?? '');
    _infoMessage = widget.message;
    _maskedEmail = widget.maskedEmail;
  }

  @override
  void dispose() {
    _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _resendOtp() async {
    setState(() {
      _resending = true;
      _dialogErr = null;
    });

    try {
      final res = await CustomerPortalService().requestOtp(identifier: widget.identifier);
      final code = res['verificationCode']?.toString() ?? res['otp']?.toString();
      final msg = res['message']?.toString();
      final masked = res['maskedEmail']?.toString();

      if (!mounted) return;
      setState(() {
        _resending = false;
        if (masked != null) _maskedEmail = masked;
        if (msg != null) _infoMessage = msg;
        if (code != null && code.isNotEmpty) {
          _otpCtrl.text = code;
        }
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _resending = false;
        _dialogErr = err.toString().replaceAll('Exception: ', '');
      });
    }
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

    final auth = context.read<AuthProvider>();
    final success = await auth.loginAsCustomer(
      identifier: widget.identifier,
      otp: otp,
    );

    if (!mounted) return;

    if (success) {
      Navigator.pop(context, true);
    } else {
      setState(() {
        _verifying = false;
        _dialogErr = auth.lastError ?? 'Invalid code. Please try again.';
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
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'A 4-digit verification code was sent to ${_maskedEmail ?? widget.identifier}.',
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
            ),
            if (_infoMessage != null && _infoMessage!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, size: 16, color: Color(0xFF15803D)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _infoMessage!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF15803D),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
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
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  "Didn't receive code? ",
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                TextButton(
                  onPressed: _resending ? null : _resendOtp,
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(50, 30),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: _resending
                      ? const SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(strokeWidth: 1.8),
                        )
                      : const Text(
                          'Resend Code',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1D4ED8),
                          ),
                        ),
                ),
              ],
            ),
            if (_dialogErr != null) ...[
              const SizedBox(height: 8),
              Text(
                _dialogErr!,
                style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
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
