import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../models/bill_item.dart';
import '../../../models/customer.dart';
import '../../../models/product.dart';
import '../../../providers/bills_provider.dart';
import '../../../providers/catalog_provider.dart';
import '../../../providers/customer_provider.dart';
import '../../../services/bill_pdf_service.dart';
import '../../../theme/app_theme.dart';
import '../../../navigation/app_navigation.dart';
import '../../../widgets/animated_feedback_dialog.dart';
import '../../../screens/customer_picker_screen.dart';
import '../widgets/bill_items_list.dart';
import '../widgets/bill_summary_card.dart';
import '../widgets/bill_payment_section.dart';

class BillScreen extends StatefulWidget {
  const BillScreen({super.key});

  @override
  State<BillScreen> createState() => _BillScreenState();
}

class _BillScreenState extends State<BillScreen> {
  final _money = NumberFormat('#,##0.00');
  final _searchCtrl = TextEditingController();
  final _paymentReceivedCtrl = TextEditingController();
  final _paymentRefCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();

  String _selectedPaymentMode = 'UPI';
  DateTime _paymentDateTime = DateTime.now();
  bool _saving = false;

  final List<String> _paymentModes = [
    'UPI',
    'Cash',
    'Card',
    'Bank Transfer',
    'Cheque',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
      }
    });
    final provider = context.read<CatalogProvider>();
    if (provider.paymentReceived > 0) {
      _paymentReceivedCtrl.text = provider.paymentReceived.toStringAsFixed(2);
    }
    _paymentRefCtrl.text = provider.paymentReference;
    _remarksCtrl.text = provider.paymentRemarks;
    _selectedPaymentMode = provider.paymentMethod.toUpperCase();
    if (!_paymentModes.contains(_selectedPaymentMode)) {
      _selectedPaymentMode = 'UPI';
    }
  }

  @override
  void deactivate() {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    super.deactivate();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _paymentReceivedCtrl.dispose();
    _paymentRefCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  void _syncPaymentReceived(CatalogProvider provider) {
    final parsed = double.tryParse(_paymentReceivedCtrl.text.trim()) ?? 0.0;
    provider.setPaymentReceived(parsed);
  }

  String _initials(String name) => name.trim().isEmpty
      ? '?'
      : name.trim().split(RegExp(r'\s+')).take(2).map((s) => s[0]).join().toUpperCase();

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CatalogProvider>();
    final customer = provider.selectedCustomer;

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'New Bill',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Select Customer',
            icon: const Icon(Icons.person_add_alt_outlined, color: Color(0xFF0F172A)),
            onPressed: () => _editCustomer(provider),
          ),
          IconButton(
            tooltip: 'More options',
            icon: const Icon(Icons.more_vert, color: Color(0xFF0F172A)),
            onPressed: () => _showMoreMenu(context, provider),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildSearchInputSection(context, provider),
            const SizedBox(height: 12),
            if (provider.selectedCustomer != null || provider.customerName.isNotEmpty)
              _buildCustomerStrip(context, provider, customer),
            BillItemsList(
              provider: provider,
              onEditItemRate: (item) => _editItemRate(context, provider, item),
            ),
            const SizedBox(height: 14),
            BillSummaryCard(provider: provider),
            const SizedBox(height: 12),
            BillPaymentSection(
              provider: provider,
              onOpenPaymentDialog: () => _showPaymentInputDialog(context, provider),
              onClearPayment: () {
                provider.setPaymentReceived(0.0);
                _paymentReceivedCtrl.clear();
              },
            ),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomActionBar(context, provider),
    );
  }

  Widget _buildSearchInputSection(BuildContext context, CatalogProvider provider) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 44,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: TextField(
            controller: _searchCtrl,
            onChanged: (q) => setState(() {}),
            style: const TextStyle(fontSize: 13.5),
            decoration: InputDecoration(
              hintText: 'Search product by name, code or barcode...',
              hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
              prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.list_alt_rounded,
                        color: Color(0xFF64748B), size: 20),
                    tooltip: 'Browse Products',
                    onPressed: () => _showViewProductsSheet(context, provider),
                  ),
                  IconButton(
                    icon: const Icon(Icons.document_scanner_outlined,
                        color: Color(0xFF64748B), size: 20),
                    tooltip: 'Scan Barcode',
                    onPressed: () => _showScanBarcodeDialog(context, provider),
                  ),
                ],
              ),
              border: InputBorder.none,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
            ),
          ),
        ),
        if (_searchCtrl.text.trim().isNotEmpty) ...[
          const SizedBox(height: 6),
          _buildSearchSuggestions(context, provider),
        ],
      ],
    );
  }

  Widget _buildSearchSuggestions(BuildContext context, CatalogProvider provider) {
    final query = _searchCtrl.text.trim().toLowerCase();
    final matches = provider.products.where((p) {
      return p.desc.toLowerCase().contains(query) ||
          p.code.toLowerCase().contains(query) ||
          p.category.toLowerCase().contains(query);
    }).take(4).toList();

    if (matches.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Text(
          'No matching products found.',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          for (final p in matches)
            ListTile(
              dense: true,
              visualDensity: VisualDensity.compact,
              title: Text(p.desc,
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              subtitle: Text('${p.code} · Stock: ${p.stock}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              trailing: Text('₹ ${_money.format(p.slPrice)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
              onTap: () {
                provider.addToBill(p);
                _searchCtrl.clear();
                setState(() {});
              },
            ),
        ],
      ),
    );
  }

  Widget _buildCustomerStrip(
    BuildContext context,
    CatalogProvider provider,
    Customer? customer,
  ) {
    final name = customer?.name ?? provider.customerName;
    final phone = customer?.mobile ?? provider.customerPhone;
    final custId = customer != null && customer.id.isNotEmpty
        ? (customer.id.startsWith('CUS')
            ? customer.id
            : 'CUS-${customer.id.padLeft(4, "0")}')
        : 'CUS-0001';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFBFDBFE)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: const Color(0xFF1D4ED8),
            child: Text(
              _initials(name),
              style: const TextStyle(
                  color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: Color(0xFF0F172A))),
                Text('$custId · $phone',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              ],
            ),
          ),
          if (customer != null)
            IconButton(
              icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF1D4ED8)),
              tooltip: 'Edit customer info',
              onPressed: () => _openInlineEditCustomer(provider, customer),
            ),
          TextButton(
            onPressed: () => _editCustomer(provider),
            style: TextButton.styleFrom(
                padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
            child: const Text('Change',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1D4ED8))),
          ),
        ],
      ),
    );
  }

  void _showPaymentInputDialog(BuildContext context, CatalogProvider provider) {
    final ctrl = TextEditingController(
      text: provider.paymentReceived > 0
          ? provider.paymentReceived.toStringAsFixed(2)
          : provider.totalAmountPayable.toStringAsFixed(2),
    );
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Payment Received',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: ctrl,
                  keyboardType: TextInputType.number,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'Amount Received (₹)',
                    prefixText: '₹ ',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    OutlinedButton(
                      onPressed: () =>
                          ctrl.text = provider.totalAmountPayable.toStringAsFixed(2),
                      child: const Text('Full Amount'),
                    ),
                    OutlinedButton(
                      onPressed: () => ctrl.text = '0.00',
                      child: const Text('Clear'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Text(
                  'Payment Mode',
                  style: TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  children: _paymentModes
                      .map((m) => ChoiceChip(
                            label: Text(m, style: const TextStyle(fontSize: 12)),
                            selected: _selectedPaymentMode == m,
                            onSelected: (val) {
                              if (val) {
                                setState(() => _selectedPaymentMode = m);
                                setDialogState(() {});
                              }
                            },
                          ))
                      .toList(),
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  icon: const Icon(Icons.calendar_today, size: 15),
                  label: Text(
                    DateFormat('dd MMM yyyy, hh:mm a').format(_paymentDateTime),
                    style: const TextStyle(fontSize: 12.5),
                  ),
                  onPressed: () async {
                    await _pickPaymentDateTime();
                    setDialogState(() {});
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                final val = double.tryParse(ctrl.text.trim()) ?? 0.0;
                provider.setPaymentReceived(val);
                Navigator.pop(ctx);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                foregroundColor: Colors.white,
              ),
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomActionBar(BuildContext context, CatalogProvider provider) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 10,
            offset: Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        bottom: true,
        child: SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton.icon(
            onPressed: provider.billItems.isEmpty || _saving
                ? null
                : () => _saveAndFinish(provider),
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.check_circle_outline, size: 20, color: Colors.white),
            label: Text(
              _saving ? 'Saving...' : 'Save Bill',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: Colors.white,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1E60D5),
              disabledBackgroundColor: const Color(0xFF94A3B8),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _editCustomer(CatalogProvider provider) async {
    final picked = await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const CustomerPickerScreen(selectMode: true)),
    );
    if (picked != null && picked is Customer) {
      await provider.selectCustomer(picked);
    }
  }

  Future<void> _openInlineEditCustomer(
    CatalogProvider provider,
    Customer customer,
  ) async {
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
                          const Text(
                            'Edit Customer Info',
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                          ),
                          Text(
                            'ID: ${customer.id}',
                            style: const TextStyle(
                                fontSize: 11.5, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ],
                  ),
                  IconButton(
                      icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
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
                        if (name.isEmpty) return;
                        setSheetState(() => saving = true);
                        try {
                          customer.name = name;
                          customer.mobile = mobileCtrl.text.trim();
                          customer.address = addressCtrl.text.trim();
                          final custProv = context.read<CustomerProvider>();
                          await custProv.updateCustomer(customer);
                          provider.updateCustomerInfo(customer);
                          if (!ctx.mounted || !mounted) return;
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Customer updated successfully'),
                            ),
                          );
                        } catch (e) {
                          setSheetState(() => saving = false);
                        }
                      },
                child: saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        'Save Changes',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickPaymentDateTime() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _paymentDateTime,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (d == null || !mounted) return;
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_paymentDateTime),
    );
    if (t != null && mounted) {
      setState(() {
        _paymentDateTime = DateTime(d.year, d.month, d.day, t.hour, t.minute);
      });
    }
  }

  void _editDiscount(BuildContext context, CatalogProvider provider) {
    final ctrl = TextEditingController(text: provider.billDiscount.toStringAsFixed(2));
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit Bill Discount'),
        content: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration:
              const InputDecoration(prefixText: '₹ ', labelText: 'Discount Amount'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final val = double.tryParse(ctrl.text.trim()) ?? 0.0;
              provider.setBillDiscount(val);
              Navigator.pop(ctx);
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }

  void _editTax(BuildContext context, CatalogProvider provider) {
    bool usePercent = false;
    final ctrl = TextEditingController(text: provider.billTax.toStringAsFixed(2));

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.receipt_long_outlined, color: Color(0xFF1D4ED8), size: 20),
              SizedBox(width: 8),
              Text('Tax / GST'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ChoiceChip(
                    label: const Text('Flat (₹)'),
                    selected: !usePercent,
                    onSelected: (_) {
                      setDialogState(() {
                        usePercent = false;
                        ctrl.clear();
                      });
                    },
                  ),
                  const SizedBox(width: 10),
                  ChoiceChip(
                    label: const Text('% of Subtotal'),
                    selected: usePercent,
                    onSelected: (_) {
                      setDialogState(() {
                        usePercent = true;
                        ctrl.clear();
                      });
                    },
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextField(
                controller: ctrl,
                autofocus: true,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  prefixText: usePercent ? '' : '₹ ',
                  suffixText: usePercent ? '%' : '',
                  labelText: usePercent ? 'GST Rate (%)' : 'Tax Amount (₹)',
                  border: const OutlineInputBorder(),
                ),
                onChanged: (_) => setDialogState(() {}),
              ),
              if (usePercent) ...[
                const SizedBox(height: 8),
                Builder(builder: (_) {
                  final pct = double.tryParse(ctrl.text) ?? 0.0;
                  final computed = provider.billSubtotal * pct / 100;
                  if (computed <= 0) return const SizedBox.shrink();
                  return Text(
                    'Tax amount = ₹${computed.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1D4ED8),
                    ),
                  );
                }),
              ],
              const SizedBox(height: 10),
              if (usePercent)
                Wrap(
                  spacing: 8,
                  children: [5, 12, 18, 28]
                      .map((pct) => ActionChip(
                            label: Text('$pct%'),
                            onPressed: () =>
                                setDialogState(() => ctrl.text = pct.toString()),
                          ))
                      .toList(),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                provider.setBillTax(0);
                Navigator.pop(ctx);
              },
              child: const Text('Clear', style: TextStyle(color: Color(0xFFDC2626))),
            ),
            ElevatedButton(
              onPressed: () {
                double val;
                if (usePercent) {
                  final pct = double.tryParse(ctrl.text.trim()) ?? 0.0;
                  val = provider.billSubtotal * pct / 100;
                } else {
                  val = double.tryParse(ctrl.text.trim()) ?? 0.0;
                }
                provider.setBillTax(val);
                Navigator.pop(ctx);
              },
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
  }

  void _editItemRate(
    BuildContext context,
    CatalogProvider provider,
    BillItem item,
  ) {
    final ctrl = TextEditingController(text: item.price.toStringAsFixed(2));
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Edit Rate: ${item.desc}'),
        content: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(prefixText: '₹ ', labelText: 'Unit Rate'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final val = double.tryParse(ctrl.text.trim()) ?? item.price;
              provider.updateItemPrice(item.code, val);
              Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _confirmClearBill(BuildContext context, CatalogProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear All Items?'),
        content: const Text(
          'Are you sure you want to remove all items from this bill?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.red,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              provider.clearBill();
              _paymentReceivedCtrl.clear();
              Navigator.pop(ctx);
            },
            child: const Text('Clear All'),
          ),
        ],
      ),
    );
  }

  void _showAddNewProductDialog(CatalogProvider provider) {
    final nameCtrl = TextEditingController();
    final skuCtrl = TextEditingController();
    final purchaseCtrl = TextEditingController();
    final marginCtrl = TextEditingController();
    final stockCtrl = TextEditingController(text: '10');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding:
              EdgeInsets.fromLTRB(18, 16, 18, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Add New Product',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  IconButton(
                      icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Product Name *',
                  hintText: 'e.g. Cement (50 Kg)',
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: skuCtrl,
                      decoration: const InputDecoration(
                        labelText: 'SKU / Code',
                        hintText: 'e.g. CEM-50KG',
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: stockCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Opening Stock',
                        hintText: 'e.g. 50',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: purchaseCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        labelText: 'Purchase Price *',
                        prefixText: '₹ ',
                      ),
                      onChanged: (_) => setSheetState(() {}),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: marginCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        labelText: 'Margin (₹)',
                        prefixText: '₹ ',
                      ),
                      onChanged: (_) => setSheetState(() {}),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Builder(builder: (_) {
                final purchase = double.tryParse(purchaseCtrl.text) ?? 0.0;
                final margin = double.tryParse(marginCtrl.text) ?? 0.0;
                final selling = purchase + margin;
                if (selling <= 0) return const SizedBox.shrink();
                return Text(
                  'Selling Price = ₹${selling.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF16A34A),
                  ),
                );
              }),
              const SizedBox(height: 18),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.navy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () async {
                  final name = nameCtrl.text.trim();
                  final purchase = double.tryParse(purchaseCtrl.text.trim()) ?? 0.0;
                  final margin = double.tryParse(marginCtrl.text.trim()) ?? 0.0;
                  final sku = skuCtrl.text.trim().isNotEmpty
                      ? skuCtrl.text.trim()
                      : 'NSYU-${DateTime.now().millisecondsSinceEpoch % 10000}';
                  final stock = int.tryParse(stockCtrl.text.trim()) ?? 0;

                  if (name.isEmpty || purchase <= 0) {
                    showAppSnackBar(
                      context,
                      'Please enter product name and purchase price',
                      isError: true,
                    );
                    return;
                  }

                  Navigator.pop(ctx);

                  try {
                    final err = await provider.addProduct(
                      code: sku,
                      desc: name,
                      purchase: purchase,
                      marginPrice: margin,
                      stock: stock,
                    );
                    if (err == null) {
                      final sellingPrice = purchase + margin;
                      final created = provider.filteredProducts.firstWhere(
                        (p) => p.code == sku,
                        orElse: () => Product(
                          sno: 1,
                          code: sku,
                          desc: name,
                          spec: '',
                          pkg: 1,
                          category: 'General',
                          purchase: purchase,
                          marginPrice: margin,
                          sellingPrice: sellingPrice,
                          stock: stock,
                        ),
                      );
                      provider.addToBill(created);
                      if (mounted) {
                        showAppSnackBar(
                          context,
                          'Product added to catalog and added to bill!',
                        );
                      }
                    } else {
                      if (mounted) showAppSnackBar(context, err, isError: true);
                    }
                  } catch (e) {
                    if (mounted) {
                      showAppSnackBar(context, 'Error adding product: $e', isError: true);
                    }
                  }
                },
                child: const Text('Save and Add to Bill'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showViewProductsSheet(BuildContext context, CatalogProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        String query = '';
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final prods = provider.filteredProducts.where((p) {
              return query.isEmpty ||
                  p.desc.toLowerCase().contains(query.toLowerCase()) ||
                  p.code.toLowerCase().contains(query.toLowerCase());
            }).toList();

            return DraggableScrollableSheet(
              initialChildSize: 0.75,
              maxChildSize: 0.95,
              expand: false,
              builder: (ctx, scrollCtrl) => Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Select Products',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                        ),
                        IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () => Navigator.pop(ctx)),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: TextField(
                      decoration: const InputDecoration(
                        hintText: 'Search products by name or SKU',
                        prefixIcon: Icon(Icons.search),
                        isDense: true,
                      ),
                      onChanged: (q) => setModalState(() => query = q),
                    ),
                  ),
                  Expanded(
                    child: ListView.separated(
                      controller: scrollCtrl,
                      padding: const EdgeInsets.all(12),
                      itemCount: prods.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final p = prods[i];
                        final inBill = provider.billItemFor(p.code);
                        return ListTile(
                          title: Text(
                            p.desc,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13.5,
                            ),
                          ),
                          subtitle: Text(
                            'SKU: ${p.code} · Stock: ${p.stock}',
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: Color(0xFF64748B),
                            ),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '₹${_money.format(p.slPrice)}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.billGreen,
                                ),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: inBill != null
                                      ? AppColors.billGreen
                                      : AppColors.steelBlue,
                                  foregroundColor: Colors.white,
                                  visualDensity: VisualDensity.compact,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                ),
                                onPressed: () {
                                  provider.addToBill(p);
                                  setModalState(() {});
                                },
                                child: Text(inBill != null ? '+ (${inBill.qty})' : 'Add'),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showScanBarcodeDialog(BuildContext context, CatalogProvider provider) {
    final barcodeCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.qr_code_scanner, color: AppColors.steelBlue),
            SizedBox(width: 8),
            Text('Scan / Enter Barcode'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: barcodeCtrl,
              autofocus: true,
              decoration: const InputDecoration(
                hintText: 'Enter SKU / barcode (e.g. CEM-50KG)',
                isDense: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final code = barcodeCtrl.text.trim();
              Navigator.pop(ctx);
              if (code.isNotEmpty) {
                final match = provider.filteredProducts.cast<Product?>().firstWhere(
                      (p) =>
                          p!.code.toLowerCase() == code.toLowerCase() ||
                          (p.barcode != null &&
                              p.barcode!.toLowerCase() == code.toLowerCase()),
                      orElse: () => null,
                    );
                if (match != null) {
                  provider.addToBill(match);
                  showAppSnackBar(context, 'Added ${match.desc} to bill!');
                } else {
                  showAppSnackBar(context, 'No product found for "$code"', isError: true);
                }
              }
            },
            child: const Text('Add to Bill'),
          ),
        ],
      ),
    );
  }

  void _showMoreMenu(BuildContext context, CatalogProvider provider) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.discount_outlined, color: Color(0xFF1D4ED8)),
              title: const Text('Edit Discount'),
              subtitle: provider.billDiscount > 0
                  ? Text('Currently: ₹ ${_money.format(provider.billDiscount)}',
                      style: const TextStyle(fontSize: 12))
                  : null,
              onTap: () {
                Navigator.pop(ctx);
                _editDiscount(context, provider);
              },
            ),
            ListTile(
              leading: const Icon(Icons.receipt_long_outlined, color: Color(0xFF1D4ED8)),
              title: const Text('Edit Tax / GST'),
              subtitle: provider.billTax > 0
                  ? Text('Currently: ₹ ${_money.format(provider.billTax)}',
                      style: const TextStyle(fontSize: 12))
                  : null,
              onTap: () {
                Navigator.pop(ctx);
                _editTax(context, provider);
              },
            ),
            ListTile(
              leading: const Icon(Icons.share_outlined),
              title: const Text('Share Bill via WhatsApp / PDF'),
              onTap: () {
                Navigator.pop(ctx);
                BillPdfService.shareBill(provider.toPdfData());
              },
            ),
            ListTile(
              leading: const Icon(Icons.add_circle_outline, color: Color(0xFF16A34A)),
              title: const Text('Add New Product to Bill',
                  style: TextStyle(color: Color(0xFF16A34A))),
              onTap: () {
                Navigator.pop(ctx);
                _showAddNewProductDialog(provider);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_sweep_outlined, color: AppColors.red),
              title: const Text('Clear All Items', style: TextStyle(color: AppColors.red)),
              onTap: () {
                Navigator.pop(ctx);
                _confirmClearBill(context, provider);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _saveAndFinish(CatalogProvider provider) async {
    if (_saving) return;

    if (provider.billItems.isEmpty) {
      AnimatedFeedbackDialog.showValidationWarning(
        context: context,
        title: 'Validation Error',
        message: 'Please check the highlighted fields.',
        errors: const [
          'At least one product is required.',
          'Quantity must be greater than 0.',
          'Please select products from the catalogue above.',
        ],
      );
      return;
    }

    _syncPaymentReceived(provider);
    provider.setPaymentReference(_paymentRefCtrl.text.trim());
    provider.setPaymentRemarks(_remarksCtrl.text.trim());
    provider.setPaymentMethod(_selectedPaymentMode.toLowerCase());

    setState(() => _saving = true);

    final billsProvider = context.read<BillsProvider>();

    SavingBillProgressDialog.show(context);

    try {
      final pdfData = provider.toPdfData();
      final savedFiles = await BillPdfService.saveBillFiles(pdfData);

      if (!mounted) return;

      final billRecord = provider.toSavedBill();
      billRecord.pdfPath = savedFiles.pdfPath;
      billRecord.imagePath = savedFiles.imagePath;

      final savedBill = await billsProvider.addBill(
        billRecord,
        customerId: provider.selectedCustomer?.id,
        paymentMethod: provider.paymentMethod,
        billDiscount: provider.billDiscount,
      );

      final billTot = provider.finalBillTotal;
      final paid = provider.paymentReceived;
      final remaining = provider.remainingOutstanding;

      provider.startNewBill();

      if (mounted) {
        Navigator.of(context).pop(); // close saving progress dialog

        AppToast.showSuccess(
          context,
          title: 'Bill saved successfully!',
          subtitle: 'Invoice #${savedBill.billNumber}',
        );

        AnimatedFeedbackDialog.showSuccess(
          context: context,
          invoiceNumber: savedBill.billNumber,
          customerName: savedBill.customerName.isNotEmpty
              ? savedBill.customerName
              : 'Walk-in Customer',
          totalAmount: billTot,
          paidAmount: paid,
          dueAmount: remaining,
          onViewBill: () {
            Navigator.of(context).pop();
            AppNavigation.openBillDetails(context, bill: savedBill);
          },
          onContinueBilling: () {},
          onGoToBillList: () {
            Navigator.of(context).pop();
            AppNavigation.toTab(context, 1);
          },
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.of(context).pop();

        AppToast.showError(
          context,
          title: 'Failed to save bill.',
          subtitle: 'Please try again.',
        );

        final reason = e.toString().replaceFirst('Exception: ', '');
        AnimatedFeedbackDialog.showFailure(
          context: context,
          reason: reason,
          onRetry: () => _saveAndFinish(provider),
          onClose: () {},
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
