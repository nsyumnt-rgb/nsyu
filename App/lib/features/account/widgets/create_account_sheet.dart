import 'package:flutter/material.dart';
import '../../../services/supabase_service.dart';
import '../../../services/customer_portal_service.dart';

class CreateAccountSheetHelper {
  static void show(
    BuildContext context, {
    required bool isCustomerMode,
    required Function(String identifier, {String? password, bool isOwner}) onAccountCreated,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _CreateAccountSheet(
        initialIsCustomer: isCustomerMode,
        onAccountCreated: onAccountCreated,
      ),
    );
  }
}

class _CreateAccountSheet extends StatefulWidget {
  final bool initialIsCustomer;
  final Function(String identifier, {String? password, bool isOwner}) onAccountCreated;

  const _CreateAccountSheet({
    required this.initialIsCustomer,
    required this.onAccountCreated,
  });

  @override
  State<_CreateAccountSheet> createState() => _CreateAccountSheetState();
}

class _CreateAccountSheetState extends State<_CreateAccountSheet> {
  late bool _isCustomer;

  // Business Owner Controllers
  final _ownerNameCtrl = TextEditingController();
  final _shopNameCtrl = TextEditingController();
  final _ownerEmailCtrl = TextEditingController();
  final _ownerPhoneCtrl = TextEditingController();
  final _ownerPassCtrl = TextEditingController();
  final _ownerConfirmPassCtrl = TextEditingController();
  final _shopCodeCtrl = TextEditingController();
  final _shopAddressCtrl = TextEditingController();

  // Customer Controllers
  final _custNameCtrl = TextEditingController();
  final _custPhoneCtrl = TextEditingController();
  final _custEmailCtrl = TextEditingController();
  final _custShopCodeCtrl = TextEditingController(text: 'NSYU-01');
  final _custPassCtrl = TextEditingController();
  final _custConfirmPassCtrl = TextEditingController();
  final _custAddressCtrl = TextEditingController();

  bool _obscurePass = true;
  bool _obscureConfirmPass = true;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _isCustomer = widget.initialIsCustomer;
  }

  @override
  void dispose() {
    _ownerNameCtrl.dispose();
    _shopNameCtrl.dispose();
    _ownerEmailCtrl.dispose();
    _ownerPhoneCtrl.dispose();
    _ownerPassCtrl.dispose();
    _ownerConfirmPassCtrl.dispose();
    _shopCodeCtrl.dispose();
    _shopAddressCtrl.dispose();

    _custNameCtrl.dispose();
    _custPhoneCtrl.dispose();
    _custEmailCtrl.dispose();
    _custShopCodeCtrl.dispose();
    _custPassCtrl.dispose();
    _custConfirmPassCtrl.dispose();
    _custAddressCtrl.dispose();
    super.dispose();
  }

  Future<void> _submitBusinessRegistration() async {
    final name = _ownerNameCtrl.text.trim();
    final shopName = _shopNameCtrl.text.trim();
    final email = _ownerEmailCtrl.text.trim();
    final phone = _ownerPhoneCtrl.text.trim();
    final pass = _ownerPassCtrl.text.trim();
    final confirmPass = _ownerConfirmPassCtrl.text.trim();
    final shopCode = _shopCodeCtrl.text.trim();
    final address = _shopAddressCtrl.text.trim();

    if (name.isEmpty) {
      setState(() => _error = 'Please enter your full name.');
      return;
    }
    if (shopName.isEmpty) {
      setState(() => _error = 'Please enter your business or shop name.');
      return;
    }
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Please enter a valid email address.');
      return;
    }
    if (phone.isEmpty || phone.replaceAll(RegExp(r'\D'), '').length < 10) {
      setState(() => _error = 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (pass.length < 6) {
      setState(() => _error = 'Password must be at least 6 characters.');
      return;
    }
    if (pass != confirmPass) {
      setState(() => _error = 'Passwords do not match. Please verify.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await SupabaseService().registerOwner(
        name: name,
        email: email,
        password: pass,
        phone: phone,
        shopName: shopName,
        shopCode: shopCode.isNotEmpty ? shopCode : null,
        address: address.isNotEmpty ? address : null,
      );

      if (!mounted) return;
      setState(() => _loading = false);

      final returnedShop = res['data']?['shop'];
      final assignedCode = returnedShop?['code']?.toString() ?? shopCode;

      Navigator.pop(context);

      widget.onAccountCreated(email, password: pass, isOwner: true);

      _showSuccessDialog(
        title: 'Business Registered!',
        message: 'Welcome $name! Your store "$shopName" has been registered with Shop Code $assignedCode.\n\nYou can now log in to manage billing, inventory, and ledger.',
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  Future<void> _submitCustomerRegistration() async {
    final name = _custNameCtrl.text.trim();
    final phone = _custPhoneCtrl.text.trim();
    final email = _custEmailCtrl.text.trim();
    final shopCode = _custShopCodeCtrl.text.trim();
    final pass = _custPassCtrl.text.trim();
    final confirmPass = _custConfirmPassCtrl.text.trim();
    final address = _custAddressCtrl.text.trim();

    if (name.isEmpty) {
      setState(() => _error = 'Please enter your full name.');
      return;
    }
    if (phone.isEmpty || phone.replaceAll(RegExp(r'\D'), '').length < 10) {
      setState(() => _error = 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Please enter a valid email address.');
      return;
    }
    if (shopCode.isEmpty) {
      setState(() => _error = 'Please enter the Shop Code (e.g. NSYU-01).');
      return;
    }
    if (pass.length < 6) {
      setState(() => _error = 'Password must be at least 6 characters.');
      return;
    }
    if (pass != confirmPass) {
      setState(() => _error = 'Passwords do not match. Please verify.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await CustomerPortalService().register(
        shopCode: shopCode,
        name: name,
        phone: phone,
        email: email,
        password: pass,
        address: address.isNotEmpty ? address : null,
      );

      if (!mounted) return;
      setState(() => _loading = false);

      Navigator.pop(context);

      widget.onAccountCreated(phone, password: pass, isOwner: false);

      _showSuccessDialog(
        title: 'Account Created!',
        message: 'Welcome $name! Your customer portal account has been created successfully.\n\nYou can now log in using your phone or email and password.',
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  void _showSuccessDialog({required String title, required String message}) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.check_circle_rounded, color: Color(0xFF047857), size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
              ),
            ),
          ],
        ),
        content: Text(
          message,
          style: const TextStyle(fontSize: 13.5, color: Color(0xFF475569), height: 1.45),
        ),
        actions: [
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF047857),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Continue to Login'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        12,
        20,
        MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag Handle Bar
            Center(
              child: Container(
                width: 44,
                height: 4.5,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Header Title & Close Button
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    _isCustomer ? Icons.person_add_alt_1_rounded : Icons.storefront_rounded,
                    color: const Color(0xFF047857),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _isCustomer ? 'Create Customer Account' : 'Register New Business',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                          letterSpacing: -0.3,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _isCustomer
                            ? 'Connect to your store to view bills, orders & ledger'
                            : 'Set up your shop for fast billing, inventory & khata',
                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded, size: 22, color: Color(0xFF64748B)),
                  style: IconButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(36, 36),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Switcher Tabs: Business vs Customer
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _buildRoleTab(
                      label: 'Business Owner',
                      icon: Icons.storefront_outlined,
                      isActive: !_isCustomer,
                      onTap: () => setState(() {
                        _isCustomer = false;
                        _error = null;
                      }),
                    ),
                  ),
                  Expanded(
                    child: _buildRoleTab(
                      label: 'Customer',
                      icon: Icons.people_alt_outlined,
                      isActive: _isCustomer,
                      onTap: () => setState(() {
                        _isCustomer = true;
                        _error = null;
                      }),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Form Fields based on Mode
            if (!_isCustomer) ...[
              // Business Owner Fields
              _buildTextField(
                controller: _ownerNameCtrl,
                label: 'Your Full Name *',
                hint: 'e.g. Mohd Zakir',
                icon: Icons.person_outline_rounded,
                keyboardType: TextInputType.name,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _shopNameCtrl,
                label: 'Business / Shop Name *',
                hint: 'e.g. Zakir Enterprises & Trading',
                icon: Icons.storefront_outlined,
                keyboardType: TextInputType.text,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _ownerEmailCtrl,
                label: 'Email Address * (for Login)',
                hint: 'owner@example.com',
                icon: Icons.mail_outline_rounded,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _ownerPhoneCtrl,
                label: 'Mobile Number *',
                hint: '10-digit mobile number',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _ownerPassCtrl,
                label: 'Create Password * (min 6 chars)',
                hint: 'Enter a secure password',
                icon: Icons.lock_outline_rounded,
                obscureText: _obscurePass,
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscurePass ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    size: 19,
                    color: const Color(0xFF64748B),
                  ),
                  onPressed: () => setState(() => _obscurePass = !_obscurePass),
                ),
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _ownerConfirmPassCtrl,
                label: 'Confirm Password *',
                hint: 'Re-enter your password',
                icon: Icons.lock_reset_rounded,
                obscureText: _obscureConfirmPass,
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureConfirmPass ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    size: 19,
                    color: const Color(0xFF64748B),
                  ),
                  onPressed: () => setState(() => _obscureConfirmPass = !_obscureConfirmPass),
                ),
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _shopCodeCtrl,
                label: 'Shop Code (Optional)',
                hint: 'Leave blank to auto-generate (e.g. ZE-01)',
                icon: Icons.tag_rounded,
                textCapitalization: TextCapitalization.characters,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _shopAddressCtrl,
                label: 'Shop Address / City (Optional)',
                hint: 'e.g. Main Market, Moradabad',
                icon: Icons.location_on_outlined,
              ),
            ] else ...[
              // Customer Fields
              _buildTextField(
                controller: _custNameCtrl,
                label: 'Full Name *',
                hint: 'e.g. Rajesh Kumar',
                icon: Icons.person_outline_rounded,
                keyboardType: TextInputType.name,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _custPhoneCtrl,
                label: 'Mobile Number *',
                hint: '10-digit registered mobile',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _custEmailCtrl,
                label: 'Email Address * (for OTP & Bills)',
                hint: 'customer@example.com',
                icon: Icons.mail_outline_rounded,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _custShopCodeCtrl,
                label: 'Shop Code *',
                hint: 'e.g. NSYU-01',
                icon: Icons.store_outlined,
                textCapitalization: TextCapitalization.characters,
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _custPassCtrl,
                label: 'Create Password * (min 6 chars)',
                hint: 'Enter your password',
                icon: Icons.lock_outline_rounded,
                obscureText: _obscurePass,
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscurePass ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    size: 19,
                    color: const Color(0xFF64748B),
                  ),
                  onPressed: () => setState(() => _obscurePass = !_obscurePass),
                ),
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _custConfirmPassCtrl,
                label: 'Confirm Password *',
                hint: 'Re-enter your password',
                icon: Icons.lock_reset_rounded,
                obscureText: _obscureConfirmPass,
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureConfirmPass ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    size: 19,
                    color: const Color(0xFF64748B),
                  ),
                  onPressed: () => setState(() => _obscureConfirmPass = !_obscureConfirmPass),
                ),
              ),
              const SizedBox(height: 12),
              _buildTextField(
                controller: _custAddressCtrl,
                label: 'Delivery Address (Optional)',
                hint: 'e.g. Flat / Street, City',
                icon: Icons.home_outlined,
              ),
            ],

            if (_error != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
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
            const SizedBox(height: 18),

            // Submit Button
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
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _loading
                      ? null
                      : (_isCustomer ? _submitCustomerRegistration : _submitBusinessRegistration),
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
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                _isCustomer ? Icons.person_add_alt_1_rounded : Icons.domain_add_rounded,
                                color: Colors.white,
                                size: 19,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                _isCustomer ? 'Create Customer Account' : 'Register My Business',
                                style: const TextStyle(
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
          ],
        ),
      ),
    );
  }

  Widget _buildRoleTab({
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(11),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(11),
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
                    color: const Color(0xFF059669).withValues(alpha: 0.28),
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
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: isActive ? FontWeight.bold : FontWeight.w600,
                fontSize: 12.5,
                color: isActive ? Colors.white : const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    TextCapitalization textCapitalization = TextCapitalization.none,
    bool obscureText = false,
    Widget? suffixIcon,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      obscureText: obscureText,
      style: const TextStyle(
        fontSize: 13.5,
        fontWeight: FontWeight.w600,
        color: Color(0xFF0F172A),
      ),
      decoration: InputDecoration(
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        labelText: label,
        labelStyle: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
        prefixIcon: Icon(icon, size: 19, color: const Color(0xFF059669)),
        suffixIcon: suffixIcon,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF059669), width: 1.8),
        ),
      ),
    );
  }
}
