import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../providers/auth_provider.dart';
import '../theme/app_theme.dart';

class ShopManagementScreen extends StatefulWidget {
  const ShopManagementScreen({super.key});

  @override
  State<ShopManagementScreen> createState() => _ShopManagementScreenState();
}

class _ShopManagementScreenState extends State<ShopManagementScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.read<AuthProvider>().loadShops();
      }
    });
  }

  void _showRegisterShopSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _RegisterShopBottomSheet(),
    );
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    showAppSnackBar(context, '$label copied to clipboard!');
  }

  void _shareShopCode(String shopName, String shopCode) {
    Share.share(
      'Shop at $shopName on NSYU Business!\n'
      'Use Shop Code: $shopCode to register or connect to our store catalog and orders.\n'
      'Download NSYU App and start ordering.',
      subject: 'Connect with $shopName (Shop Code: $shopCode)',
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isOwner = auth.isOwner;
    final shops = auth.shops;
    final activeShopId = auth.shopId;
    final isLoading = auth.loadingShops;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Shops & Branches',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
        ),
        backgroundColor: AppColors.navy900,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh shops',
            onPressed: () => context.read<AuthProvider>().loadShops(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => context.read<AuthProvider>().loadShops(),
        color: AppColors.emerald,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Top Info Banner ──
              _buildTopBanner(auth),
              const SizedBox(height: 20),

              // ── Register New Shop Button (Owner Only) ──
              if (isOwner) ...[
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: () => _showRegisterShopSheet(context),
                    icon: const Icon(Icons.add_business_rounded, color: Colors.white, size: 22),
                    label: const Text(
                      'Register New Shop / Branch',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        letterSpacing: 0.2,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.emerald,
                      elevation: 2,
                      shadowColor: AppColors.emerald.withValues(alpha: 0.35),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // ── Section Title ──
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'All Registered Stores (${shops.length})',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy900,
                    ),
                  ),
                  if (isLoading)
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.emerald),
                    ),
                ],
              ),
              const SizedBox(height: 12),

              // ── Shop List ──
              if (shops.isEmpty && !isLoading)
                _buildEmptyState(context, isOwner)
              else
                ...shops.map((shop) {
                  final sId = shop['id'] is int ? shop['id'] as int : int.tryParse(shop['id']?.toString() ?? '') ?? 0;
                  final isActive = sId == activeShopId;
                  return _buildShopCard(context, shop, isActive: isActive, isOwner: isOwner);
                }),

              const SizedBox(height: 24),

              // ── Customer Sharing Guidance Card ──
              _buildCustomerShareCard(auth),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopBanner(AuthProvider auth) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF04261D), Color(0xFF064E3B), Color(0xFF047857)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF047857).withValues(alpha: 0.25),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Active Branch Context',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      auth.shopName.isNotEmpty ? auth.shopName : 'Primary Store',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle_rounded, color: Colors.white, size: 12),
                    SizedBox(width: 4),
                    Text(
                      'ACTIVE',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(color: Colors.white24, height: 1),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    const Text(
                      'Shop Code: ',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    Flexible(
                      child: Text(
                        auth.shopCode.isNotEmpty ? auth.shopCode : 'NSYU-MAIN',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Row(
                children: [
                  InkWell(
                    onTap: () => _copyToClipboard(auth.shopCode, 'Shop Code'),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.copy_rounded, color: Colors.white, size: 13),
                          SizedBox(width: 4),
                          Text('Copy', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () => _shareShopCode(auth.shopName, auth.shopCode),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.share_rounded, color: Colors.white, size: 13),
                          SizedBox(width: 4),
                          Text('Share', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildShopCard(
    BuildContext context,
    Map<String, dynamic> shop, {
    required bool isActive,
    required bool isOwner,
  }) {
    final sId = shop['id'] is int ? shop['id'] as int : int.tryParse(shop['id']?.toString() ?? '') ?? 0;
    final name = shop['name']?.toString() ?? 'Store';
    final code = shop['code']?.toString() ?? '';
    final phone = shop['phone']?.toString() ?? '';
    final address = shop['address']?.toString() ?? '';
    final status = shop['status']?.toString().toLowerCase() ?? 'active';
    final isInactive = status == 'inactive';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isActive ? AppColors.emerald : AppColors.border,
          width: isActive ? 1.8 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: isActive ? AppColors.emerald.withValues(alpha: 0.10) : Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: isActive ? AppColors.emeraldLight : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Icon(
                      Icons.storefront_rounded,
                      color: isActive ? AppColors.emerald : AppColors.textSecondary,
                      size: 24,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: isInactive ? AppColors.textSecondary : AppColors.navy900,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (isActive)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppColors.emeraldLight,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: AppColors.emerald.withValues(alpha: 0.3)),
                              ),
                              child: const Text(
                                'CURRENT',
                                style: TextStyle(
                                  color: AppColors.emerald,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            )
                          else if (isInactive)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'INACTIVE',
                                style: TextStyle(
                                  color: Color(0xFFDC2626),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              'Code: $code',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.navy700,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          if (phone.isNotEmpty) ...[
                            const Icon(Icons.phone_outlined, size: 12, color: AppColors.textSecondary),
                            const SizedBox(width: 3),
                            Flexible(
                              child: Text(
                                phone,
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),

            if (address.isNotEmpty) ...[
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      address,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],

            const SizedBox(height: 14),
            const Divider(height: 1, color: AppColors.border),
            const SizedBox(height: 10),

            // ── Card Actions ──
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.copy_rounded, size: 18, color: AppColors.navy700),
                      tooltip: 'Copy Code',
                      visualDensity: VisualDensity.compact,
                      onPressed: () => _copyToClipboard(code, 'Shop Code'),
                    ),
                    IconButton(
                      icon: const Icon(Icons.share_rounded, size: 18, color: AppColors.navy700),
                      tooltip: 'Share Shop Details',
                      visualDensity: VisualDensity.compact,
                      onPressed: () => _shareShopCode(name, code),
                    ),
                  ],
                ),
                if (!isActive)
                  FilledButton.icon(
                    onPressed: isInactive
                        ? null
                        : () async {
                            final messenger = ScaffoldMessenger.of(context);
                            final err = await context.read<AuthProvider>().switchActiveShop(sId);
                            if (err == null) {
                              messenger.showSnackBar(
                                SnackBar(
                                  content: Text('Switched to $name!'),
                                  backgroundColor: AppColors.emerald,
                                ),
                              );
                            } else {
                              messenger.showSnackBar(
                                SnackBar(
                                  content: Text(err),
                                  backgroundColor: AppColors.danger,
                                ),
                              );
                            }
                          },
                    icon: const Icon(Icons.sync_alt_rounded, size: 15),
                    label: const Text('Switch Branch', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.navy900,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  )
                else
                  const Row(
                    children: [
                      Icon(Icons.check_circle_rounded, color: AppColors.emerald, size: 16),
                      SizedBox(width: 6),
                      Text(
                        'Active Store',
                        style: TextStyle(
                          color: AppColors.emerald,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, bool isOwner) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppColors.emeraldLight,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.store_mall_directory_outlined, color: AppColors.emerald, size: 36),
          ),
          const SizedBox(height: 14),
          const Text(
            'No Shops Found',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.navy900),
          ),
          const SizedBox(height: 6),
          const Text(
            'Register your primary or branch shop to start billing and managing inventory.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
          if (isOwner) ...[
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: () => _showRegisterShopSheet(context),
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('Register Shop', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.emerald,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCustomerShareCard(AuthProvider auth) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFECFDF5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFA7F3D0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.lightbulb_outline_rounded, color: Color(0xFF047857), size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'How Customers Connect to Your Shop',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF064E3B),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Every shop has a unique Shop Code (${auth.shopCode}). Customers enter this code when registering their account or browsing your digital catalog to view your prices and place orders.',
                  style: const TextStyle(fontSize: 12.5, color: Color(0xFF047857), height: 1.35),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER SHOP BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────

class _RegisterShopBottomSheet extends StatefulWidget {
  const _RegisterShopBottomSheet();

  @override
  State<_RegisterShopBottomSheet> createState() => _RegisterShopBottomSheetState();
}

class _RegisterShopBottomSheetState extends State<_RegisterShopBottomSheet> {
  final _formKey = GlobalKey<FormState>();

  final _nameCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthProvider>();
    if (auth.registeredMobile != null && auth.registeredMobile!.isNotEmpty) {
      _phoneCtrl.text = auth.registeredMobile!;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _codeCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameCtrl.text.trim();
    final code = _codeCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    final email = _emailCtrl.text.trim();
    final address = _addressCtrl.text.trim();

    if (name.isEmpty) {
      setState(() => _error = 'Please enter the Shop / Branch Name.');
      return;
    }
    if (phone.isEmpty) {
      setState(() => _error = 'Please enter a contact phone number.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    String effectiveCode = code;
    if (effectiveCode.isEmpty) {
      final base = name.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').toUpperCase();
      final prefix = base.length >= 4 ? base.substring(0, 4) : (base.isNotEmpty ? base : 'SHOP');
      effectiveCode = '$prefix-${DateTime.now().millisecondsSinceEpoch.toString().substring(9)}';
    }

    final err = await context.read<AuthProvider>().registerNewShop(
          name: name,
          code: effectiveCode,
          phone: phone,
          email: email.isNotEmpty ? email : null,
          address: address.isNotEmpty ? address : null,
        );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (err == null) {
      Navigator.of(context).pop();
      showAppSnackBar(context, 'Store "$name" registered successfully!');
    } else {
      setState(() => _error = err);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle pill
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Title Header
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: const BoxDecoration(
                      color: AppColors.emeraldLight,
                      borderRadius: BorderRadius.all(Radius.circular(12)),
                    ),
                    child: const Icon(Icons.add_business_rounded, color: AppColors.emerald, size: 24),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Register New Shop',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy900,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Add a new store branch to your account',
                          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Error display
              if (_error != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFFCA5A5)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: Color(0xFFDC2626), size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _error!,
                          style: const TextStyle(color: Color(0xFF991B1B), fontSize: 13, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // Fields
              _buildInput(
                controller: _nameCtrl,
                label: 'Shop / Branch Name *',
                hint: 'e.g. NSYU Traders - Branch 2',
                icon: Icons.storefront_outlined,
              ),
              const SizedBox(height: 14),

              _buildInput(
                controller: _codeCtrl,
                label: 'Shop Code (Optional)',
                hint: 'e.g. NSYU-02 (leave blank to auto-generate)',
                icon: Icons.qr_code_outlined,
              ),
              const SizedBox(height: 14),

              _buildInput(
                controller: _phoneCtrl,
                label: 'Contact Phone Number *',
                hint: '10-digit mobile number',
                icon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 14),

              _buildInput(
                controller: _emailCtrl,
                label: 'Shop Email Address (Optional)',
                hint: 'branch@example.com',
                icon: Icons.email_outlined,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 14),

              _buildInput(
                controller: _addressCtrl,
                label: 'Shop / Store Address (Optional)',
                hint: 'Plot / Street / City / PIN',
                icon: Icons.location_on_outlined,
                maxLines: 2,
              ),
              const SizedBox(height: 22),

              // Submit Button
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.emerald,
                    elevation: 2,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Register Store',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInput({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: AppColors.navy900),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
        labelStyle: const TextStyle(fontSize: 13.5, color: AppColors.textSecondary),
        prefixIcon: Icon(icon, color: AppColors.navy700, size: 20),
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.emerald, width: 1.8),
        ),
      ),
    );
  }
}
