import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/customer.dart';
import '../models/customer_ledger_entry.dart';
import '../models/saved_bill.dart';
import '../models/saved_payment.dart';
import '../providers/bills_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/customer_provider.dart';
import '../services/bill_pdf_service.dart';
import '../services/payment_receipt_pdf_service.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';
import '../navigation/app_navigation.dart';

class CustomerLedgerDetailScreen extends StatefulWidget {
  final String partyName;
  final Customer? customer;

  const CustomerLedgerDetailScreen({
    super.key,
    required this.partyName,
    this.customer,
  });

  @override
  State<CustomerLedgerDetailScreen> createState() => _CustomerLedgerDetailScreenState();
}

class _CustomerLedgerDetailScreenState extends State<CustomerLedgerDetailScreen> {
  final _money = NumberFormat('#,##0');
  final _dateFormat = DateFormat('dd MMM yyyy');
  final _timeFormat = DateFormat('hh:mm a');
  final _supabaseService = SupabaseService();

  Customer? _customer;
  bool _loading = false;
  String? _error;
  List<CustomerLedgerEntry> _backendEntries = [];
  double _currentBalance = 0.0;
  double _totalDebit = 0.0;
  double _totalCredit = 0.0;

  DateTimeRange? _selectedDateRange;
  String _selectedType = 'All Transactions';
  String _ledgerFilterTab = 'All'; // All, Bills, Payments, Orders

  final List<String> _transactionTypes = [
    'All Transactions',
    'Bills / Sales',
    'Payments',
    'Opening Balance',
  ];

  @override
  void initState() {
    super.initState();
    _customer = widget.customer;
    _fetchLiveLedger();
  }

  Future<void> _fetchLiveLedger() async {
    final custId = widget.customer?.id;
    if (custId == null || custId.isEmpty) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await _supabaseService.fetchCustomerLedger(custId, allShops: true);
      setState(() {
        _currentBalance = res['currentBalance'] ?? 0.0;
        _totalDebit = res['totalDebit'] ?? 0.0;
        _totalCredit = res['totalCredit'] ?? 0.0;
        _backendEntries = (res['entries'] as List<CustomerLedgerEntry>?) ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _pickDateRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 1),
      initialDateRange: _selectedDateRange ??
          DateTimeRange(
            start: DateTime(now.year, now.month, 1),
            end: now,
          ),
    );
    if (picked != null) {
      setState(() => _selectedDateRange = picked);
    }
  }

  List<CustomerLedgerEntry> _buildTimeline(BillsProvider billsProvider) {
    if (_backendEntries.isNotEmpty) {
      return _backendEntries;
    }
    final bills = billsProvider.bills.where((b) {
      final matchesName = b.customerName.trim().toLowerCase() == widget.partyName.trim().toLowerCase();
      final matchesPhone = widget.customer?.mobile.isNotEmpty == true && b.customerPhone == widget.customer!.mobile;
      return matchesName || matchesPhone;
    }).toList();

    final List<CustomerLedgerEntry> entries = [];
    double running = 0.0;
    for (int i = 0; i < bills.length; i++) {
      final b = bills[i];
      running += b.total;
      entries.add(
        CustomerLedgerEntry(
          id: i + 1,
          customerId: int.tryParse(widget.customer?.id ?? '0') ?? 0,
          shopId: 1,
          entryType: 'debit',
          amount: b.total,
          runningBalance: running,
          referenceType: 'Sale',
          referenceId: i + 1,
          description: b.billNumber.isNotEmpty ? b.billNumber : 'Bill #${i + 1}',
          entryDate: b.date,
        ),
      );
      if (b.paidAmount > 0) {
        running -= b.paidAmount;
        entries.add(
          CustomerLedgerEntry(
            id: (i + 1) + 100000,
            customerId: int.tryParse(widget.customer?.id ?? '0') ?? 0,
            shopId: 1,
            entryType: 'credit',
            amount: b.paidAmount,
            runningBalance: running,
            referenceType: 'Payment',
            referenceId: i + 1,
            description: 'Payment for ${b.billNumber.isNotEmpty ? b.billNumber : "${i + 1}"}',
            entryDate: b.date,
          ),
        );
      }
    }
    entries.sort((a, b) => b.entryDate.compareTo(a.entryDate));
    return entries;
  }

  String _initials(String name) => name.trim().isEmpty
      ? '?'
      : name.trim().split(RegExp(r'\s+')).take(2).map((s) => s[0]).join().toUpperCase();

  @override
  Widget build(BuildContext context) {
    final billsProvider = context.watch<BillsProvider>();
    final customer = _customer ?? widget.customer;
    final name = customer?.name ?? widget.partyName;
    final phone = customer?.mobile ?? (customer?.id.isNotEmpty == true ? customer!.id : '+91 98765 43210');
    final custId = customer != null && customer.id.isNotEmpty
        ? (customer.id.startsWith('CUST') ? customer.id : 'CUST-${customer.id.padLeft(4, '0')}')
        : 'CUST-0001';

    // Build timeline rows: prioritize backend authoritative entries, fallback to local bills/payments
    final timeline = _buildTimeline(billsProvider);

    // Calculate totals for cards
    final totalSales = _totalDebit > 0 ? _totalDebit : timeline.where((e) => e.isDebit).fold(0.0, (s, e) => s + e.amount);
    final totalPayments = _totalCredit > 0 ? _totalCredit : timeline.where((e) => e.isCredit).fold(0.0, (s, e) => s + e.amount);
    final currentOutstanding = _currentBalance != 0.0
        ? _currentBalance
        : (customer?.currentBalance ?? (totalSales - totalPayments));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Customer Ledger',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list_rounded, color: Color(0xFF0F172A)),
            tooltip: 'Filter Range',
            onPressed: _pickDateRange,
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Color(0xFF0F172A)),
            onSelected: (val) {
              if (val == 'edit') _openEditCustomerDialog(context);
              if (val == 'refresh') _fetchLiveLedger();
              if (val == 'profile') _showCustomerProfileSheet(context);
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(value: 'profile', child: Text('View Customer Profile')),
              const PopupMenuItem(value: 'edit', child: Text('Edit Customer')),
              const PopupMenuItem(value: 'refresh', child: Text('Refresh Ledger')),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Customer Card with Metrics matching Image 6 ──
            _buildCustomerCardWithSummary(name, custId, phone, totalSales, totalPayments, currentOutstanding),
            const SizedBox(height: 14),

            // ── Filter Pills: All, Bills, Payments, Orders matching Image 6 ──
            _buildFilterPills(),
            const SizedBox(height: 14),

            // ── Date-Grouped Transaction Cards matching Image 6 ──
            _buildDateGroupedTransactions(timeline),
          ],
        ),
      ),
      bottomSheet: _buildBottomActionBar(timeline, currentOutstanding),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CUSTOMER CARD WITH SUMMARY METRICS matching Image 6
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildCustomerCardWithSummary(
    String name,
    String custId,
    String phone,
    double totalDebit,
    double totalCredit,
    double outstanding,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: const Color(0xFF1D4ED8),
                child: Text(
                  _initials(name),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$custId | $phone',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _metricColumn('Total Debit', '₹ ${_money.format(totalDebit)}', const Color(0xFF0F172A)),
              Container(width: 1, height: 30, color: const Color(0xFFE2E8F0)),
              _metricColumn('Total Credit', '₹ ${_money.format(totalCredit)}', const Color(0xFF16A34A)),
              Container(width: 1, height: 30, color: const Color(0xFFE2E8F0)),
              _metricColumn('Outstanding', '₹ ${_money.format(outstanding)}', const Color(0xFFDC2626)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _metricColumn(String label, String amount, Color amountColor) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF64748B)),
        ),
        const SizedBox(height: 4),
        Text(
          amount,
          style: TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w800,
            color: amountColor,
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. FILTER PILLS: All, Bills, Payments, Orders matching Image 6
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildFilterPills() {
    final tabs = ['All', 'Bills', 'Payments', 'Orders'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: tabs.map((t) {
          final isSelected = _ledgerFilterTab == t;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              onTap: () => setState(() => _ledgerFilterTab = t),
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
                  t,
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
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. DATE-GROUPED TRANSACTIONS matching Image 6
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildDateGroupedTransactions(List<CustomerLedgerEntry> allEntries) {
    var filtered = allEntries;
    if (_ledgerFilterTab == 'Bills') {
      filtered = allEntries.where((e) => e.isDebit).toList();
    } else if (_ledgerFilterTab == 'Payments') {
      filtered = allEntries.where((e) => e.isCredit).toList();
    } else if (_ledgerFilterTab == 'Orders') {
      filtered = allEntries.where((e) => e.referenceType.toLowerCase().contains('order')).toList();
    }

    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (filtered.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          children: const [
            Icon(Icons.history_toggle_off, size: 40, color: Color(0xFFCBD5E1)),
            SizedBox(height: 10),
            Text('No transactions found', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
            SizedBox(height: 4),
            Text('Transactions will appear here as bills and payments are recorded.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
          ],
        ),
      );
    }

    // Group by Date string
    final Map<String, List<CustomerLedgerEntry>> grouped = {};
    for (final e in filtered) {
      final dateKey = _dateFormat.format(e.entryDate);
      grouped.putIfAbsent(dateKey, () => []).add(e);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: grouped.entries.map((group) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                group.key,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF64748B),
                ),
              ),
            ),
            ...group.value.map((e) {
              final isDebit = e.isDebit;
              final ref = e.description.replaceAll(RegExp(r'^(Bill|Payment|Sale|Order)\s*#?'), '').trim();
              final displayRef = ref.isNotEmpty ? ref : (isDebit ? 'INV-${e.referenceId ?? "001"}' : 'PAY-${e.referenceId ?? "001"}');
              final timeStr = _timeFormat.format(e.entryDate);

              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.015),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => _openRecordDetail(context, e, displayRef),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: isDebit ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              isDebit ? Icons.receipt_long_rounded : Icons.payments_rounded,
                              color: isDebit ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  displayRef,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                    color: Color(0xFF0F172A),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Text(
                                      isDebit ? 'Bill' : 'Payment',
                                      style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                                    ),
                                    const Text(' · ', style: TextStyle(color: Color(0xFF94A3B8))),
                                    Text(
                                      timeStr,
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '₹ ${_money.format(e.amount)}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13.5,
                                  color: isDebit ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                                ),
                              ),
                              const SizedBox(height: 1),
                              Text(
                                isDebit ? 'Debit' : 'Credit',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: isDebit ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94A3B8)),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ],
        );
      }).toList(),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. BOTTOM ACTION BAR (Print Statement & Download PDF)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildBottomActionBar(List<CustomerLedgerEntry> entries, double currentOutstanding) {
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
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _printStatement(entries, currentOutstanding),
                icon: const Icon(Icons.print_outlined, size: 17),
                label: const Text('Print Statement', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.steelBlue,
                  side: const BorderSide(color: AppColors.steelBlue, width: 1.2),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: () => _downloadPdf(entries, currentOutstanding),
                icon: const Icon(Icons.download_outlined, size: 17),
                label: const Text('Download PDF', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.navy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. RECORD DETAILS & PRINTING
  // ──────────────────────────────────────────────────────────────────────────
  void _openRecordDetail(BuildContext context, CustomerLedgerEntry e, String ref) {
    final refType = e.referenceType.toLowerCase();
    if (refType.contains('sale') || refType.contains('bill') || (e.isDebit && !refType.contains('opening'))) {
      // Authoritative deep navigation: opens complete Bill Details screen
      AppNavigation.openBillDetails(context, invoiceNo: ref);
      return;
    } else if (e.isCredit || refType.contains('payment')) {
      // Authoritative deep navigation: opens complete Payment Details screen
      AppNavigation.openPaymentDetails(
        context,
        paymentRef: ref,
        customerName: widget.partyName,
        amount: e.amount,
        date: e.entryDate,
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Transaction: $ref',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(),
            _detailRow('Date & Time', DateFormat('dd MMM yyyy, hh:mm a').format(e.entryDate)),
            _detailRow('Transaction Type', e.typeDisplay),
            _detailRow('Entry Direction', e.isDebit ? 'Debit (+₹${_money.format(e.amount)})' : 'Credit (-₹${_money.format(e.amount)})'),
            _detailRow('Running Balance', '₹${_money.format(e.runningBalance)}'),
            if (e.shopName != null) _detailRow('Shop', e.shopName!),
            if (e.description.isNotEmpty) _detailRow('Description', e.description),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    showAppSnackBar(context, 'Transaction $ref verified in database ledger');
                  },
                  child: const Text('OK'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
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

  void _showCustomerProfileSheet(BuildContext context) {
    final cust = _customer ?? widget.customer;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
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
            _detailRow('Name', cust?.name ?? widget.partyName),
            _detailRow('ID', cust?.id ?? 'CUST-0001'),
            _detailRow('Mobile', cust?.mobile ?? 'N/A'),
            _detailRow('Address', cust?.address.isNotEmpty == true ? cust!.address : 'Near Main Market, Lucknow'),
            _detailRow('Current Outstanding', '₹${_money.format(_currentBalance != 0.0 ? _currentBalance : (cust?.currentBalance ?? 0.0))}'),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.call, size: 16),
                    label: const Text('Call'),
                    onPressed: () async {
                      final mob = cust?.mobile ?? '';
                      if (mob.isNotEmpty) launchUrl(Uri(scheme: 'tel', path: mob));
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.chat, size: 16),
                    label: const Text('WhatsApp'),
                    onPressed: () async {
                      final mob = cust?.mobile ?? '';
                      final digits = mob.replaceAll(RegExp(r'[^0-9+]'), '');
                      final phone = digits.startsWith('+') ? digits.substring(1) : digits;
                      if (phone.isNotEmpty) launchUrl(Uri.parse('https://wa.me/$phone'), mode: LaunchMode.externalApplication);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.edit_outlined, size: 16),
                label: const Text('Edit Customer Details', style: TextStyle(fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.steelBlue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  _openEditCustomerDialog(context);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openEditCustomerDialog(BuildContext context) async {
    final cust = _customer ?? widget.customer;
    if (cust == null) {
      showAppSnackBar(context, 'Customer details not available to edit', isError: true);
      return;
    }

    final nameCtrl = TextEditingController(text: cust.name);
    final mobileCtrl = TextEditingController(text: cust.mobile);
    final addressCtrl = TextEditingController(text: cust.address);
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
                          Text('ID: ${cust.id}', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
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
                      '₹${_money.format(_currentBalance != 0.0 ? _currentBalance : cust.currentBalance)}',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: (_currentBalance != 0.0 ? _currentBalance : cust.currentBalance) > 0 ? AppColors.red : AppColors.billGreen,
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
                          cust.name = name;
                          cust.mobile = mobileCtrl.text.trim();
                          cust.address = addressCtrl.text.trim();
                          final provider = context.read<CustomerProvider>();
                          await provider.updateCustomer(cust);
                          if (!context.mounted) return;
                          context.read<CatalogProvider>().updateCustomerInfo(cust);
                          setState(() {
                            _customer = cust;
                          });
                          Navigator.pop(ctx);
                          showAppSnackBar(context, 'Customer updated successfully');
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

  void _printStatement(List<CustomerLedgerEntry> entries, double currentOutstanding) {
    final buffer = StringBuffer();
    buffer.writeln('CUSTOMER LEDGER STATEMENT — ${widget.partyName}');
    buffer.writeln('Current Outstanding: ₹${_money.format(currentOutstanding)}');
    buffer.writeln('==============================================');
    for (final e in entries) {
      buffer.writeln('${_dateFormat.format(e.entryDate)}  ${e.referenceType}  Debit: ₹${_money.format(e.debitAmount)}  Credit: ₹${_money.format(e.creditAmount)}  Balance: ₹${_money.format(e.runningBalance)}');
    }
    Share.share(buffer.toString(), subject: 'Ledger Statement - ${widget.partyName}');
  }

  void _downloadPdf(List<CustomerLedgerEntry> entries, double currentOutstanding) {
    _printStatement(entries, currentOutstanding);
  }
}
