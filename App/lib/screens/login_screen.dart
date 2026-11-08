import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../config/supabase_config.dart';
import '../providers/auth_provider.dart';
import '../services/supabase_service.dart';
import '../services/customer_portal_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _customerPhoneCtrl = TextEditingController();
  final _customerShopCodeCtrl = TextEditingController();
  final _customerOtpCtrl = TextEditingController();

  bool _isCustomerMode = false;
  bool _otpSent = false;
  String? _maskedEmail;
  bool _obscurePassword = true;
  bool _rememberMe = true;
  bool _loading = false;
  String? _error;
  bool _checkingConnection = false;
  bool? _isConnected;
  String _connectionDetails = '';

  @override
  void initState() {
    super.initState();
    _checkBackendHealth();
  }

  Future<void> _checkBackendHealth() async {
    if (!mounted) return;
    setState(() {
      _checkingConnection = true;
    });

    try {
      final health = await SupabaseService().checkHealth();
      if (!mounted) return;
      setState(() {
        _checkingConnection = false;
        _isConnected = health['success'] == true;
        if (_isConnected == true) {
          _connectionDetails = 'Supabase PostgreSQL Connected';
        } else {
          _connectionDetails = health['message']?.toString() ?? 'Unreachable';
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _checkingConnection = false;
        _isConnected = false;
        _connectionDetails = 'Offline';
      });
    }
  }

  void _showServerSettingsDialog() {
    final urlCtrl = TextEditingController(text: SupabaseConfig.apiUrl);
    final supabaseUrlCtrl = TextEditingController(text: SupabaseConfig.supabaseUrl);
    final anonKeyCtrl = TextEditingController(text: SupabaseConfig.publishableKey);
    bool testing = false;
    String? testResult;
    bool? testSuccess;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Row(
              children: [
                Icon(Icons.dns_rounded, color: Color(0xFF1D4ED8)),
                SizedBox(width: 8),
                Text('Server & Supabase', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Backend & Database (Active)',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Cloud Architecture: Supabase PostgreSQL\nService: Node.js / Express API',
                          style: TextStyle(fontSize: 11.5, color: Color(0xFF475569)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'API Base URL',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    controller: urlCtrl,
                    decoration: InputDecoration(
                      hintText: 'https://nsyu-backend-api.onrender.com/api',
                      hintStyle: const TextStyle(fontSize: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    style: const TextStyle(fontSize: 12.5),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      ActionChip(
                        avatar: const Icon(Icons.cloud_done_rounded, size: 14, color: Color(0xFF1D4ED8)),
                        label: const Text('24/7 Cloud (Render)', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8))),
                        onPressed: () => setDialogState(() => urlCtrl.text = 'https://nsyu-backend-api.onrender.com/api'),
                      ),
                      ActionChip(
                        avatar: const Icon(Icons.wifi, size: 14, color: Color(0xFF047857)),
                        label: const Text('WiFi LAN (10.96.203.24:5000)', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
                        onPressed: () => setDialogState(() => urlCtrl.text = 'http://10.96.203.24:5000/api'),
                      ),
                      ActionChip(
                        label: const Text('localhost:5000', style: TextStyle(fontSize: 10.5)),
                        onPressed: () => setDialogState(() => urlCtrl.text = 'http://localhost:5000/api'),
                      ),
                      ActionChip(
                        label: const Text('10.0.2.2:5000 (Android)', style: TextStyle(fontSize: 10.5)),
                        onPressed: () => setDialogState(() => urlCtrl.text = 'http://10.0.2.2:5000/api'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Supabase Project URL',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    controller: supabaseUrlCtrl,
                    decoration: InputDecoration(
                      hintText: 'https://lggjtxzannywecuvwqbl.supabase.co',
                      hintStyle: const TextStyle(fontSize: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    style: const TextStyle(fontSize: 12.5),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Supabase Publishable Key (Anon Key)',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5),
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    controller: anonKeyCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'eyJhbGciOi... (from Supabase Dashboard > Connect)',
                      hintStyle: const TextStyle(fontSize: 11),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                    style: const TextStyle(fontSize: 11),
                  ),
                  if (testResult != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: testSuccess == true ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: testSuccess == true ? const Color(0xFFA7F3D0) : const Color(0xFFFECACA),
                        ),
                      ),
                      child: Text(
                        testResult!,
                        style: TextStyle(
                          fontSize: 11.5,
                          color: testSuccess == true ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              OutlinedButton(
                onPressed: testing
                    ? null
                    : () async {
                        setDialogState(() {
                          testing = true;
                          testResult = null;
                        });
                        try {
                          final uri = Uri.parse('${urlCtrl.text.trim()}/health');
                          final res = await http.get(uri).timeout(const Duration(seconds: 12));
                          if (res.statusCode == 200) {
                            final data = jsonDecode(res.body);
                            String clientMsg = '';
                            if (anonKeyCtrl.text.trim().isNotEmpty) {
                              clientMsg = '\n• Publishable key configured';
                            }
                            setDialogState(() {
                              testing = false;
                              testSuccess = true;
                              testResult = '✅ Connected: ${data['database'] ?? 'Supabase'} (${data['status'] ?? 'OK'})$clientMsg';
                            });
                          } else {
                            setDialogState(() {
                              testing = false;
                              testSuccess = false;
                              testResult = 'HTTP ${res.statusCode}: ${res.body}';
                            });
                          }
                        } catch (e) {
                          setDialogState(() {
                            testing = false;
                            testSuccess = false;
                            testResult = 'Failed: $e';
                          });
                        }
                      },
                child: testing
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Test Connection'),
              ),
              FilledButton(
                onPressed: () async {
                  final newUrl = urlCtrl.text.trim();
                  final newSupabaseUrl = supabaseUrlCtrl.text.trim();
                  final newKey = anonKeyCtrl.text.trim();
                  await SupabaseConfig.updateConfig(
                    apiUrl: newUrl,
                    supabaseUrl: newSupabaseUrl,
                    publishableKey: newKey,
                  );
                  if (context.mounted) {
                    Navigator.pop(ctx);
                    _checkBackendHealth();
                  }
                },
                child: const Text('Save'),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    _customerPhoneCtrl.dispose();
    _customerShopCodeCtrl.dispose();
    _customerOtpCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final auth = context.read<AuthProvider>();
    final identifier = _identifierCtrl.text.trim();
    final password = _passwordCtrl.text.trim();

    if (identifier.isEmpty) {
      setState(() {
        _error = 'Please enter your email or username.';
      });
      return;
    }

    if (password.isEmpty) {
      setState(() {
        _error = 'Please enter your password.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    final success = await auth.login(identifier, password);

    if (!mounted) return;

    setState(() {
      _loading = false;
      if (!success) {
        _error = 'Invalid credentials. Please verify your details.';
      }
    });
  }

  Future<void> _handleCustomerRequestOtp() async {
    final input = _customerPhoneCtrl.text.trim();
    if (input.isEmpty || (!input.contains('@') && input.replaceAll(RegExp(r'\D'), '').length < 10)) {
      setState(() => _error = 'Please enter a valid 10-digit mobile number or email address.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await CustomerPortalService().requestOtp(
        identifier: input,
        shopCode: _customerShopCodeCtrl.text.trim().isNotEmpty ? _customerShopCodeCtrl.text.trim() : null,
      );
      if (!mounted) return;
      setState(() {
        _loading = false;
        _otpSent = true;
        _maskedEmail = res['maskedEmail'] as String?;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  Future<void> _handleCustomerVerifyOtp() async {
    final input = _customerPhoneCtrl.text.trim();
    final otp = _customerOtpCtrl.text.trim();
    if (otp.length != 4) {
      setState(() => _error = 'Please enter the 4-digit verification OTP.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final success = await context.read<AuthProvider>().loginAsCustomer(
      identifier: input,
      otp: otp,
      shopCode: _customerShopCodeCtrl.text.trim().isNotEmpty ? _customerShopCodeCtrl.text.trim() : null,
    );
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (!success) {
        _error = 'Invalid OTP. Please verify and try again.';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F7FF),
      body: Stack(
        children: [
          // Background Gradient Waves matching Image 1
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 280,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFDBEAFE), Color(0xFFBFDBFE), Color(0xFF93C5FD)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.vertical(bottom: Radius.elliptical(200, 40)),
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Official NSYU App Logo
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF1D4ED8).withValues(alpha: 0.15),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Image.asset(
                          'assets/nsyu_logo.png',
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Icon(Icons.storefront_rounded, size: 42, color: Color(0xFF1D4ED8)),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // App Title & Tagline
                    const Text(
                      'NSYU Business',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Manage Your Business Easily',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 28),

                    // Login Card
                    Container(
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 20,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Mode Switcher (Staff vs Customer Portal)
                          Row(
                            children: [
                              Expanded(
                                child: InkWell(
                                  onTap: () => setState(() {
                                    _isCustomerMode = false;
                                    _error = null;
                                  }),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    decoration: BoxDecoration(
                                      border: Border(
                                        bottom: BorderSide(
                                          color: !_isCustomerMode ? const Color(0xFF1D4ED8) : Colors.transparent,
                                          width: 2,
                                        ),
                                      ),
                                    ),
                                    child: Text(
                                      'Staff / Owner',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                        color: !_isCustomerMode ? const Color(0xFF1D4ED8) : const Color(0xFF64748B),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              Expanded(
                                child: InkWell(
                                  onTap: () => setState(() {
                                    _isCustomerMode = true;
                                    _error = null;
                                  }),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    decoration: BoxDecoration(
                                      border: Border(
                                        bottom: BorderSide(
                                          color: _isCustomerMode ? const Color(0xFF047857) : Colors.transparent,
                                          width: 2,
                                        ),
                                      ),
                                    ),
                                    child: Text(
                                      'Customer Portal',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                        color: _isCustomerMode ? const Color(0xFF047857) : const Color(0xFF64748B),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 18),

                          if (_isCustomerMode) ...[
                            if (!_otpSent) ...[
                              Container(
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: TextField(
                                  controller: _customerPhoneCtrl,
                                  keyboardType: TextInputType.emailAddress,
                                  style: const TextStyle(fontSize: 14),
                                  decoration: InputDecoration(
                                    hintText: 'Mobile Number or Email',
                                    prefixIcon: Icon(
                                      _customerPhoneCtrl.text.contains('@') ? Icons.alternate_email : Icons.phone_outlined,
                                      size: 20,
                                      color: const Color(0xFF64748B),
                                    ),
                                    border: InputBorder.none,
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                                  ),
                                  onChanged: (_) => setState(() {}),
                                ),
                              ),
                              const Padding(
                                padding: EdgeInsets.only(left: 4, top: 4),
                                child: Text(
                                  '4-digit OTP will be sent to your registered email address.',
                                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                ),
                              ),
                              const SizedBox(height: 14),
                              Container(
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: TextField(
                                  controller: _customerShopCodeCtrl,
                                  textCapitalization: TextCapitalization.characters,
                                  style: const TextStyle(fontSize: 14),
                                  decoration: const InputDecoration(
                                    hintText: 'Shop Code (optional)',
                                    prefixIcon: Icon(Icons.storefront_outlined, size: 20, color: Color(0xFF64748B)),
                                    border: InputBorder.none,
                                    contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                                  ),
                                ),
                              ),
                              if (_error != null) ...[
                                const SizedBox(height: 10),
                                Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
                              ],
                              const SizedBox(height: 18),
                              ElevatedButton(
                                onPressed: _loading ? null : _handleCustomerRequestOtp,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF047857),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                child: _loading
                                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                    : const Text('Get 4-Digit OTP >', style: TextStyle(fontWeight: FontWeight.bold)),
                              ),
                            ] else ...[
                              Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Column(
                                  children: [
                                    const Text('4-Digit Verification Code sent to email:', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                                    const SizedBox(height: 2),
                                    Text(
                                      _maskedEmail ?? _customerPhoneCtrl.text.trim(),
                                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF047857)),
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: TextField(
                                  controller: _customerOtpCtrl,
                                  keyboardType: TextInputType.number,
                                  textAlign: TextAlign.center,
                                  maxLength: 4,
                                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 14),
                                  decoration: const InputDecoration(
                                    hintText: '••••',
                                    counterText: '',
                                    border: InputBorder.none,
                                    contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                                  ),
                                ),
                              ),
                              if (_error != null) ...[
                                const SizedBox(height: 10),
                                Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
                              ],
                              const SizedBox(height: 18),
                              ElevatedButton(
                                onPressed: _loading ? null : _handleCustomerVerifyOtp,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF047857),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                                child: _loading
                                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                    : const Text('Verify & Enter Portal >', style: TextStyle(fontWeight: FontWeight.bold)),
                              ),
                              TextButton(
                                onPressed: () => setState(() => _otpSent = false),
                                child: const Text('Change Mobile / Email', style: TextStyle(color: Color(0xFF047857))),
                              ),
                            ],
                          ] else ...[
                            // Email / Username Field
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: TextField(
                              controller: _identifierCtrl,
                              keyboardType: TextInputType.emailAddress,
                              style: const TextStyle(fontSize: 14),
                              decoration: const InputDecoration(
                                hintText: 'Email / Username',
                                hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                                prefixIcon: Icon(Icons.mail_outline_rounded, size: 20, color: Color(0xFF64748B)),
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),

                          // Password Field
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: TextField(
                              controller: _passwordCtrl,
                              obscureText: _obscurePassword,
                              style: const TextStyle(fontSize: 14),
                              decoration: InputDecoration(
                                hintText: 'Password',
                                hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                                prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20, color: Color(0xFF64748B)),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                    size: 20,
                                    color: const Color(0xFF64748B),
                                  ),
                                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                                ),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Remember Me & Forgot Password Row
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: Checkbox(
                                      value: _rememberMe,
                                      onChanged: (v) => setState(() => _rememberMe = v ?? true),
                                      activeColor: const Color(0xFF1D4ED8),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'Remember me',
                                    style: TextStyle(fontSize: 12.5, color: Color(0xFF475569)),
                                  ),
                                ],
                              ),
                              TextButton(
                                onPressed: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Please contact your administrator or store owner to reset password.'),
                                      backgroundColor: Color(0xFF1D4ED8),
                                    ),
                                  );
                                },
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: const Text(
                                  'Forgot Password?',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF1D4ED8),
                                  ),
                                ),
                              ),
                            ],
                          ),

                          if (_error != null) ...[
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFFECACA)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.error_outline, size: 16, color: Color(0xFFDC2626)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _error!,
                                      style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 18),

                          // Solid Blue Login Button
                          ElevatedButton(
                            onPressed: _loading ? null : _handleLogin,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF1D4ED8),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: _loading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text(
                                    'Login',
                                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                                  ),
                          ),
                          const SizedBox(height: 18),

                          // "or" Divider matching Image 1
                          Row(
                            children: const [
                              Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                              Padding(
                                padding: EdgeInsets.symmetric(horizontal: 12),
                                child: Text('or', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                              ),
                              Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                            ],
                          ),
                          const SizedBox(height: 18),

                          // Continue with Google Button matching Image 1
                          OutlinedButton(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Google OAuth integration is configured with Supabase Auth.'),
                                  backgroundColor: Color(0xFF1D4ED8),
                                ),
                              );
                            },
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              side: const BorderSide(color: Color(0xFFE2E8F0)),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              backgroundColor: Colors.white,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Image.network(
                                  'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png',
                                  width: 18,
                                  height: 18,
                                  errorBuilder: (_, __, ___) => const Icon(Icons.g_mobiledata, size: 22, color: Color(0xFFEA4335)),
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'Continue with Google',
                                  style: TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF334155),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                    const SizedBox(height: 16),

                    // Backend & Supabase Connection Status Pill
                    InkWell(
                      onTap: _showServerSettingsDialog,
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: _isConnected == true ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: _isConnected == true ? const Color(0xFFA7F3D0) : const Color(0xFFFECACA),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: _checkingConnection
                                    ? Colors.amber
                                    : (_isConnected == true ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                _checkingConnection
                                    ? 'Connecting to Supabase...'
                                    : (_isConnected == true
                                        ? (_connectionDetails.isNotEmpty ? _connectionDetails : 'Supabase PostgreSQL Connected')
                                        : 'Backend Offline — Tap to Configure (${SupabaseConfig.apiUrl})'),
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                  color: _isConnected == true ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Icon(
                              Icons.tune_rounded,
                              size: 14,
                              color: _isConnected == true ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
