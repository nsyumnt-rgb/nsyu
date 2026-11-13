import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../models/customer.dart';
import '../../../providers/catalog_provider.dart';
import '../../../providers/customer_provider.dart';
import '../../../theme/app_theme.dart';

class CustomerAddSheet extends StatefulWidget {
  final String prefillName;
  final String prefillMobile;

  const CustomerAddSheet({
    super.key,
    this.prefillName = '',
    this.prefillMobile = '',
  });

  @override
  State<CustomerAddSheet> createState() => _CustomerAddSheetState();
}

class _CustomerAddSheetState extends State<CustomerAddSheet> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _shopNameCtrl;
  late final TextEditingController _mobileCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _addressCtrl;
  late final TextEditingController _balanceCtrl;
  late final TextEditingController _passwordCtrl;
  bool _isSupplier = false;
  bool _obscurePassword = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.prefillName);
    _shopNameCtrl = TextEditingController();
    _mobileCtrl = TextEditingController(text: widget.prefillMobile);
    _emailCtrl = TextEditingController();
    _addressCtrl = TextEditingController();
    _balanceCtrl = TextEditingController(text: '0.00');
    _passwordCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _shopNameCtrl.dispose();
    _mobileCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _balanceCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      showAppSnackBar(context, 'Please enter Customer Name', isError: true);
      return;
    }

    final rawMobile = _mobileCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (rawMobile.length != 10) {
      showAppSnackBar(context, 'Please enter a valid 10-digit Mobile Number', isError: true);
      return;
    }

    final email = _emailCtrl.text.trim();
    if (email.isEmpty || !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      showAppSnackBar(context, 'Please enter a valid Email Address for portal login', isError: true);
      return;
    }

    final address = _addressCtrl.text.trim();
    if (address.isEmpty) {
      showAppSnackBar(context, 'Please enter Address', isError: true);
      return;
    }

    final password = _passwordCtrl.text.trim();
    if (password.length < 6) {
      showAppSnackBar(context, 'Password must be at least 6 characters', isError: true);
      return;
    }

    setState(() => _saving = true);
    try {
      final provider = context.read<CustomerProvider>();
      final openBal = double.tryParse(_balanceCtrl.text.trim()) ?? 0.0;
      final newCust = await provider.addCustomer(
        name,
        rawMobile,
        shopName: _shopNameCtrl.text.trim().isNotEmpty ? _shopNameCtrl.text.trim() : null,
        email: email,
        password: password,
        address: address,
        openingBalance: openBal,
        isSupplier: _isSupplier,
      );
      if (!mounted) return;
      Navigator.pop(context, newCust);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showAppSnackBar(context, 'Failed to add party: $e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.person_add,
                        color: Color(0xFF1D4ED8), size: 22),
                    const SizedBox(width: 8),
                    Text(_isSupplier ? 'Add New Supplier' : 'Add New Customer',
                        style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w700)),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                ChoiceChip(
                  label: const Text('Customer'),
                  selected: !_isSupplier,
                  selectedColor: const Color(0xFFDBEAFE),
                  labelStyle: TextStyle(
                    color: !_isSupplier
                        ? const Color(0xFF1D4ED8)
                        : const Color(0xFF475569),
                    fontWeight: !_isSupplier ? FontWeight.w700 : FontWeight.w500,
                  ),
                  onSelected: (val) {
                    setState(() => _isSupplier = !val);
                  },
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Supplier'),
                  selected: _isSupplier,
                  selectedColor: const Color(0xFFDCFCE7),
                  labelStyle: TextStyle(
                    color: _isSupplier
                        ? const Color(0xFF16A34A)
                        : const Color(0xFF475569),
                    fontWeight: _isSupplier ? FontWeight.w700 : FontWeight.w500,
                  ),
                  onSelected: (val) {
                    setState(() => _isSupplier = val);
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nameCtrl,
              autofocus: true,
              decoration: InputDecoration(
                labelText: _isSupplier ? 'Supplier Name *' : 'Customer Name *',
                prefixIcon: const Icon(Icons.person_outline),
                border: const OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _shopNameCtrl,
              decoration: const InputDecoration(
                labelText: 'Shop Name (Optional)',
                prefixIcon: Icon(Icons.store_outlined),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _mobileCtrl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              decoration: const InputDecoration(
                labelText: 'Mobile Number * (10 Digits)',
                prefixIcon: Icon(Icons.phone_outlined),
                border: OutlineInputBorder(),
                isDense: true,
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _addressCtrl,
              decoration: const InputDecoration(
                labelText: 'Address *',
                prefixIcon: Icon(Icons.location_on_outlined),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _balanceCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true, signed: true),
              decoration: const InputDecoration(
                labelText: 'Opening Balance (₹) (Default ₹0, + Due, - Adv)',
                prefixIcon: Icon(Icons.currency_rupee),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email Address * (For Portal Login)',
                prefixIcon: Icon(Icons.email_outlined),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passwordCtrl,
              obscureText: _obscurePassword,
              decoration: InputDecoration(
                labelText: 'Password * (Min 6 chars)',
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
                border: const OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _saving ? null : _handleSave,
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : Text(_isSupplier ? 'Save Supplier' : 'Save Customer',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}

class CustomerEditSheet extends StatefulWidget {
  final Customer customer;

  const CustomerEditSheet({super.key, required this.customer});

  @override
  State<CustomerEditSheet> createState() => _CustomerEditSheetState();
}

class _CustomerEditSheetState extends State<CustomerEditSheet> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _shopNameCtrl;
  late final TextEditingController _mobileCtrl;
  late final TextEditingController _addressCtrl;
  late final TextEditingController _balanceCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _passwordCtrl;
  bool _obscurePassword = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.customer.name);
    _shopNameCtrl = TextEditingController(text: widget.customer.shopName ?? '');
    _mobileCtrl = TextEditingController(text: widget.customer.mobile);
    _addressCtrl = TextEditingController(text: widget.customer.address);
    _balanceCtrl = TextEditingController(
        text: widget.customer.openingBalance == 0
            ? '0.00'
            : widget.customer.openingBalance.toStringAsFixed(2));
    _emailCtrl = TextEditingController(text: widget.customer.email ?? '');
    _passwordCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _shopNameCtrl.dispose();
    _mobileCtrl.dispose();
    _addressCtrl.dispose();
    _balanceCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      showAppSnackBar(context, 'Please enter Customer Name', isError: true);
      return;
    }

    final rawMobile = _mobileCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (rawMobile.length != 10) {
      showAppSnackBar(context, 'Please enter a valid 10-digit Mobile Number', isError: true);
      return;
    }

    final email = _emailCtrl.text.trim();
    if (email.isNotEmpty && !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      showAppSnackBar(context, 'Please enter a valid Email Address', isError: true);
      return;
    }

    final address = _addressCtrl.text.trim();
    if (address.isEmpty) {
      showAppSnackBar(context, 'Please enter Address / Location', isError: true);
      return;
    }

    final password = _passwordCtrl.text.trim();
    if (password.isNotEmpty && password.length < 6) {
      showAppSnackBar(context, 'Password must be at least 6 characters', isError: true);
      return;
    }

    setState(() => _saving = true);
    try {
      final openBal = double.tryParse(_balanceCtrl.text.trim()) ?? widget.customer.openingBalance;
      widget.customer.name = name;
      widget.customer.shopName = _shopNameCtrl.text.trim().isNotEmpty ? _shopNameCtrl.text.trim() : null;
      widget.customer.mobile = rawMobile;
      widget.customer.address = address;
      widget.customer.openingBalance = openBal;
      widget.customer.email = email.isNotEmpty ? email : null;

      final provider = context.read<CustomerProvider>();
      await provider.updateCustomer(
        widget.customer,
        password: password.isNotEmpty ? password : null,
      );

      if (!mounted) return;
      context.read<CatalogProvider>().updateCustomerInfo(widget.customer);
      Navigator.pop(context, true);
      showAppSnackBar(context, 'Customer updated successfully!');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showAppSnackBar(context, 'Failed to update customer: $e', isError: true);
    }
  }

  Future<void> _handleDelete() async {
    final custProv = context.read<CustomerProvider>();
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx2) => AlertDialog(
        title: const Text('Delete Party?'),
        content: Text(
            'Are you sure you want to delete ${widget.customer.name}? This action cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx2, false),
              child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx2, true),
            child: const Text('Delete',
                style: TextStyle(color: Color(0xFFDC2626))),
          ),
        ],
      ),
    );
    if (confirm == true && mounted) {
      await custProv.deleteCustomer(widget.customer.id);
      if (!mounted) return;
      Navigator.pop(context, true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat('#,##0.00');

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.90,
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.edit_note_rounded,
                        color: Color(0xFF1D4ED8), size: 24),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Edit Customer',
                            style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.w700)),
                        Text('Customer ID: ${widget.customer.id}',
                            style: const TextStyle(
                                fontSize: 11.5, color: Color(0xFF64748B))),
                      ],
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 1. Customer Name *
            TextField(
              controller: _nameCtrl,
              autofocus: false,
              decoration: const InputDecoration(
                labelText: 'Customer Name *',
                prefixIcon: Icon(Icons.person_outline),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),

            // 2. Mobile Number
            TextField(
              controller: _mobileCtrl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              decoration: const InputDecoration(
                labelText: 'Mobile Number *',
                prefixIcon: Icon(Icons.phone_outlined),
                border: OutlineInputBorder(),
                isDense: true,
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),

            // 3. Shop Name (Optional)
            TextField(
              controller: _shopNameCtrl,
              decoration: const InputDecoration(
                labelText: 'Shop Name (Optional)',
                prefixIcon: Icon(Icons.storefront_outlined),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),

            // 4. Address / Location
            TextField(
              controller: _addressCtrl,
              decoration: const InputDecoration(
                labelText: 'Address / Location *',
                prefixIcon: Icon(Icons.location_on_outlined),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),

            // 5. Opening Balance (₹)
            TextField(
              controller: _balanceCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true, signed: true),
              decoration: const InputDecoration(
                labelText: 'Opening Balance (₹) (+ Due, - Adv)',
                prefixIcon: Icon(Icons.currency_rupee),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),

            // 6. Email
            TextField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                labelText: 'Email Address (For Portal Login)',
                prefixIcon: Icon(Icons.email_outlined),
                border: OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 12),

            // 7. Password (Show/Hide)
            TextField(
              controller: _passwordCtrl,
              obscureText: _obscurePassword,
              decoration: InputDecoration(
                labelText: 'Password (Leave blank to keep current)',
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
                border: const OutlineInputBorder(),
                isDense: true,
              ),
            ),
            const SizedBox(height: 14),

            // Current Balance Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Current Outstanding Balance',
                      style:
                          TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: Color(0xFF475569))),
                  Text(
                    '₹${money.format(widget.customer.currentBalance)}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: widget.customer.currentBalance > 0
                          ? AppColors.red
                          : AppColors.billGreen,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Save Changes Button
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _saving ? null : _handleSave,
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2),
                    )
                  : const Text('Save Changes',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 10),

            // Delete Party Button
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFDC2626),
                side: const BorderSide(color: Color(0xFFFCA5A5)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.delete_outline, size: 18),
              label: const Text('Delete Party',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              onPressed: _saving ? null : _handleDelete,
            ),
          ],
        ),
      ),
    );
  }
}

