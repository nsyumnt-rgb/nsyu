import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../models/customer.dart';
import '../../../providers/catalog_provider.dart';
import '../../../providers/customer_provider.dart';
import '../../../theme/app_theme.dart';

class CustomerProfileSheetHelper {
  static void showProfileSheet({
    required BuildContext context,
    required Customer? customer,
    required String partyName,
    required double currentBalance,
    required NumberFormat moneyFormatter,
    required ValueChanged<Customer> onCustomerUpdated,
  }) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Customer Profile', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _profileRow('Name', customer?.name ?? partyName),
            _profileRow('Mobile', customer?.mobile.isNotEmpty == true ? customer!.mobile : 'Not Provided'),
            _profileRow('Address', customer?.address.isNotEmpty == true ? customer!.address : 'Not Provided'),
            _profileRow(
              'Current Outstanding',
              '₹${moneyFormatter.format(currentBalance != 0.0 ? currentBalance : (customer?.currentBalance ?? 0.0))}',
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.edit_outlined, size: 16),
                label: const Text('Edit Customer Details', style: TextStyle(fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  showEditDialog(
                    context: context,
                    customer: customer,
                    partyName: partyName,
                    onCustomerUpdated: onCustomerUpdated,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _profileRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF64748B), fontSize: 13)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }

  static Future<void> showEditDialog({
    required BuildContext context,
    required Customer? customer,
    required String partyName,
    required ValueChanged<Customer> onCustomerUpdated,
  }) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _EditCustomerSheetWidget(
        customer: customer,
        partyName: partyName,
        onCustomerUpdated: onCustomerUpdated,
      ),
    );
  }
}

class _EditCustomerSheetWidget extends StatefulWidget {
  final Customer? customer;
  final String partyName;
  final ValueChanged<Customer> onCustomerUpdated;

  const _EditCustomerSheetWidget({
    required this.customer,
    required this.partyName,
    required this.onCustomerUpdated,
  });

  @override
  State<_EditCustomerSheetWidget> createState() => _EditCustomerSheetWidgetState();
}

class _EditCustomerSheetWidgetState extends State<_EditCustomerSheetWidget> {
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
    _nameCtrl = TextEditingController(text: widget.customer?.name ?? widget.partyName);
    _shopNameCtrl = TextEditingController(text: widget.customer?.shopName ?? '');
    _mobileCtrl = TextEditingController(text: widget.customer?.mobile ?? '');
    _addressCtrl = TextEditingController(text: widget.customer?.address ?? '');
    _balanceCtrl = TextEditingController(
        text: (widget.customer?.openingBalance ?? 0) == 0
            ? '0.00'
            : (widget.customer?.openingBalance ?? 0).toStringAsFixed(2));
    _emailCtrl = TextEditingController(text: widget.customer?.email ?? '');
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
      showAppSnackBar(context, 'Customer Name is required', isError: true);
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
      final custProvider = context.read<CustomerProvider>();
      final openBal = double.tryParse(_balanceCtrl.text.trim()) ?? (widget.customer?.openingBalance ?? 0.0);
      Customer target;

      if (widget.customer != null) {
        widget.customer!.name = name;
        widget.customer!.shopName = _shopNameCtrl.text.trim().isNotEmpty ? _shopNameCtrl.text.trim() : null;
        widget.customer!.mobile = rawMobile;
        widget.customer!.address = address;
        widget.customer!.openingBalance = openBal;
        widget.customer!.email = email.isNotEmpty ? email : null;

        await custProvider.updateCustomer(
          widget.customer!,
          password: password.isNotEmpty ? password : null,
        );
        target = widget.customer!;
      } else {
        target = await custProvider.addCustomer(
          name,
          rawMobile,
          shopName: _shopNameCtrl.text.trim().isNotEmpty ? _shopNameCtrl.text.trim() : null,
          email: email.isNotEmpty ? email : null,
          password: password.isNotEmpty ? password : null,
          address: address,
          openingBalance: openBal,
        );
      }

      if (mounted) {
        context.read<CatalogProvider>().updateCustomerInfo(target);
        widget.onCustomerUpdated(target);
        Navigator.pop(context);
        showAppSnackBar(context, 'Customer updated successfully');
      }
    } catch (e) {
      if (mounted) {
        showAppSnackBar(context, 'Failed to update customer: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
                const Text('Edit Customer', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
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
              keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
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
            const SizedBox(height: 20),

            ElevatedButton(
              onPressed: _saving ? null : _handleSave,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            ),
          ],
        ),
      ),
    );
  }
}
