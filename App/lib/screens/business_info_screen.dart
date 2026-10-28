import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import '../theme/app_theme.dart';

class BusinessInfoScreen extends StatefulWidget {
  const BusinessInfoScreen({super.key});

  @override
  State<BusinessInfoScreen> createState() => _BusinessInfoScreenState();
}

class _BusinessInfoScreenState extends State<BusinessInfoScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _codeController;
  late TextEditingController _phoneController;
  late TextEditingController _emailController;
  late TextEditingController _addressController;
  late TextEditingController _logoController;

  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthProvider>();
    _nameController = TextEditingController(text: auth.shopName);
    _codeController = TextEditingController(text: auth.shopCode);
    _phoneController = TextEditingController(text: auth.shopPhone.isNotEmpty ? auth.shopPhone : (auth.registeredMobile ?? ''));
    _emailController = TextEditingController(text: auth.shopEmail);
    _addressController = TextEditingController(text: auth.shopAddress);
    _logoController = TextEditingController(text: auth.shopLogo);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _codeController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _logoController.dispose();
    super.dispose();
  }

  Future<void> _saveChanges() async {
    if (!_formKey.currentState!.validate()) return;

    final auth = context.read<AuthProvider>();
    if (!auth.isOwner) {
      showAppSnackBar(context, 'Only business Owner can edit business information.', isError: true);
      return;
    }

    setState(() => _isSaving = true);

    final error = await auth.updateBusinessInfo(
      name: _nameController.text.trim(),
      code: _codeController.text.trim(),
      phone: _phoneController.text.trim(),
      email: _emailController.text.trim(),
      address: _addressController.text.trim(),
      logo: _logoController.text.trim(),
    );

    if (!mounted) return;
    setState(() => _isSaving = false);

    if (error == null) {
      // Also sync settings provider so bills & invoices reflect the updated business name
      context.read<SettingsProvider>().syncFromSupabase();
      showAppSnackBar(context, 'Business information updated successfully!');
      Navigator.of(context).pop();
    } else {
      showAppSnackBar(context, error, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isOwner = auth.isOwner;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Business Information', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isOwner) ...[
                Container(
                  padding: const EdgeInsets.all(14),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFF59E0B)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.lock_outline, color: Color(0xFFB45309), size: 22),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Read-Only: You are signed in as Staff. Only the business Owner has permission to edit business details.',
                          style: TextStyle(color: Color(0xFF92400E), fontSize: 13, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              Card(
                elevation: 2,
                shadowColor: Colors.black12,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'General Information',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _nameController,
                        enabled: isOwner,
                        decoration: const InputDecoration(
                          labelText: 'Business / Shop Name *',
                          prefixIcon: Icon(Icons.storefront_outlined),
                          border: OutlineInputBorder(),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'Business name is required';
                          if (v.trim().length < 2) return 'Must be at least 2 characters';
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _codeController,
                        enabled: isOwner,
                        decoration: const InputDecoration(
                          labelText: 'Shop Code *',
                          prefixIcon: Icon(Icons.qr_code_outlined),
                          border: OutlineInputBorder(),
                          hintText: 'e.g. NSYU-MAIN',
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'Shop code is required';
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _phoneController,
                        enabled: isOwner,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Registered Phone Number *',
                          prefixIcon: Icon(Icons.phone_outlined),
                          border: OutlineInputBorder(),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'Phone number is required';
                          if (!RegExp(r'^\d{10}$').hasMatch(v.trim())) {
                            return 'Enter a valid 10-digit mobile number';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _emailController,
                        enabled: isOwner,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Business Email',
                          prefixIcon: Icon(Icons.email_outlined),
                          border: OutlineInputBorder(),
                        ),
                        validator: (v) {
                          if (v != null && v.trim().isNotEmpty) {
                            if (!RegExp(r'^[^@]+@[^@]+\.[^@]+').hasMatch(v.trim())) {
                              return 'Enter a valid email address';
                            }
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _addressController,
                        enabled: isOwner,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          labelText: 'Business Address',
                          prefixIcon: Icon(Icons.location_on_outlined),
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _logoController,
                        enabled: isOwner,
                        decoration: const InputDecoration(
                          labelText: 'Logo URL / Asset Path',
                          prefixIcon: Icon(Icons.image_outlined),
                          border: OutlineInputBorder(),
                          hintText: 'assets/nsyu_logo.png or http://...',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              if (isOwner)
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: FilledButton.icon(
                    onPressed: _isSaving ? null : _saveChanges,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1565C0),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: _isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Icon(Icons.save_outlined),
                    label: Text(
                      _isSaving ? 'Saving Changes...' : 'Save Changes',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
