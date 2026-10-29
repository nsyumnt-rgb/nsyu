import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/customer.dart';
import '../navigation/app_navigation.dart';
import '../providers/catalog_provider.dart';
import '../providers/customer_provider.dart';
import '../services/contact_import_service.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bottom_nav.dart';
import 'customer_ledger_detail_screen.dart';

/// Used two ways:
/// 1. From Home "Add Customer" quick action -> [selectMode] = false,
///    allows browsing, adding, editing customers, and viewing ledgers.
/// 2. From Bill / Order screen "Select Customer" -> [selectMode] = true,
///    lets user search/pick an existing customer OR add/edit inline,
///    then pops with the chosen Customer.
class CustomerPickerScreen extends StatefulWidget {
  final bool selectMode;

  const CustomerPickerScreen({super.key, this.selectMode = false});

  @override
  State<CustomerPickerScreen> createState() => _CustomerPickerScreenState();
}

class _CustomerPickerScreenState extends State<CustomerPickerScreen> {
  final _money = NumberFormat('#,##0');
  final _searchCtrl = TextEditingController();
  final _contactImportService = ContactImportService();
  String _query = '';
  String _statusFilter = 'All';

  static const _avatarPalettes = [
    (Color(0xFFEDE9FE), Color(0xFF6D28D9)), // purple
    (Color(0xFFE0F2FE), Color(0xFF0284C7)), // sky
    (Color(0xFFDBEAFE), Color(0xFF1D4ED8)), // blue
    (Color(0xFFF0FDF4), Color(0xFF16A34A)), // green
    (Color(0xFFFEF3C7), Color(0xFFD97706)), // amber
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<CustomerProvider>();
      if (!provider.loaded) provider.load();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CustomerProvider>();
    var results = provider.search(_query);
    if (_statusFilter == 'Active') {
      results = results.where((c) => c.currentBalance >= 0).toList();
    } else if (_statusFilter == 'Outstanding') {
      results = results.where((c) => c.currentBalance > 0).toList();
    } else if (_statusFilter == 'Inactive') {
      results = results.where((c) => false).toList();
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          widget.selectMode ? 'Select Customer' : 'Customers',
          style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 18),
        ),
        actions: [
          // Blue Circular "+" Button matching Image 5
          Container(
            margin: const EdgeInsets.only(right: 14),
            child: InkWell(
              onTap: () => _showAddOptions(context, prefillName: _query),
              borderRadius: BorderRadius.circular(18),
              child: Container(
                width: 34,
                height: 34,
                decoration: const BoxDecoration(
                  color: Color(0xFF1D4ED8),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 22),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search & Filter Tabs Section matching Image 5
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (v) => setState(() => _query = v),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
                      suffixIcon: _query.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _query = '');
                              },
                            )
                          : null,
                      hintText: 'Search customer by name, code, phone...',
                      hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                // Filter chips: All, Active, Outstanding, Inactive matching Image 5
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: ['All', 'Active', 'Outstanding', 'Inactive'].map((f) {
                      final isSelected = _statusFilter == f;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: InkWell(
                          onTap: () => setState(() => _statusFilter = f),
                          borderRadius: BorderRadius.circular(20),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                            decoration: BoxDecoration(
                              color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Text(
                              f,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                color: isSelected ? Colors.white : const Color(0xFF475569),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          const SizedBox(height: 4),

          // Customers List
          Expanded(
            child: provider.loaded && results.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.person_off_outlined, size: 48, color: Color(0xFF94A3B8)),
                        const SizedBox(height: 10),
                        Text(
                          _query.isEmpty ? 'No customers found.' : 'No customer matches "$_query".',
                          style: const TextStyle(color: Color(0xFF64748B), fontSize: 14),
                        ),
                        const SizedBox(height: 14),
                        ElevatedButton.icon(
                          onPressed: () => _openAddDialog(context, prefillName: _query),
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Add This Customer'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.steelBlue,
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    itemCount: results.length,
                    itemBuilder: (context, i) {
                      final c = results[i];
                      final initials = c.name.trim().isEmpty
                          ? '?'
                          : c.name.trim().split(RegExp(r'\s+')).take(2).map((s) => s[0]).join().toUpperCase();

                      final palette = _avatarPalettes[i % _avatarPalettes.length];
                      final code = (c.referenceCode != null && c.referenceCode!.isNotEmpty)
                          ? c.referenceCode!
                          : (c.id.startsWith('CUS') ? c.id : 'CUS-${c.id.padLeft(4, '0')}');

                      final isOutstanding = c.currentBalance > 0;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Material(
                          color: Colors.transparent,
                          child: InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: widget.selectMode
                                ? () => Navigator.of(context).pop(c)
                                : () => Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => CustomerLedgerDetailScreen(
                                          partyName: c.name,
                                          customer: c,
                                        ),
                                      ),
                                    ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                              child: Row(
                                children: [
                                  // Circle Avatar with initials matching Image 5
                                  CircleAvatar(
                                    radius: 20,
                                    backgroundColor: palette.$1,
                                    child: Text(
                                      initials,
                                      style: TextStyle(
                                        color: palette.$2,
                                        fontWeight: FontWeight.w800,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),

                                  // Name, Code, Phone
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          c.name,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 14,
                                            color: Color(0xFF0F172A),
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          code,
                                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                        ),
                                        Text(
                                          c.mobile.isNotEmpty ? c.mobile : '-',
                                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                        ),
                                      ],
                                    ),
                                  ),

                                  // Outstanding / Paid amount & status badge
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        isOutstanding ? '₹ ${_money.format(c.currentBalance)}' : '₹ 0',
                                        style: TextStyle(
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w700,
                                          color: isOutstanding ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                                        ),
                                      ),
                                      const SizedBox(height: 1),
                                      Text(
                                        isOutstanding ? 'Outstanding' : 'Paid',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
                                          color: isOutstanding ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                                        ),
                                      ),
                                    ],
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, size: 16, color: Color(0xFF64748B)),
                                    tooltip: 'Edit customer',
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                    onPressed: () => _openEditDialog(context, c),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94A3B8)),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );                    },
                  ),
          ),
        ],
      ),
      bottomNavigationBar: widget.selectMode
          ? null
          : AppBottomNav(currentIndex: -1, onTap: (tab) => AppNavigation.toTab(context, tab)),
    );
  }

  /// Shows the "Enter Manually" / "Select from Contacts" choice, then
  /// routes to the matching flow. Both flows end up at the same
  /// [_openAddDialog] + [CustomerProvider.addCustomer] save path.
  Future<void> _showAddOptions(BuildContext context, {String prefillName = ''}) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('New Customer', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.edit_outlined, color: Color(0xFF1D4ED8)),
              title: const Text('Enter Manually', style: TextStyle(fontWeight: FontWeight.w600)),
              onTap: () => Navigator.pop(ctx, 'manual'),
            ),
            ListTile(
              leading: const Icon(Icons.contacts_outlined, color: Color(0xFF1D4ED8)),
              title: const Text('Select from Contacts', style: TextStyle(fontWeight: FontWeight.w600)),
              onTap: () => Navigator.pop(ctx, 'contacts'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (choice == null || !context.mounted) return;
    if (choice == 'manual') {
      await _openAddDialog(context, prefillName: prefillName);
    } else {
      await _importFromContacts(context, prefillName: prefillName);
    }
  }

  /// Requests contacts permission, opens native picker, normalizes phone,
  /// and checks for duplicates before opening add dialog.
  Future<void> _importFromContacts(BuildContext context, {String prefillName = ''}) async {
    ContactPickResult? picked;
    try {
      picked = await _contactImportService.pickContact();
    } on ContactImportException catch (e) {
      if (!context.mounted) return;
      showAppSnackBar(context, e.message, isError: true);
      return;
    } catch (e) {
      if (!context.mounted) return;
      showAppSnackBar(context, 'Could not open contacts: $e', isError: true);
      return;
    }

    if (picked == null) return;
    if (!context.mounted) return;

    var rawPhone = picked.phones.first;
    if (picked.phones.length > 1) {
      final chosen = await _choosePhoneDialog(context, picked.phones);
      if (chosen == null) return;
      rawPhone = chosen;
    }

    final normalized = ContactImportService.normalizePhone(rawPhone);
    if (!context.mounted) return;

    final provider = context.read<CustomerProvider>();
    final existing = provider.findByMobile(normalized);

    if (existing != null) {
      showAppSnackBar(context, 'Customer already exists: ${existing.name}');
      if (widget.selectMode) {
        Navigator.of(context).pop(existing);
      } else {
        Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => CustomerLedgerDetailScreen(
            partyName: existing.name,
            customer: existing,
          ),
        ));
      }
      return;
    }

    await _openAddDialog(
      context,
      prefillName: picked.name,
      prefillMobile: normalized,
    );
  }

  Future<String?> _choosePhoneDialog(BuildContext context, List<String> phones) {
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Choose a phone number'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final p in phones)
              ListTile(
                title: Text(p),
                onTap: () => Navigator.pop(ctx, p),
              ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, null),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }

  /// Modal form to create a new customer with Name, Mobile, Address & Opening Balance.
  Future<void> _openAddDialog(
    BuildContext context, {
    String prefillName = '',
    String prefillMobile = '',
  }) async {
    final nameCtrl = TextEditingController(text: prefillName);
    final mobileCtrl = TextEditingController(text: prefillMobile);
    final addressCtrl = TextEditingController();
    final balanceCtrl = TextEditingController(text: '0.00');
    bool saving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
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
                  const Row(
                    children: [
                      Icon(Icons.person_add, color: Color(0xFF1D4ED8), size: 22),
                      SizedBox(width: 8),
                      Text('Add New Customer', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
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
                controller: mobileCtrl,
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
                controller: addressCtrl,
                decoration: const InputDecoration(
                  labelText: 'Address / Location',
                  prefixIcon: Icon(Icons.location_on_outlined),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: balanceCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Opening Balance (₹)',
                  prefixIcon: Icon(Icons.currency_rupee),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: saving
                    ? null
                    : () async {
                        final name = nameCtrl.text.trim();
                        if (name.isEmpty) {
                          showAppSnackBar(context, 'Please enter customer name', isError: true);
                          return;
                        }
                        setSheetState(() => saving = true);
                        try {
                          final provider = context.read<CustomerProvider>();
                          final openBal = double.tryParse(balanceCtrl.text.trim()) ?? 0.0;
                          final newCust = await provider.addCustomer(
                            name,
                            mobileCtrl.text.trim(),
                            address: addressCtrl.text.trim(),
                            openingBalance: openBal,
                          );
                          if (!context.mounted) return;
                          Navigator.pop(ctx);
                          if (widget.selectMode) {
                            Navigator.of(context).pop(newCust);
                          } else {
                            showAppSnackBar(context, '${newCust.name} added successfully');
                          }
                        } catch (e) {
                          setSheetState(() => saving = false);
                          showAppSnackBar(context, 'Failed to add customer: $e', isError: true);
                        }
                      },
                child: saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('Save Customer', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Modal form to edit an existing customer's Name, Mobile & Address.
  Future<void> _openEditDialog(BuildContext context, Customer customer) async {
    final nameCtrl = TextEditingController(text: customer.name);
    final mobileCtrl = TextEditingController(text: customer.mobile);
    final addressCtrl = TextEditingController(text: customer.address);
    bool saving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
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
                  Row(
                    children: [
                      const Icon(Icons.edit, color: Color(0xFF1D4ED8), size: 22),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Edit Customer', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                          Text('ID: ${customer.id}', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                        ],
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
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
                controller: mobileCtrl,
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
                controller: addressCtrl,
                decoration: const InputDecoration(
                  labelText: 'Address / Location',
                  prefixIcon: Icon(Icons.location_on_outlined),
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Current Balance', style: TextStyle(fontSize: 12.5, color: Color(0xFF475569))),
                    Text(
                      '₹${_money.format(customer.currentBalance)}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: customer.currentBalance > 0 ? AppColors.red : AppColors.billGreen,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: saving
                    ? null
                    : () async {
                        final name = nameCtrl.text.trim();
                        if (name.isEmpty) {
                          showAppSnackBar(context, 'Please enter customer name', isError: true);
                          return;
                        }
                        setSheetState(() => saving = true);
                        try {
                          customer.name = name;
                          customer.mobile = mobileCtrl.text.trim();
                          customer.address = addressCtrl.text.trim();
                          final provider = context.read<CustomerProvider>();
                          await provider.updateCustomer(customer);
                          if (!context.mounted) return;
                          context.read<CatalogProvider>().updateCustomerInfo(customer);
                          Navigator.pop(ctx);
                          showAppSnackBar(context, 'Customer updated successfully');
                          setState(() {});
                        } catch (e) {
                          setSheetState(() => saving = false);
                          showAppSnackBar(context, 'Failed to update customer: $e', isError: true);
                        }
                      },
                child: saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('Save Changes', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
