import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/customer_portal_provider.dart';
import '../../services/customer_portal_service.dart';
import '../../theme/app_theme.dart';

class PortalMoreScreen extends StatefulWidget {
  const PortalMoreScreen({super.key});

  @override
  State<PortalMoreScreen> createState() => _PortalMoreScreenState();
}

class _PortalMoreScreenState extends State<PortalMoreScreen> {
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final cust = context.read<CustomerPortalProvider>().customer;
    final dbMetrics = context.read<CustomerPortalProvider>().dashboardData;
    final email = cust?['email']?.toString() ?? dbMetrics?['email']?.toString() ?? 'nazim1581994@gmail.com';
    final address = cust?['address']?.toString() ?? dbMetrics?['address']?.toString() ?? 'H 33 Vaishali, Ghaziabad';
    _emailCtrl.text = email;
    _addressCtrl.text = address;
  }

  void _syncControllers(String email, String address) {
    if (_emailCtrl.text.isEmpty && email.isNotEmpty) {
      _emailCtrl.text = email;
    }
    if (_addressCtrl.text.isEmpty && address.isNotEmpty) {
      _addressCtrl.text = address;
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    final email = _emailCtrl.text.trim();
    if (email.isNotEmpty && !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      showAppSnackBar(context, 'Please enter a valid email address', isError: true);
      return;
    }

    setState(() => _saving = true);
    try {
      await context.read<CustomerPortalProvider>().updateProfile(
        email: email.isNotEmpty ? email : null,
        address: _addressCtrl.text.trim().isNotEmpty ? _addressCtrl.text.trim() : null,
      );
      if (mounted) {
        showAppSnackBar(context, 'Profile information updated successfully!');
      }
    } catch (e) {
      if (mounted) {
        showAppSnackBar(context, 'Failed to update profile: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showChangePasswordDialog() {
    final portal = context.read<CustomerPortalProvider>();
    final cust = portal.customer;
    final identifier = cust?['email']?.toString() ?? cust?['phone']?.toString() ?? '';

    final otpCtrl = TextEditingController();
    final newPassCtrl = TextEditingController();
    final confirmPassCtrl = TextEditingController();

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
            otpSent ? 'Reset Customer Password' : 'Change Password',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: AppColors.navy900),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (dialogError != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.dangerBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      dialogError!,
                      style: const TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                if (dialogMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.successBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      dialogMessage!,
                      style: const TextStyle(color: AppColors.success, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                if (!otpSent) ...[
                  Text(
                    'We will send a verification code to your registered identifier ($identifier) to verify your identity.',
                    style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary, height: 1.4),
                  ),
                ] else ...[
                  TextField(
                    controller: otpCtrl,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: 6),
                    decoration: InputDecoration(
                      labelText: 'Verification Code (OTP)',
                      hintText: 'Enter code',
                      counterText: '',
                      filled: true,
                      fillColor: AppColors.bg,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: newPassCtrl,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: 'New Password (Min 6 chars)',
                      prefixIcon: const Icon(Icons.lock_outline, size: 18),
                      filled: true,
                      fillColor: AppColors.bg,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: confirmPassCtrl,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: 'Confirm New Password',
                      prefixIcon: const Icon(Icons.lock_reset, size: 18),
                      filled: true,
                      fillColor: AppColors.bg,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
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
              child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
            ),
            if (!otpSent)
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.navy900,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: dialogLoading
                    ? null
                    : () async {
                        setDialogState(() {
                          dialogLoading = true;
                          dialogError = null;
                        });
                        try {
                          final res = await CustomerPortalService().forgotPassword(identifier: identifier);
                          setDialogState(() {
                            dialogLoading = false;
                            otpSent = true;
                            dialogMessage = res['message']?.toString() ?? 'Verification code sent!';
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
                    : const Text('Send Verification Code'),
              )
            else
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.navy900,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: dialogLoading
                    ? null
                    : () async {
                        final otp = otpCtrl.text.trim();
                        final pass = newPassCtrl.text.trim();
                        final confirm = confirmPassCtrl.text.trim();

                        if (otp.length < 4 || otp.length > 8) {
                          setDialogState(() => dialogError = 'Enter valid verification code');
                          return;
                        }
                        if (pass.length < 6) {
                          setDialogState(() => dialogError = 'Password must be at least 6 characters');
                          return;
                        }
                        if (pass != confirm) {
                          setDialogState(() => dialogError = 'Passwords do not match');
                          return;
                        }

                        setDialogState(() {
                          dialogLoading = true;
                          dialogError = null;
                        });

                        try {
                          await CustomerPortalService().resetPassword(
                            identifier: identifier,
                            otp: otp,
                            newPassword: pass,
                          );
                          if (!ctx.mounted) return;
                          Navigator.pop(ctx);
                          if (!mounted) return;
                          showAppSnackBar(context, 'Password updated successfully!');
                        } catch (err) {
                          setDialogState(() {
                            dialogLoading = false;
                            dialogError = err.toString().replaceAll('Exception: ', '');
                          });
                        }
                      },
                child: dialogLoading
                    ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Update Password'),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text(
          'Are you sure you want to sign out of your customer account?',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      await context.read<AuthProvider>().logout();
      await CustomerPortalService().clearSession();
      if (mounted) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final portal = context.watch<CustomerPortalProvider>();
    final auth = context.watch<AuthProvider>();
    final cust = portal.customer;
    final dbMetrics = portal.dashboardData;

    final customerEmail = cust?['email']?.toString() ??
        dbMetrics?['email']?.toString() ??
        (auth.isCustomer && auth.userEmail.isNotEmpty ? auth.userEmail : 'nazim1581994@gmail.com');
    final customerAddress = cust?['address']?.toString() ??
        dbMetrics?['address']?.toString() ??
        'H 33 Vaishali, Ghaziabad';
    _syncControllers(customerEmail, customerAddress);

    final shop = (cust?['shop'] as Map<String, dynamic>?) ?? (dbMetrics?['shop'] as Map<String, dynamic>?) ?? {};
    final shopName = cust?['shopName']?.toString() ?? dbMetrics?['shopName']?.toString() ?? shop['name']?.toString() ?? 'NSYU';
    final customerName = cust?['name']?.toString() ??
        dbMetrics?['customerName']?.toString() ??
        (auth.userName.isNotEmpty && auth.userName != 'NSYU' ? auth.userName : 'Mohd Zakir');
    final mobileNumber = cust?['phone']?.toString() ??
        dbMetrics?['mobileNumber']?.toString() ??
        (auth.isCustomer && auth.registeredMobile?.isNotEmpty == true ? auth.registeredMobile! : '9045917913');
    final balance = parseDouble(cust?['currentBalance'] ??
        cust?['current_balance'] ??
        dbMetrics?['outstandingBalance'] ??
        (portal.currentBalance > 0 ? portal.currentBalance : 120.0));
    final openingBal = parseDouble(cust?['opening_balance'] ?? cust?['openingBalance']);
    final initials = customerName.isNotEmpty ? customerName.substring(0, 1).toUpperCase() : 'Z';

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF04261D), Color(0xFF064E3B), Color(0xFF047857)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        elevation: 0,
        title: const Text(
          'Profile & Settings',
          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── 1. Hero Customer Header Card ──
            AppCard(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 54,
                    height: 54,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF04261D), Color(0xFF064E3B), Color(0xFF047857)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Center(
                      child: Text(
                        initials,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          customerName,
                          style: const TextStyle(
                            fontSize: 16.5,
                            fontWeight: FontWeight.bold,
                            color: AppColors.navy900,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          shopName,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const StatusChip(
                          label: 'VERIFIED CUSTOMER',
                          variant: StatusChipVariant.info,
                          fontSize: 10,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ── 2. Account Information (Read-Only) ──
            AppCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'ACCOUNT OVERVIEW',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textSecondary,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 14),
                  _buildInfoRow(
                    icon: Icons.phone_outlined,
                    label: 'Registered Mobile',
                    child: Text(
                      '+91 $mobileNumber',
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.navy900),
                    ),
                  ),
                  const Divider(height: 18, color: AppColors.border),
                  _buildInfoRow(
                    icon: Icons.account_balance_wallet_outlined,
                    label: 'Current Balance',
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AmountText(
                          amount: balance.abs(),
                          fontSize: 13.5,
                          fontWeight: FontWeight.bold,
                          color: balance > 0
                              ? AppColors.danger
                              : (balance < 0 ? AppColors.warning : AppColors.success),
                        ),
                        const SizedBox(width: 6),
                        StatusChip(
                          label: balance > 0 ? 'Due' : (balance < 0 ? 'Advance' : 'Cleared'),
                          variant: balance > 0
                              ? StatusChipVariant.danger
                              : (balance < 0 ? StatusChipVariant.warning : StatusChipVariant.success),
                          fontSize: 10,
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 18, color: AppColors.border),
                  _buildInfoRow(
                    icon: Icons.history_outlined,
                    label: 'Opening Balance',
                    child: AmountText(
                      amount: openingBal.abs(),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  if (cust?['id'] != null) ...[
                    const Divider(height: 18, color: AppColors.border),
                    _buildInfoRow(
                      icon: Icons.badge_outlined,
                      label: 'Customer ID',
                      child: Text(
                        '#${cust!['id']}',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ── 3. Editable Contact Details ──
            AppCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'CONTACT & DELIVERY DETAILS',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textSecondary,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: 'Email Address',
                      hintText: 'e.g. name@example.com',
                      prefixIcon: const Icon(Icons.email_outlined, size: 18, color: AppColors.textSecondary),
                      filled: true,
                      fillColor: AppColors.bg,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _addressCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: 'Delivery / Shipping Address',
                      hintText: 'Enter your full shop/home address',
                      prefixIcon: const Icon(Icons.location_on_outlined, size: 18, color: AppColors.textSecondary),
                      filled: true,
                      fillColor: AppColors.bg,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 16),
                  PrimaryButton(
                    label: _saving ? 'Saving Changes...' : 'Save Profile Changes',
                    icon: Icons.check_circle_outline,
                    onPressed: _saving ? null : _handleSave,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ── 4. Password & Security Card ──
            AppCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'SECURITY',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textSecondary,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.blue50,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.lock_reset_rounded, color: AppColors.navy900, size: 20),
                    ),
                    title: const Text(
                      'Change Password',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.navy900),
                    ),
                    subtitle: const Text(
                      'Update your customer login password securely',
                      style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded, color: AppColors.textSecondary),
                    onTap: _showChangePasswordDialog,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ── 5. Sign Out Button ──
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  side: const BorderSide(color: Color(0xFFFECACA)),
                  backgroundColor: AppColors.dangerBg,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                icon: const Icon(Icons.logout_rounded, size: 18),
                label: const Text(
                  'Sign Out of Customer Account',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                ),
                onPressed: _handleLogout,
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required Widget child,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.textSecondary),
        const SizedBox(width: 10),
        Text(
          label,
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        const Spacer(),
        child,
      ],
    );
  }
}
