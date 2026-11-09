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
  late final TextEditingController _mobileCtrl;
  late final TextEditingController _addressCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.customer?.name ?? widget.partyName);
    _mobileCtrl = TextEditingController(text: widget.customer?.mobile ?? '');
    _addressCtrl = TextEditingController(text: widget.customer?.address ?? '');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _mobileCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      showAppSnackBar(context, 'Name is required', isError: true);
      return;
    }

    setState(() => _saving = true);
    try {
      final custProvider = context.read<CustomerProvider>();
      Customer target;

      if (widget.customer != null) {
        widget.customer!.name = name;
        widget.customer!.mobile = _mobileCtrl.text.trim();
        widget.customer!.address = _addressCtrl.text.trim();
        await custProvider.updateCustomer(widget.customer!);
        target = widget.customer!;
      } else {
        target = await custProvider.addCustomer(
          name,
          _mobileCtrl.text.trim(),
          address: _addressCtrl.text.trim(),
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Edit Customer', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nameCtrl,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Customer Name *',
              prefixIcon: Icon(Icons.person_outline),
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _mobileCtrl,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Mobile Number',
              prefixIcon: Icon(Icons.phone_outlined),
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _addressCtrl,
            decoration: const InputDecoration(
              labelText: 'Address / Location',
              prefixIcon: Icon(Icons.location_on_outlined),
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
          const SizedBox(height: 18),
          ElevatedButton(
            onPressed: _saving ? null : _handleSave,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          ),
        ],
      ),
    );
  }
}
