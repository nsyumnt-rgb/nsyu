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

  bool _isCustomerMode = false;
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
                    child: const Text(
                      'Configure your API server and Supabase credentials. Changes persist locally.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF475569)),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text('Backend API URL', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: urlCtrl,
                    style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
                    decoration: InputDecoration(
                      hintText: 'https://...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('Supabase URL', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: supabaseUrlCtrl,
                    style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
                    decoration: InputDecoration(
                      hintText: 'https://xxx.supabase.co',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('Publishable / Anon Key', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: anonKeyCtrl,
                    style: const TextStyle(fontSize: 13, fontFamily: 'monospace'),
                    decoration: InputDecoration(
                      hintText: 'sb_publishable_...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    ),
                  ),
                  if (testResult != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: testSuccess == true ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(6),
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
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final identifier = _identifierCtrl.text.trim();
    final password = _passwordCtrl.text.trim();

    if (identifier.isEmpty) {
      setState(() {
        _error = _isCustomerMode
            ? 'Please enter your email or mobile number.'
            : 'Please enter your email or username.';
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

    try {
      if (_isCustomerMode) {
        // Customer Portal Login
        final auth = context.read<AuthProvider>();
        // If password is 4 digits, attempt direct OTP verification
        if (password.length == 4 && RegExp(r'^\d{4}$').hasMatch(password)) {
          final success = await auth.loginAsCustomer(
            identifier: identifier,
            otp: password,
          );
          if (!mounted) return;
          setState(() {
            _loading = false;
            if (!success) {
              _error = 'Invalid 4-digit code. Please verify and try again.';
            }
          });
        } else {
          // Attempt standard credential login or request OTP
          final success = await auth.login(identifier, password);
          if (!mounted) return;
          if (success) {
            setState(() => _loading = false);
          } else {
            // If standard login fails for customer, request 4-digit OTP to registered email
            try {
              final otpRes = await CustomerPortalService().requestOtp(identifier: identifier);
              if (!mounted) return;
              setState(() {
                _loading = false;
              });
              _showOtpVerificationDialog(identifier, otpRes['maskedEmail'] as String?);
            } catch (otpErr) {
              if (!mounted) return;
              setState(() {
                _loading = false;
                _error = otpErr.toString().replaceAll('Exception: ', '');
              });
            }
          }
        }
      } else {
        // Staff / Owner Login
        final auth = context.read<AuthProvider>();
        final success = await auth.login(identifier, password);
        if (!mounted) return;
        setState(() {
          _loading = false;
          if (!success) {
            _error = 'Invalid credentials. Please verify your email/password.';
          }
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  void _showOtpVerificationDialog(String identifier, String? maskedEmail) {
    final otpCtrl = TextEditingController();
    bool verifying = false;
    String? dialogErr;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
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
                  child: const Icon(Icons.mark_email_read_outlined, color: Color(0xFF1D4ED8), size: 22),
                ),
                const SizedBox(width: 10),
                const Text('Enter 4-Digit Code', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'A 4-digit verification code was sent to ${maskedEmail ?? identifier}.',
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
                    controller: otpCtrl,
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    maxLength: 4,
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 14),
                    decoration: const InputDecoration(
                      hintText: '••••',
                      counterText: '',
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                ),
                if (dialogErr != null) ...[
                  const SizedBox(height: 8),
                  Text(dialogErr!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: verifying
                    ? null
                    : () async {
                        final otp = otpCtrl.text.trim();
                        if (otp.length != 4) {
                          setDialogState(() => dialogErr = 'Please enter the 4-digit code.');
                          return;
                        }
                        setDialogState(() {
                          verifying = true;
                          dialogErr = null;
                        });
                        final success = await context.read<AuthProvider>().loginAsCustomer(
                          identifier: identifier,
                          otp: otp,
                        );
                        if (!mounted || !ctx.mounted) return;
                        if (success) {
                          Navigator.pop(ctx);
                        } else {
                          setDialogState(() {
                            verifying = false;
                            dialogErr = 'Invalid code. Please try again.';
                          });
                        }
                      },
                child: verifying
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Verify & Login'),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showCreateAccountSheet() {
    if (!_isCustomerMode) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Store & Staff Registration', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
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

    // Customer Registration Dialog
    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final shopCodeCtrl = TextEditingController(text: 'NSYU-01');
    bool registering = false;
    String? regErr;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setSheetState) {
          return Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
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
                        child: const Icon(Icons.person_add_alt_1_outlined, color: Color(0xFF1D4ED8), size: 22),
                      ),
                      const SizedBox(width: 10),
                      const Text('Create Customer Account', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: nameCtrl,
                    decoration: InputDecoration(
                      labelText: 'Full Name *',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: 'Mobile Number *',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: 'Email Address (for login OTP) *',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: shopCodeCtrl,
                    textCapitalization: TextCapitalization.characters,
                    decoration: InputDecoration(
                      labelText: 'Shop Code',
                      hintText: 'e.g. NSYU-01',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    ),
                  ),
                  if (regErr != null) ...[
                    const SizedBox(height: 10),
                    Text(regErr!, style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
                  ],
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: registering
                        ? null
                        : () async {
                            final name = nameCtrl.text.trim();
                            final phone = phoneCtrl.text.trim();
                            final email = emailCtrl.text.trim();
                            final shopCode = shopCodeCtrl.text.trim();

                            if (name.isEmpty || phone.isEmpty || email.isEmpty) {
                              setSheetState(() => regErr = 'Please fill all required fields.');
                              return;
                            }

                            setSheetState(() {
                              registering = true;
                              regErr = null;
                            });

                            try {
                              await CustomerPortalService().register(
                                shopCode: shopCode.isNotEmpty ? shopCode : 'NSYU-01',
                                name: name,
                                phone: phone,
                                email: email,
                              );
                              if (!mounted || !ctx.mounted) return;
                              Navigator.pop(ctx);
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Account created! A 4-digit OTP will be sent to your email on login.'),
                                  backgroundColor: Color(0xFF16A34A),
                                ),
                              );
                              setState(() {
                                _identifierCtrl.text = phone;
                              });
                            } catch (e) {
                              setSheetState(() {
                                registering = false;
                                regErr = e.toString().replaceAll('Exception: ', '');
                              });
                            }
                          },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1D4ED8),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: registering
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Register Account', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F7FF),
      body: Stack(
        children: [
          // ── 1. Top Vibrant Blue Background with Wave ──
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 380,
            child: ClipPath(
              clipper: _TopWaveClipper(),
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0xFF38BDF8), // Sky blue
                      Color(0xFF2563EB), // Vibrant blue
                      Color(0xFF1D4ED8), // Royal blue
                    ],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
            ),
          ),

          // ── 2. Subtle Bottom Decorative Wave ──
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: 90,
            child: ClipPath(
              clipper: _BottomWaveClipper(),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFF93C5FD).withValues(alpha: 0.35),
                      const Color(0xFF3B82F6).withValues(alpha: 0.25),
                    ],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
            ),
          ),

          // ── 3. Main Scrollable Content ──
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Official NSYU App Logo in White Rounded Box
                    Container(
                      width: 84,
                      height: 84,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF0F172A).withValues(alpha: 0.16),
                            blurRadius: 18,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      padding: const EdgeInsets.all(7),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(15),
                        child: Image.asset(
                          'assets/nsyu_logo.png',
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Icon(Icons.storefront_rounded, size: 44, color: Color(0xFF1D4ED8)),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // App Title
                    const Text(
                      'NSYU Business',
                      style: TextStyle(
                        fontSize: 27,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),

                    // Tagline with Dotted / Solid Horizontal Dashes
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(width: 24, height: 1.2, color: Colors.white70),
                        const SizedBox(width: 8),
                        const Text(
                          'Manage Your Business Easily',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w500,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(width: 24, height: 1.2, color: Colors.white70),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // 3 Feature Indicators Row (Sales & Billing | Inventory | Customers)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _buildFeatureIndicator(
                          icon: Icons.bar_chart_rounded,
                          label: 'Sales & Billing',
                        ),
                        Container(
                          height: 28,
                          width: 1,
                          margin: const EdgeInsets.symmetric(horizontal: 14),
                          color: Colors.white.withValues(alpha: 0.25),
                        ),
                        _buildFeatureIndicator(
                          icon: Icons.inventory_2_outlined,
                          label: 'Inventory',
                        ),
                        Container(
                          height: 28,
                          width: 1,
                          margin: const EdgeInsets.symmetric(horizontal: 14),
                          color: Colors.white.withValues(alpha: 0.25),
                        ),
                        _buildFeatureIndicator(
                          icon: Icons.groups_outlined,
                          label: 'Customers',
                        ),
                      ],
                    ),
                    const SizedBox(height: 22),

                    // ── 4. Main White Floating Card ──
                    Container(
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 22),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF0F172A).withValues(alpha: 0.08),
                            blurRadius: 28,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Segmented Mode Switcher (Staff / Owner vs Customer Portal)
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            padding: const EdgeInsets.all(4),
                            child: Row(
                              children: [
                                Expanded(
                                  child: _buildSegmentedTab(
                                    label: 'Staff / Owner',
                                    icon: Icons.storefront_outlined,
                                    isActive: !_isCustomerMode,
                                    onTap: () => setState(() {
                                      _isCustomerMode = false;
                                      _error = null;
                                    }),
                                  ),
                                ),
                                Expanded(
                                  child: _buildSegmentedTab(
                                    label: 'Customer Portal',
                                    icon: Icons.people_alt_outlined,
                                    isActive: _isCustomerMode,
                                    onTap: () => setState(() {
                                      _isCustomerMode = true;
                                      _error = null;
                                    }),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Customer Portal Informational Banner (Matching Image 2)
                          if (_isCustomerMode) ...[
                            const SizedBox(height: 14),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0F7FF),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFDBEAFE)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFDBEAFE),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.groups_outlined, color: Color(0xFF1D4ED8), size: 20),
                                  ),
                                  const SizedBox(width: 12),
                                  const Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Customer Portal',
                                          style: TextStyle(
                                            fontSize: 13.5,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF0F172A),
                                          ),
                                        ),
                                        SizedBox(height: 2),
                                        Text(
                                          'Log in to view your bills, payments and ledger details.',
                                          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 16),

                          // Field 1: Email / Username or Email / Mobile Number
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                            ),
                            child: TextField(
                              controller: _identifierCtrl,
                              keyboardType: TextInputType.emailAddress,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFF0F172A)),
                              decoration: InputDecoration(
                                hintText: _isCustomerMode ? 'Email / Mobile Number' : 'Email / Username',
                                hintStyle: const TextStyle(fontSize: 13.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.w400),
                                prefixIcon: const Icon(Icons.mail_outline_rounded, size: 20, color: Color(0xFF64748B)),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),

                          // Field 2: Password with Eye Toggle
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                            ),
                            child: TextField(
                              controller: _passwordCtrl,
                              obscureText: _obscurePassword,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFF0F172A)),
                              decoration: InputDecoration(
                                hintText: 'Password',
                                hintStyle: const TextStyle(fontSize: 13.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.w400),
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
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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
                                    width: 18,
                                    height: 18,
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
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF0F172A),
                                    ),
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
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(10),
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
                          const SizedBox(height: 16),

                          // Gradient Blue [ -> Login ] Button
                          InkWell(
                            onTap: _loading ? null : _handleLogin,
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              height: 48,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                                borderRadius: BorderRadius.circular(14),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF1D4ED8).withValues(alpha: 0.35),
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: Center(
                                child: _loading
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : const Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 18),
                                          SizedBox(width: 6),
                                          Text(
                                            'Login',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 15,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ],
                                      ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // "or" Divider
                          const Row(
                            children: [
                              Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                              Padding(
                                padding: EdgeInsets.symmetric(horizontal: 12),
                                child: Text('or', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                              ),
                              Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Outlined [ 👤+ Create Account ] Button
                          OutlinedButton(
                            onPressed: _showCreateAccountSheet,
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              side: const BorderSide(color: Color(0xFF1D4ED8), width: 1.4),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              backgroundColor: Colors.white,
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.person_add_alt_1_outlined, color: Color(0xFF1D4ED8), size: 18),
                                SizedBox(width: 8),
                                Text(
                                  'Create Account',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF1D4ED8),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Supabase Connection Status Pill (Inside Card at Bottom)
                          InkWell(
                            onTap: _showServerSettingsDialog,
                            borderRadius: BorderRadius.circular(20),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8.5),
                              decoration: BoxDecoration(
                                color: _isConnected == true ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: _isConnected == true ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: _checkingConnection
                                          ? Colors.amber
                                          : (_isConnected == true ? const Color(0xFF16A34A) : const Color(0xFFEF4444)),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _checkingConnection
                                          ? 'Connecting to Supabase...'
                                          : (_isConnected == true
                                              ? (_connectionDetails.isNotEmpty ? _connectionDetails : 'Supabase PostgreSQL Connected')
                                              : 'Backend Offline — Tap to Configure'),
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w600,
                                        color: _isConnected == true ? const Color(0xFF15803D) : const Color(0xFF991B1B),
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Icon(
                                    Icons.storage_rounded,
                                    size: 16,
                                    color: _isConnected == true ? const Color(0xFF16A34A) : const Color(0xFF991B1B),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
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

  Widget _buildFeatureIndicator({required IconData icon, required String label}) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: 0.22),
          ),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
      ],
    );
  }

  Widget _buildSegmentedTab({
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: isActive
              ? const LinearGradient(
                  colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                )
              : null,
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: const Color(0xFF1D4ED8).withValues(alpha: 0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 17,
              color: isActive ? Colors.white : const Color(0xFF475569),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: isActive ? FontWeight.bold : FontWeight.w600,
                fontSize: 13,
                color: isActive ? Colors.white : const Color(0xFF475569),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Top Decorative Wave Clipper ──
class _TopWaveClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    path.lineTo(0, size.height - 45);
    path.quadraticBezierTo(
      size.width * 0.25,
      size.height,
      size.width * 0.5,
      size.height - 25,
    );
    path.quadraticBezierTo(
      size.width * 0.75,
      size.height - 50,
      size.width,
      size.height - 20,
    );
    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

// ── Bottom Subtle Wave Clipper ──
class _BottomWaveClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    path.moveTo(0, 35);
    path.quadraticBezierTo(
      size.width * 0.25,
      0,
      size.width * 0.5,
      25,
    );
    path.quadraticBezierTo(
      size.width * 0.75,
      50,
      size.width,
      20,
    );
    path.lineTo(size.width, size.height);
    path.lineTo(0, size.height);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
