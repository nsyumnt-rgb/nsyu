import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../providers/auth_provider.dart';
import '../../../providers/customer_portal_provider.dart';
import '../../../services/supabase_service.dart';
import '../../../services/customer_portal_service.dart';
import '../widgets/login_header_widget.dart';
import '../widgets/server_settings_dialog.dart';
import '../widgets/customer_otp_dialog.dart';
import '../widgets/create_account_sheet.dart';

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

  @override
  void dispose() {
    _identifierCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
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

  void _showServerSettings() {
    ServerSettingsDialog.show(
      context,
      onSaved: _checkBackendHealth,
    );
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
      final auth = context.read<AuthProvider>();

      if (_isCustomerMode) {
        // Customer Portal Login: Try password login first
        bool success = await auth.loginAsCustomerWithPassword(
          identifier: identifier,
          password: password,
        );

        // Fallback: If password login failed and entered password is 4 to 8 digits, attempt OTP verification
        if (!success && RegExp(r'^\d{4,8}$').hasMatch(password)) {
          success = await auth.loginAsCustomer(
            identifier: identifier,
            otp: password,
          );
        }

        if (success && mounted) {
          context.read<CustomerPortalProvider>().init();
        }

        if (!mounted) return;
        setState(() {
          _loading = false;
          if (!success) {
            _error = auth.lastError ?? 'Invalid customer credentials. Please check your email/mobile and password.';
          }
        });
      } else {
        // Staff / Owner Login
        bool success = await auth.login(identifier, password);

        // Smart fallback: If Staff/Owner login failed, check if this is a Customer account
        if (!success) {
          final custSuccess = await auth.loginAsCustomerWithPassword(
            identifier: identifier,
            password: password,
          );
          if (custSuccess) {
            if (mounted) {
              context.read<CustomerPortalProvider>().init();
            }
            if (!mounted) return;
            setState(() {
              _isCustomerMode = true;
              _loading = false;
            });
            return;
          }
        }

        if (!mounted) return;
        setState(() {
          _loading = false;
          if (!success) {
            _error = auth.lastError ?? 'Invalid credentials. Please verify your email/password.';
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

  void _showCreateAccount() {
    CreateAccountSheetHelper.show(
      context,
      isCustomerMode: _isCustomerMode,
      onAccountCreated: (phone) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Account created! A 4-digit OTP will be sent to your email on login.'),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
        setState(() {
          _identifierCtrl.text = phone;
        });
      },
    );
  }

  Future<void> _handleCustomerOtpLogin() async {
    final identifier = _identifierCtrl.text.trim();
    if (identifier.isEmpty) {
      setState(() {
        _error = 'Please enter your registered email or mobile number first.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await CustomerPortalService().requestOtp(identifier: identifier);
      if (!mounted) return;
      setState(() => _loading = false);

      final maskedEmail = res['maskedEmail']?.toString();
      final code = res['verificationCode']?.toString() ?? res['otp']?.toString();
      final msg = res['message']?.toString();

      await CustomerOtpDialog.show(
        context,
        identifier: identifier,
        maskedEmail: maskedEmail,
        initialOtp: code,
        message: msg,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  void _showCustomerForgotPasswordDialog() {
    final idCtrl = TextEditingController(text: _identifierCtrl.text.trim());
    final otpCtrl = TextEditingController();
    final newPassCtrl = TextEditingController();
    bool otpSent = false;
    bool dialogLoading = false;
    String? dialogError;
    String? dialogMessage;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            otpSent ? 'Reset Customer Password' : 'Forgot Password',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (dialogError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      dialogError!,
                      style: const TextStyle(color: Colors.red, fontSize: 12),
                    ),
                  ),
                if (dialogMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      dialogMessage!,
                      style: const TextStyle(color: Colors.green, fontSize: 12),
                    ),
                  ),
                if (!otpSent) ...[
                  const Text(
                    'Enter your registered email address or mobile number. We will send a 4-digit verification code.',
                    style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: idCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Email or Mobile',
                      prefixIcon: Icon(Icons.person_outline),
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ] else ...[
                  TextField(
                    controller: otpCtrl,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: 6),
                    decoration: const InputDecoration(
                      labelText: 'Verification Code (OTP)',
                      border: OutlineInputBorder(),
                      counterText: '',
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: newPassCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'New Password (Min 6 chars)',
                      prefixIcon: Icon(Icons.lock_outline),
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              style: TextButton.styleFrom(foregroundColor: const Color(0xFF64748B)),
              child: const Text('Cancel'),
            ),
            if (!otpSent)
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF047857),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: dialogLoading
                    ? null
                    : () async {
                        final val = idCtrl.text.trim();
                        if (val.isEmpty) {
                          setDialogState(() => dialogError = 'Please enter email or mobile');
                          return;
                        }
                        setDialogState(() {
                          dialogLoading = true;
                          dialogError = null;
                        });
                        try {
                          final res = await CustomerPortalService().forgotPassword(identifier: val);
                          final code = res['verificationCode']?.toString() ?? res['otp']?.toString();
                          setDialogState(() {
                            dialogLoading = false;
                            otpSent = true;
                            dialogMessage = res['message']?.toString() ?? 'Code sent to registered email';
                            if (code != null && code.isNotEmpty) {
                              otpCtrl.text = code;
                            }
                          });
                        } catch (err) {
                          setDialogState(() {
                            dialogLoading = false;
                            dialogError = err.toString().replaceAll('Exception: ', '');
                          });
                        }
                      },
                child: dialogLoading
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Send Code'),
              )
            else
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF047857),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: dialogLoading
                    ? null
                    : () async {
                        final otp = otpCtrl.text.trim();
                        final pass = newPassCtrl.text.trim();
                        if (otp.length < 4 || otp.length > 8) {
                          setDialogState(() => dialogError = 'Enter valid verification code');
                          return;
                        }
                        if (pass.length < 6) {
                          setDialogState(() => dialogError = 'Password must be at least 6 characters');
                          return;
                        }
                        setDialogState(() {
                          dialogLoading = true;
                          dialogError = null;
                        });
                        try {
                          await CustomerPortalService().resetPassword(
                            identifier: idCtrl.text.trim(),
                            otp: otp,
                            newPassword: pass,
                          );
                          if (!ctx.mounted) return;
                          Navigator.pop(ctx);
                          if (!mounted) return;
                          setState(() {
                            _passwordCtrl.text = pass;
                            _identifierCtrl.text = idCtrl.text.trim();
                          });
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Password reset successfully! Please log in.'),
                              backgroundColor: Color(0xFF047857),
                            ),
                          );
                        } catch (err) {
                          setDialogState(() {
                            dialogLoading = false;
                            dialogError = err.toString().replaceAll('Exception: ', '');
                          });
                        }
                      },
                child: dialogLoading
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Reset Password'),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Stack(
        children: [
          // ── 1. Top Emerald Brand Gradient Header ──
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 355,
            child: ClipPath(
              clipper: const TopWaveClipper(),
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0xFF064E3B), // Deep Forest Green
                      Color(0xFF047857), // Rich Emerald Green
                      Color(0xFF059669), // Vibrant Emerald
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Stack(
                  children: [
                    Positioned(
                      top: -40,
                      right: -30,
                      child: Container(
                        width: 220,
                        height: 220,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.05),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: 30,
                      left: -40,
                      child: Container(
                        width: 170,
                        height: 170,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF34D399).withValues(alpha: 0.09),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── 2. Subtle Bottom Decorative Wave ──
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: 85,
            child: ClipPath(
              clipper: const BottomWaveClipper(),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFFA7F3D0).withValues(alpha: 0.28),
                      const Color(0xFF6EE7B7).withValues(alpha: 0.16),
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
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Official NSYU App Logo, Title, Features
                    GestureDetector(
                      onLongPress: _showServerSettings,
                      child: const LoginHeaderWidget(),
                    ),
                    if (_isConnected == false && !_checkingConnection)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          _connectionDetails.isNotEmpty
                              ? 'Offline mode ($_connectionDetails). Long-press logo for settings.'
                              : 'Offline mode. Long-press logo for settings.',
                          style: const TextStyle(fontSize: 11, color: Colors.white70),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    const SizedBox(height: 14),

                    // ── 4. Main White Floating Card ──
                    Container(
                      padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(26),
                        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF064E3B).withValues(alpha: 0.08),
                            blurRadius: 30,
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

                          // Customer Portal Informational Banner
                          if (_isCustomerMode) ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFECFDF5),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFA7F3D0)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFD1FAE5),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Icon(
                                      Icons.groups_outlined,
                                      color: Color(0xFF047857),
                                      size: 19,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  const Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Customer Portal',
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF064E3B),
                                          ),
                                        ),
                                        SizedBox(height: 2),
                                        Text(
                                          'Log in with registered mobile or email to view bills, orders & ledger.',
                                          style: TextStyle(fontSize: 11, color: Color(0xFF047857)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 16),

                          // Field 1: Email / Username or Mobile / Email
                          TextField(
                            controller: _identifierCtrl,
                            keyboardType: TextInputType.emailAddress,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0F172A),
                            ),
                            decoration: InputDecoration(
                              filled: true,
                              fillColor: const Color(0xFFF8FAFC),
                              labelText: _isCustomerMode ? 'Mobile Number or Email' : 'Email or Username',
                              labelStyle: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                              hintText: _isCustomerMode ? 'Enter mobile or email' : 'Enter email or username',
                              hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                              prefixIcon: const Icon(
                                Icons.person_outline_rounded,
                                size: 20,
                                color: Color(0xFF059669),
                              ),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFF059669), width: 1.8),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Field 2: Password with Eye Toggle
                          TextField(
                            controller: _passwordCtrl,
                            obscureText: _obscurePassword,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0F172A),
                            ),
                            decoration: InputDecoration(
                              filled: true,
                              fillColor: const Color(0xFFF8FAFC),
                              labelText: 'Password',
                              labelStyle: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                              hintText: 'Enter your password',
                              hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                              prefixIcon: const Icon(
                                Icons.lock_outline_rounded,
                                size: 20,
                                color: Color(0xFF059669),
                              ),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                  size: 19,
                                  color: const Color(0xFF64748B),
                                ),
                                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                              ),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFF059669), width: 1.8),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),

                          // Remember Me & Forgot Password Row
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              InkWell(
                                onTap: () => setState(() => _rememberMe = !_rememberMe),
                                borderRadius: BorderRadius.circular(6),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                                  child: Row(
                                    children: [
                                      SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: Checkbox(
                                          value: _rememberMe,
                                          onChanged: (v) => setState(() => _rememberMe = v ?? true),
                                          activeColor: const Color(0xFF059669),
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
                                ),
                              ),
                              TextButton(
                                onPressed: () {
                                  if (_isCustomerMode) {
                                    _showCustomerForgotPasswordDialog();
                                  } else {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Please contact your administrator or store owner to reset password.',
                                        ),
                                        backgroundColor: Color(0xFF047857),
                                      ),
                                    );
                                  }
                                },
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                  minimumSize: const Size(48, 36),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: const Text(
                                  'Forgot Password?',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF047857),
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

                          // Primary Emerald Login Button
                          Container(
                            height: 50,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF065F46), Color(0xFF059669)],
                                begin: Alignment.centerLeft,
                                end: Alignment.centerRight,
                              ),
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF059669).withValues(alpha: 0.35),
                                  blurRadius: 14,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: _loading ? null : _handleLogin,
                                borderRadius: BorderRadius.circular(14),
                                child: Center(
                                  child: _loading
                                      ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.login_rounded, color: Colors.white, size: 19),
                                            SizedBox(width: 8),
                                            Text(
                                              'Login to Account',
                                              style: TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.bold,
                                                color: Colors.white,
                                                letterSpacing: 0.2,
                                              ),
                                            ),
                                          ],
                                        ),
                                ),
                              ),
                            ),
                          ),

                          if (_isCustomerMode) ...[
                            const SizedBox(height: 10),
                            Center(
                              child: TextButton.icon(
                                onPressed: _loading ? null : _handleCustomerOtpLogin,
                                icon: const Icon(
                                  Icons.mark_email_read_outlined,
                                  size: 16,
                                  color: Color(0xFF047857),
                                ),
                                label: const Text(
                                  'Log in with OTP Code instead',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF047857),
                                  ),
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 14),

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
                          const SizedBox(height: 14),

                          // Secondary Create Account Button
                          Container(
                            height: 46,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0FDF4),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFA7F3D0), width: 1.2),
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: _showCreateAccount,
                                borderRadius: BorderRadius.circular(14),
                                child: const Center(
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.person_add_alt_1_outlined, size: 18, color: Color(0xFF065F46)),
                                      SizedBox(width: 8),
                                      Text(
                                        'Create Account',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF065F46),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Trust Footer
                    const SizedBox(height: 16),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.lock_outline_rounded, size: 13, color: Color(0xFF94A3B8)),
                        SizedBox(width: 5),
                        Text(
                          'Encrypted & Secure • NSYU Business v2.4',
                          style: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
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
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: isActive
              ? const LinearGradient(
                  colors: [Color(0xFF065F46), Color(0xFF059669)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: const Color(0xFF059669).withValues(alpha: 0.32),
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
              size: 16,
              color: isActive ? Colors.white : const Color(0xFF64748B),
            ),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: isActive ? FontWeight.bold : FontWeight.w600,
                  fontSize: 12.5,
                  color: isActive ? Colors.white : const Color(0xFF64748B),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

