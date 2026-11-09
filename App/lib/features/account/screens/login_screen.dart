import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../providers/auth_provider.dart';
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
              CustomerOtpDialog.show(
                context,
                identifier: identifier,
                maskedEmail: otpRes['maskedEmail'] as String?,
              );
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
              clipper: const TopWaveClipper(),
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
              clipper: const BottomWaveClipper(),
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
                    // Official NSYU App Logo, Title, Features
                    const LoginHeaderWidget(),
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
                                    child: const Icon(Icons.groups_outlined,
                                        color: Color(0xFF1D4ED8), size: 20),
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
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF0F172A),
                              ),
                              decoration: InputDecoration(
                                hintText: _isCustomerMode ? 'Email / Mobile Number' : 'Email / Username',
                                hintStyle: const TextStyle(
                                  fontSize: 13.5,
                                  color: Color(0xFF94A3B8),
                                  fontWeight: FontWeight.w400,
                                ),
                                prefixIcon: const Icon(Icons.mail_outline_rounded,
                                    size: 20, color: Color(0xFF64748B)),
                                border: InputBorder.none,
                                contentPadding:
                                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF0F172A),
                              ),
                              decoration: InputDecoration(
                                hintText: 'Password',
                                hintStyle: const TextStyle(
                                  fontSize: 13.5,
                                  color: Color(0xFF94A3B8),
                                  fontWeight: FontWeight.w400,
                                ),
                                prefixIcon: const Icon(Icons.lock_outline_rounded,
                                    size: 20, color: Color(0xFF64748B)),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility_off_outlined
                                        : Icons.visibility_outlined,
                                    size: 20,
                                    color: const Color(0xFF64748B),
                                  ),
                                  onPressed: () =>
                                      setState(() => _obscurePassword = !_obscurePassword),
                                ),
                                border: InputBorder.none,
                                contentPadding:
                                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
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
                                      shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(4)),
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
                                      content: Text(
                                          'Please contact your administrator or store owner to reset password.'),
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
                                  const Icon(Icons.error_outline,
                                      size: 16, color: Color(0xFFDC2626)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _error!,
                                      style: const TextStyle(
                                          fontSize: 12, color: Color(0xFFDC2626)),
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
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2, color: Colors.white),
                                      )
                                    : const Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.arrow_forward_rounded,
                                              color: Colors.white, size: 18),
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
                                child: Text('or',
                                    style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                              ),
                              Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Outlined [ 👤+ Create Account ] Button
                          OutlinedButton(
                            onPressed: _showCreateAccount,
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
                                Icon(Icons.person_add_alt_1_outlined,
                                    color: Color(0xFF1D4ED8), size: 18),
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
                            onTap: _showServerSettings,
                            borderRadius: BorderRadius.circular(20),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8.5),
                              decoration: BoxDecoration(
                                color: _isConnected == true
                                    ? const Color(0xFFF0FDF4)
                                    : const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: _isConnected == true
                                      ? const Color(0xFFBBF7D0)
                                      : const Color(0xFFFECACA),
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
                                          : (_isConnected == true
                                              ? const Color(0xFF16A34A)
                                              : const Color(0xFFEF4444)),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _checkingConnection
                                          ? 'Connecting to Supabase...'
                                          : (_isConnected == true
                                              ? (_connectionDetails.isNotEmpty
                                                  ? _connectionDetails
                                                  : 'Supabase PostgreSQL Connected')
                                              : 'Backend Offline — Tap to Configure'),
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w600,
                                        color: _isConnected == true
                                            ? const Color(0xFF15803D)
                                            : const Color(0xFF991B1B),
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Icon(
                                    Icons.storage_rounded,
                                    size: 16,
                                    color: _isConnected == true
                                        ? const Color(0xFF16A34A)
                                        : const Color(0xFF991B1B),
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
