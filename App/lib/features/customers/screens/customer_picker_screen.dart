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
class CustomerPickerScreen extends StatefulWidget {
  final bool selectMode;

  const CustomerPickerScreen({super.key, this.selectMode = false});

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
          style: const TextStyle(
              color: Color(0xFF0F172A),
              fontWeight: FontWeight.w700,
              fontSize: 18),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 14),
            child: InkWell(
              onTap: () => _showAddOptions(prefillName: _query),
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
                    onChanged: _onSearchChanged,
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search,
                          size: 20, color: Color(0xFF64748B)),
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
                      hintStyle: const TextStyle(
                          fontSize: 13, color: Color(0xFF94A3B8)),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 11),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      'All',
                      'Active',
                      'Outstanding',
                      'Inactive'
                    ].map((f) {
                      final isSelected = _statusFilter == f;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: InkWell(
                          onTap: () => setState(() => _statusFilter = f),
                          borderRadius: BorderRadius.circular(20),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 6),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? const Color(0xFF1D4ED8)
                                  : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isSelected
                                    ? const Color(0xFF1D4ED8)
                                    : const Color(0xFFE2E8F0),
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
                                    ? Colors.white
                                    : const Color(0xFF475569),
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

          Expanded(
            child: provider.loaded && results.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.person_off_outlined,
                            size: 48, color: Color(0xFF94A3B8)),
                        const SizedBox(height: 10),
                        Text(
                          _query.isEmpty
                              ? 'No customers found.'
                              : 'No customer matches "$_query".',
                          style: const TextStyle(
                              color: Color(0xFF64748B), fontSize: 14),
                        ),
                        const SizedBox(height: 14),
                        ElevatedButton.icon(
                          onPressed: () =>
                              _openAddDialog(prefillName: _query),
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
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 4),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('New Customer',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),
            ListTile(
              leading:
                  const Icon(Icons.edit_outlined, color: Color(0xFF1D4ED8)),
              title: const Text('Enter Manually',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              onTap: () => Navigator.pop(ctx, 'manual'),
            ),
            ListTile(
              leading: const Icon(Icons.contacts_outlined,
                  color: Color(0xFF1D4ED8)),
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

