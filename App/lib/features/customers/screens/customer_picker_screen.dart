import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/utils/debouncer.dart';
import '../../../models/customer.dart';
import '../../../navigation/app_navigation.dart';
import '../../../providers/customer_provider.dart';
import '../../../services/contact_import_service.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/app_bottom_nav.dart';
import '../../ledger/screens/customer_ledger_detail_screen.dart';
import '../widgets/customer_form_sheet.dart';
import '../widgets/customer_list_tile.dart';

/// Used two ways:
/// 1. From Home "Add Customer" quick action -> [selectMode] = false,
///    allows browsing, adding, editing customers, and viewing ledgers.
/// 2. From Bill / Order screen "Select Customer" -> [selectMode] = true,
///    lets user search/pick an existing customer OR add/edit inline,
///    then pops with the chosen Customer.
/// 3. From More Menu -> [showSuppliersOnly] = true to manage Suppliers.
class CustomerPickerScreen extends StatefulWidget {
  final bool selectMode;
  final bool showSuppliersOnly;

  const CustomerPickerScreen({
    super.key,
    this.selectMode = false,
    this.showSuppliersOnly = false,
  });

  @override
  State<CustomerPickerScreen> createState() => _CustomerPickerScreenState();
}

class _CustomerPickerScreenState extends State<CustomerPickerScreen> {
  final _searchCtrl = TextEditingController();
  final _contactImportService = ContactImportService();
  final _debouncer = Debouncer(delay: const Duration(milliseconds: 250));
  String _query = '';
  String _statusFilter = 'All';

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
    _debouncer.dispose();
    super.dispose();
  }

  void _onSearchChanged(String v) {
    _debouncer.run(() {
      if (mounted) setState(() => _query = v);
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CustomerProvider>();
    var results = provider.search(_query);

    if (widget.showSuppliersOnly) {
      results = results.where((c) => c.isSupplier).toList();
    }

    if (_statusFilter == 'Active') {
      results = results.where((c) => c.currentBalance >= 0).toList();
    } else if (_statusFilter == 'Outstanding') {
      results = results.where((c) => c.currentBalance > 0).toList();
    } else if (_statusFilter == 'Advance') {
      results = results.where((c) => c.currentBalance < 0).toList();
    }

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.navy900),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          widget.showSuppliersOnly
              ? 'Suppliers'
              : (widget.selectMode ? 'Select Customer' : 'Customers'),
          style: const TextStyle(
            color: AppColors.navy900,
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: IconButton(
              tooltip: widget.showSuppliersOnly ? 'Add Supplier' : 'Add Customer',
              onPressed: () => _showAddOptions(prefillName: _query),
              icon: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.navy900,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 20),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Column(
              children: [
                // Search field
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.bg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: _onSearchChanged,
                    decoration: InputDecoration(
                      prefixIcon: const Icon(
                        Icons.search_rounded,
                        size: 20,
                        color: AppColors.textSecondary,
                      ),
                      suffixIcon: _query.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18, color: AppColors.textSecondary),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _query = '');
                              },
                            )
                          : null,
                      hintText: widget.showSuppliersOnly
                          ? 'Search supplier by name, code, phone...'
                          : 'Search customer by name, code, phone...',
                      hintStyle: const TextStyle(
                        fontSize: 13.5,
                        color: AppColors.textSecondary,
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                // Filter chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      'All',
                      'Active',
                      'Outstanding',
                      'Advance',
                    ].map((f) {
                      final isSelected = _statusFilter == f;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: InkWell(
                          onTap: () => setState(() => _statusFilter = f),
                          borderRadius: BorderRadius.circular(999),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.blue50
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.blue600
                                    : AppColors.border,
                                width: isSelected ? 1.4 : 1.0,
                              ),
                            ),
                            child: Text(
                              f,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: isSelected
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: isSelected
                                    ? AppColors.navy900
                                    : AppColors.textSecondary,
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
          const Divider(height: 1, color: AppColors.border),

          Expanded(
            child: !provider.loaded
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: SkeletonLoader.list(count: 6),
                  )
                : results.isEmpty
                    ? Center(
                        child: EmptyState(
                          icon: widget.showSuppliersOnly
                              ? Icons.inventory_2_outlined
                              : Icons.people_outline_rounded,
                          title: widget.showSuppliersOnly
                              ? 'No Suppliers Found'
                              : 'No Customers Found',
                          subtitle: _query.isNotEmpty
                              ? 'No records match "$_query".'
                              : (widget.showSuppliersOnly
                                  ? 'No suppliers added yet.'
                                  : 'Start by adding your first customer.'),
                          buttonLabel: widget.showSuppliersOnly
                              ? 'Add Supplier'
                              : 'Add Customer',
                          onButtonPressed: () => _openAddDialog(prefillName: _query),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                        itemCount: results.length,
                        itemBuilder: (context, i) {
                          final c = results[i];
                          return CustomerListTile(
                            customer: c,
                            index: i,
                            onTap: widget.selectMode
                                ? () => Navigator.of(context).pop(c)
                                : () => Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) =>
                                            CustomerLedgerDetailScreen(
                                          partyName: c.name,
                                          customer: c,
                                        ),
                                      ),
                                    ),
                            onEdit: () => _openEditDialog(c),
                          );
                        },
                      ),
          ),
        ],
      ),
      bottomNavigationBar: widget.selectMode
          ? null
          : AppBottomNav(
              currentIndex: -1,
              onTap: (tab) => AppNavigation.toTab(context, tab)),
    );
  }

  Future<void> _showAddOptions({String prefillName = ''}) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  widget.showSuppliersOnly ? 'New Supplier' : 'New Customer',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.navy900),
                ),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.edit_outlined, color: AppColors.blue600),
              title: const Text('Enter Manually',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              onTap: () => Navigator.pop(ctx, 'manual'),
            ),
            ListTile(
              leading: const Icon(Icons.contacts_outlined, color: AppColors.blue600),
              title: const Text('Select from Contacts',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              onTap: () => Navigator.pop(ctx, 'contacts'),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (choice == null || !mounted) return;
    if (choice == 'manual') {
      await _openAddDialog(prefillName: prefillName);
    } else {
      await _importFromContacts(prefillName: prefillName);
    }
  }

  Future<void> _importFromContacts({String prefillName = ''}) async {
    ContactPickResult? picked;
    try {
      picked = await _contactImportService.pickContact();
    } on ContactImportException catch (e) {
      if (!mounted) return;
      showAppSnackBar(context, e.message, isError: true);
      return;
    } catch (e) {
      if (!mounted) return;
      showAppSnackBar(context, 'Could not open contacts: $e', isError: true);
      return;
    }

    if (picked == null || !mounted) return;

    var rawPhone = picked.phones.first;
    if (picked.phones.length > 1) {
      final chosen = await _choosePhoneDialog(picked.phones);
      if (chosen == null) return;
      rawPhone = chosen;
    }

    final normalized = ContactImportService.normalizePhone(rawPhone);
    if (!mounted) return;

    final provider = context.read<CustomerProvider>();
    final existing = provider.findByMobile(normalized);

    if (existing != null) {
      showAppSnackBar(context, 'Party already exists: ${existing.name}');
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
      prefillName: picked.name,
      prefillMobile: normalized,
    );
  }

  Future<String?> _choosePhoneDialog(List<String> phones) {
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

  Future<void> _openAddDialog({
    String prefillName = '',
    String prefillMobile = '',
  }) async {
    final newCust = await showModalBottomSheet<Customer>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CustomerAddSheet(
        prefillName: prefillName,
        prefillMobile: prefillMobile,
      ),
    );

    if (newCust != null && mounted) {
      if (widget.selectMode) {
        Navigator.of(context).pop(newCust);
      } else {
        showAppSnackBar(context, '${newCust.name} added successfully');
      }
    }
  }

  Future<void> _openEditDialog(Customer customer) async {
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CustomerEditSheet(customer: customer),
    );

    if (updated == true && mounted) {
      setState(() {});
    }
  }
}
