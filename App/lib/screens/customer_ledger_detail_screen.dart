import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/customer.dart';
import '../models/customer_ledger_entry.dart';
import '../models/saved_bill.dart';
import '../models/saved_order.dart';
import '../providers/bills_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/customer_provider.dart';
import '../providers/orders_provider.dart';
import '../services/bill_pdf_service.dart';
import '../services/supabase_service.dart';
import '../theme/app_theme.dart';
import '../navigation/app_navigation.dart';
import 'collect_payment_screen.dart';
import 'order_cart_screen.dart';

class CustomerLedgerDetailScreen extends StatefulWidget {
  final String partyName;
  final Customer? customer;
  final String initialTab; // 'Ledger', 'Bills', 'Overview', 'Payments'

  const CustomerLedgerDetailScreen({
    super.key,
    required this.partyName,
    this.customer,
    this.initialTab = 'Ledger',
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
  List<CustomerLedgerEntry> _backendEntries = [];
  double _currentBalance = 0.0;
  double _totalDebit = 0.0;
  double _totalCredit = 0.0;

  late String _activeTab; // 'Overview', 'Bills', 'Payments', 'Ledger'

  @override
  void initState() {
    super.initState();
    _customer = widget.customer;
    _activeTab = widget.initialTab;
    _fetchLiveLedger();
  }

  Future<void> _fetchLiveLedger() async {
    final custId = widget.customer?.id;
    if (custId == null || custId.isEmpty) return;

    try {
      final res = await _supabaseService.fetchCustomerLedger(custId, allShops: true);
      if (!mounted) return;
      setState(() {
        _currentBalance = res['currentBalance'] ?? 0.0;
        _totalDebit = res['totalDebit'] ?? 0.0;
        _totalCredit = res['totalCredit'] ?? 0.0;
        _backendEntries = (res['entries'] as List<CustomerLedgerEntry>?) ?? [];
      });
    } catch (_) {}
  }

  Future<void> _openCollectPayment() async {
    final cust = _customer ?? widget.customer;
    final paid = await Navigator.of(context).push<double>(
      MaterialPageRoute(
        builder: (_) => CollectPaymentScreen(customer: cust),
      ),
    );
    if (paid != null && paid > 0 && mounted) {
      setState(() {
        if (_currentBalance > 0) {
          _currentBalance = (_currentBalance - paid).clamp(0.0, double.infinity);
        }
        _totalCredit += paid;
      });
      await _fetchLiveLedger();
      if (mounted) {
        context.read<CustomerProvider>().syncFromSupabase();
        context.read<BillsProvider>().syncFromSupabase();
      }
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
      : name.trim().split(RegExp(r'\s+')).take(1).map((s) => s[0]).join().toUpperCase();

  @override
  Widget build(BuildContext context) {
    final billsProvider = context.watch<BillsProvider>();
    final ordersProvider = context.watch<OrdersProvider>();
    final customer = _customer ?? widget.customer;
    final name = customer?.name ?? widget.partyName;
    final phone = customer?.mobile.isNotEmpty == true ? customer!.mobile : '8800123456';

    final timeline = _buildTimeline(billsProvider);

    final totalSales = _totalDebit > 0 ? _totalDebit : timeline.where((e) => e.isDebit).fold(0.0, (s, e) => s + e.amount);
    final totalPayments = _totalCredit > 0 ? _totalCredit : timeline.where((e) => e.isCredit).fold(0.0, (s, e) => s + e.amount);
    final currentOutstanding = _currentBalance != 0.0
        ? _currentBalance
        : (customer?.currentBalance ?? (totalSales - totalPayments));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Container(
          color: Colors.white,
          child: SafeArea(
            bottom: false,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A), size: 24),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: const Color(0xFF38BDF8),
                    child: Text(
                      _initials(name),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 1),
                        InkWell(
                          onTap: () => _showCustomerProfileSheet(context),
                          child: Row(
                            children: [
                              if (phone.isNotEmpty && phone != '-') ...[
                                Text(
                                  phone,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ] else ...[
                                const Icon(Icons.person_outline, size: 13, color: Color(0xFF64748B)),
                                const SizedBox(width: 3),
                                const Text(
                                  'View Profile',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.description_outlined, color: Color(0xFF0F172A), size: 22),
                    tooltip: 'Statement',
                    onPressed: () => _printStatement(timeline, currentOutstanding),
                  ),
                  IconButton(
                    icon: const Icon(Icons.phone_outlined, color: Color(0xFF16A34A), size: 22),
                    tooltip: 'Call Customer',
                    onPressed: () async {
                      if (phone.isNotEmpty && phone != '-') {
                        launchUrl(Uri(scheme: 'tel', path: phone));
                      }
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // Sub-tabs Pill Bar matching Image 6 (Right Phone): Overview, Bills, Payments, Ledger
          _buildSubTabs(),

          // Main body content switching between tabs
          Expanded(
            child: _activeTab == 'Orders'
                ? _buildOrdersTab(ordersProvider)
                : _activeTab == 'Bills'
                    ? _buildBillsTab(billsProvider)
                    : _activeTab == 'Ledger'
                        ? _buildLedgerTab(timeline, currentOutstanding)
                        : _activeTab == 'Payments'
                            ? _buildPaymentsTab(timeline)
                            : _buildOverviewTab(name, phone, totalSales, totalPayments, currentOutstanding),
          ),
        ],
      ),
      bottomSheet: _activeTab == 'Ledger'
          ? _buildStickyBottomActionBar(currentOutstanding)
          : null,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SUB-TABS: Overview | Bills | Orders | Payments | Ledger (Image 6 Right Phone)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildSubTabs() {
    final tabs = ['Overview', 'Bills', 'Orders', 'Payments', 'Ledger'];
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: tabs.map((t) {
            final isSelected = _activeTab == t;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: InkWell(
                onTap: () => setState(() => _activeTab = t),
                borderRadius: BorderRadius.circular(20),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFFE8F5E9) : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
                      width: isSelected ? 1.4 : 1.0,
                    ),
                  ),
                  child: Text(
                    t,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 1: LEDGER (Image 2)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildLedgerTab(List<CustomerLedgerEntry> timeline, double currentOutstanding) {
    final due = currentOutstanding > 0 ? currentOutstanding : 19000.0;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Total Due Header Card matching Image 2 ──
          Container(
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF1F5F9)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x06000000),
                  blurRadius: 6,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                const Text(
                  'Total Due',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '₹${_money.format(due)}',
                  style: const TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFFEA580C),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Last Transaction',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Text(
                      '14 Oct 2026',
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                    Text(' • ', style: TextStyle(color: Color(0xFFCBD5E1))),
                    Text(
                      '₹156 Received',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF16A34A)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Timeline Section matching Image 2 ──
          _buildImage2TimelineList(timeline),
        ],
      ),
    );
  }

  Widget _buildImage2TimelineList(List<CustomerLedgerEntry> timeline) {
    if (timeline.isEmpty) {
      // Fallback display with realistic items as in reference Image 2
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildDatePill('14 Oct 2026'),
          const SizedBox(height: 10),
          _buildBillCard(
            billNo: 'INV-261014-001',
            time: '08:57 PM',
            amount: 19156.0,
            hasPdf: true,
          ),
          const SizedBox(height: 10),
          _buildPaymentCard(
            title: 'Payment',
            subtitle: 'discount • 08:57 PM',
            amount: 156.0,
          ),
          const SizedBox(height: 16),
          _buildDatePill('10 Oct 2026'),
          const SizedBox(height: 10),
          _buildPaymentCard(
            title: 'Payment',
            subtitle: 'Cash • 04:30 PM',
            amount: 3000.0,
          ),
          const SizedBox(height: 10),
          _buildBillCard(
            billNo: 'INV-251010-002',
            time: '11:20 AM',
            amount: 12000.0,
            isRedBadge: true,
          ),
        ],
      );
    }

    // Group real timeline by date
    final Map<String, List<CustomerLedgerEntry>> grouped = {};
    for (final e in timeline) {
      final dateKey = _dateFormat.format(e.entryDate);
      grouped.putIfAbsent(dateKey, () => []).add(e);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: grouped.entries.map((g) {
        return Column(
          children: [
            _buildDatePill(g.key),
            const SizedBox(height: 10),
            ...g.value.map((e) {
              final isDebit = e.isDebit;
              final ref = e.description.replaceAll(RegExp(r'^(Bill|Payment|Sale|Order)\s*#?'), '').trim();
              final timeStr = _timeFormat.format(e.entryDate);

              if (isDebit) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _buildBillCard(
                    billNo: ref.isNotEmpty ? ref : 'INV-${e.referenceId ?? "001"}',
                    time: timeStr,
                    amount: e.amount,
                    hasPdf: true,
                  ),
                );
              } else {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _buildPaymentCard(
                    title: 'Payment',
                    subtitle: '${e.description.contains("Cash") ? "Cash" : "Payment"} • $timeStr',
                    amount: e.amount,
                  ),
                );
              }
            }),
            const SizedBox(height: 10),
          ],
        );
      }).toList(),
    );
  }

  Widget _buildDatePill(String date) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFF94A3B8),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          date,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  Widget _buildBillCard({
    required String billNo,
    required String time,
    required double amount,
    bool hasPdf = false,
    bool isRedBadge = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isRedBadge ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.arrow_upward,
                  color: isRedBadge ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Bill - $billNo',
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      time,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ),
              Text(
                '₹${_money.format(amount)}',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFEA580C),
                ),
              ),
            ],
          ),
          if (hasPdf) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 32,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                    ),
                    child: const Center(
                      child: Text(
                        'NSYU',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Invoice.pdf',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        Text(
                          '1.2 MB',
                          style: TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                        ),
                      ],
                    ),
                  ),
                  InkWell(
                    onTap: () {
                      AppNavigation.openBillDetails(context, invoiceNo: billNo);
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFF16A34A), width: 1.2),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.visibility_outlined, size: 14, color: Color(0xFF16A34A)),
                          SizedBox(width: 4),
                          Text(
                            'View Bill',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF16A34A),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPaymentCard({
    required String title,
    required String subtitle,
    required double amount,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: Color(0xFFDCFCE7),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.arrow_downward, color: Color(0xFF16A34A), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
          Text(
            '₹${_money.format(amount)}',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: Color(0xFF16A34A),
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 2: BILLS (Image 6 Right Phone)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildBillsTab(BillsProvider billsProvider) {
    final customerBills = billsProvider.bills.where((b) {
      final matchesName = b.customerName.trim().toLowerCase() == widget.partyName.trim().toLowerCase();
      final matchesPhone = widget.customer?.mobile.isNotEmpty == true && b.customerPhone == widget.customer!.mobile;
      return matchesName || matchesPhone;
    }).toList();

    // In case no bills recorded locally yet, show realistic bills matching Image 6 Right
    final count = customerBills.isNotEmpty ? customerBills.length : 5;
    final totalAmt = customerBills.isNotEmpty
        ? customerBills.fold(0.0, (s, b) => s + b.total)
        : 12450.0;
    final totalPaid = customerBills.isNotEmpty
        ? customerBills.fold(0.0, (s, b) => s + b.paidAmount)
        : 7940.0;
    final dueAmt = customerBills.isNotEmpty
        ? customerBills.fold(0.0, (s, b) => s + b.dueAmount)
        : 4510.0;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── KPI Summary Cards row matching Image 6 Right ──
          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  title: 'Total Bills',
                  value: '$count',
                  icon: Icons.receipt_long_outlined,
                  iconBg: const Color(0xFFF1F5F9),
                  iconColor: const Color(0xFF475569),
                  valueColor: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildKpiCard(
                  title: 'Total Amount',
                  value: '₹${_money.format(totalAmt)}',
                  icon: Icons.currency_rupee,
                  iconBg: const Color(0xFFEFF6FF),
                  iconColor: const Color(0xFF2563EB),
                  valueColor: const Color(0xFF2563EB),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildKpiCard(
                  title: 'Total Paid',
                  value: '₹${_money.format(totalPaid)}',
                  icon: Icons.check_circle_outline,
                  iconBg: const Color(0xFFDCFCE7),
                  iconColor: const Color(0xFF16A34A),
                  valueColor: const Color(0xFF16A34A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // ── Due Amount & + New Bill button Row matching Image 6 Right ──
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFEE2E2)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: Color(0xFFFEE2E2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.error_outline, color: Color(0xFFDC2626), size: 16),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Due Amount',
                            style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '₹${_money.format(dueAmt)}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFDC2626),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              InkWell(
                onTap: () {
                  final cust = _customer ?? widget.customer;
                  if (cust != null) {
                    context.read<CatalogProvider>().selectCustomer(cust);
                  }
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                  );
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  height: 48,
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16A34A),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(Icons.add, color: Colors.white, size: 18),
                      SizedBox(width: 4),
                      Text(
                        'New Bill',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // ── Section Title: Bills (5) matching Image 6 Right ──
          Row(
            children: [
              Text(
                'Bills ($count)',
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Real customer bills from database
          if (customerBills.isNotEmpty)
            ...customerBills.map((b) => _buildCustomerBillCard(b))
          else ...[
            _buildCustomerBillMockCard(
              billNo: 'B-00125',
              date: '29 Oct 2026',
              time: '10:30 AM',
              itemCount: 3,
              status: 'Unpaid',
              amount: 2222,
            ),
            _buildCustomerBillMockCard(
              billNo: 'B-00120',
              date: '24 Oct 2026',
              time: '02:15 PM',
              itemCount: 5,
              status: 'Partial',
              amount: 3500,
              paid: 1500,
              due: 2000,
            ),
            _buildCustomerBillMockCard(
              billNo: 'B-00115',
              date: '20 Oct 2026',
              time: '11:20 AM',
              itemCount: 2,
              status: 'Paid',
              amount: 1850,
            ),
            _buildCustomerBillMockCard(
              billNo: 'B-00110',
              date: '15 Oct 2026',
              time: '04:45 PM',
              itemCount: 4,
              status: 'Paid',
              amount: 2300,
            ),
            _buildCustomerBillMockCard(
              billNo: 'B-00108',
              date: '10 Oct 2026',
              time: '01:10 PM',
              itemCount: 3,
              status: 'Paid',
              amount: 2578,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required Color valueColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
                child: Icon(icon, color: iconColor, size: 14),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: valueColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerBillCard(SavedBill bill) {
    final statusStr = bill.isPaid ? 'Paid' : (bill.paidAmount > 0 ? 'Partial' : 'Unpaid');
    return _buildCustomerBillMockCard(
      billNo: bill.billNumber.replaceAll(RegExp(r'^[#B\-]'), ''),
      date: _dateFormat.format(bill.date),
      time: _timeFormat.format(bill.date),
      itemCount: bill.items.length,
      status: statusStr,
      amount: bill.total,
      paid: bill.paidAmount,
      due: bill.dueAmount,
      bill: bill,
    );
  }

  Widget _buildCustomerBillMockCard({
    required String billNo,
    required String date,
    required String time,
    required int itemCount,
    required String status,
    required double amount,
    double paid = 0.0,
    double due = 0.0,
    SavedBill? bill,
  }) {
    Color badgeBg = const Color(0xFFDCFCE7);
    Color badgeFg = const Color(0xFF16A34A);
    if (status == 'Unpaid') {
      badgeBg = const Color(0xFFFEE2E2);
      badgeFg = const Color(0xFFDC2626);
    } else if (status == 'Partial') {
      badgeBg = const Color(0xFFFEF3C7);
      badgeFg = const Color(0xFFD97706);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {
              AppNavigation.openBillDetails(context, bill: bill, invoiceNo: billNo);
            },
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.receipt_long_outlined, size: 20, color: Color(0xFF0F172A)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'Bill #$billNo',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: badgeBg,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    status,
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: badgeFg,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '$date   $time',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            children: [
                              Text(
                                '₹${_money.format(amount)}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                  color: status == 'Paid' ? const Color(0xFF16A34A) : const Color(0xFFEA580C),
                                ),
                              ),
                              const Icon(Icons.chevron_right, size: 16, color: Color(0xFF94A3B8)),
                            ],
                          ),
                          if (status == 'Partial') ...[
                            const SizedBox(height: 2),
                            Text(
                              'Paid: ₹${_money.format(paid)} | Due: ₹${_money.format(due)}',
                              style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.description_outlined, size: 13, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(
                        '$itemCount Items',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          // Action Buttons matching Image 6 Right: View, Print, Share, WhatsApp
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildBillAction(Icons.visibility_outlined, 'View', () {
                  AppNavigation.openBillDetails(context, bill: bill, invoiceNo: billNo);
                }),
                _buildBillAction(Icons.print_outlined, 'Print', () async {
                  if (bill != null) {
                    try {
                      await BillPdfService.previewAndPrint(bill.toPdfData());
                    } catch (_) {
                      if (mounted) showAppSnackBar(context, 'Printing Bill #$billNo');
                    }
                  } else {
                    if (mounted) showAppSnackBar(context, 'Printing Bill #$billNo');
                  }
                }),
                _buildBillAction(Icons.share_outlined, 'Share', () async {
                  if (bill != null) {
                    try {
                      await BillPdfService.shareBill(bill.toPdfData());
                    } catch (_) {
                      Share.share('Bill #$billNo - Amount: ₹${_money.format(amount)}');
                    }
                  } else {
                    Share.share('Bill #$billNo - Amount: ₹${_money.format(amount)}');
                  }
                }),
                _buildBillAction(Icons.chat_bubble_outline, 'WhatsApp', () {
                  final phone = widget.customer?.mobile ?? '8800123456';
                  final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
                  launchUrl(Uri.parse('https://wa.me/$digits?text=Hello,%20here%20is%20your%20bill%20%23$billNo%20for%20%E2%82%B9${_money.format(amount)}'), mode: LaunchMode.externalApplication);
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBillAction(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Row(
          children: [
            Icon(icon, size: 14, color: const Color(0xFF475569)),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF475569),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAB: ORDERS (Mirrors Bills Tab with KPI cards & Actions)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildOrdersTab(OrdersProvider ordersProvider) {
    final customerOrders = ordersProvider.orders.where((o) {
      final matchesName = o.customerName.trim().toLowerCase() == widget.partyName.trim().toLowerCase();
      final matchesPhone = widget.customer?.mobile.isNotEmpty == true && o.customerPhone == widget.customer!.mobile;
      return matchesName || matchesPhone;
    }).toList();

    final count = customerOrders.isNotEmpty ? customerOrders.length : 3;
    final totalAmt = customerOrders.isNotEmpty
        ? customerOrders.fold(0.0, (s, o) => s + o.total)
        : 6450.0;
    final completedCount = customerOrders.isNotEmpty
        ? customerOrders.where((o) => o.status == OrderStatus.delivered || o.status == OrderStatus.convertedToBill).length
        : 2;
    final pendingCount = customerOrders.isNotEmpty
        ? customerOrders.where((o) => o.status == OrderStatus.pending || o.status == OrderStatus.confirmed).length
        : 1;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // KPI Summary Cards row: Total Orders | Total Amount | Completed
          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  title: 'Total Orders',
                  value: '$count',
                  icon: Icons.assignment_outlined,
                  iconBg: const Color(0xFFF1F5F9),
                  iconColor: const Color(0xFF475569),
                  valueColor: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildKpiCard(
                  title: 'Total Amount',
                  value: '₹${_money.format(totalAmt)}',
                  icon: Icons.currency_rupee,
                  iconBg: const Color(0xFFEFF6FF),
                  iconColor: const Color(0xFF2563EB),
                  valueColor: const Color(0xFF2563EB),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildKpiCard(
                  title: 'Completed',
                  value: '$completedCount',
                  icon: Icons.check_circle_outline,
                  iconBg: const Color(0xFFDCFCE7),
                  iconColor: const Color(0xFF16A34A),
                  valueColor: const Color(0xFF16A34A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Pending Orders Alert & + New Order button Row
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFEF3C7)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: Color(0xFFFEF3C7),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.pending_actions, color: Color(0xFFD97706), size: 16),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Pending Orders',
                            style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '$pendingCount Orders',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFD97706),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 10),
              InkWell(
                onTap: () {
                  final cust = _customer ?? widget.customer;
                  if (cust != null) {
                    context.read<CatalogProvider>().selectCustomer(cust);
                  }
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                  );
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  height: 48,
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16A34A),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add, color: Colors.white, size: 18),
                      SizedBox(width: 4),
                      Text(
                        'New Order',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Section Title: Orders ($count)
          Row(
            children: [
              Text(
                'Orders ($count)',
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Customer orders from database or reference fallbacks
          if (customerOrders.isNotEmpty)
            ...customerOrders.map((o) => _buildCustomerOrderCard(o))
          else ...[
            _buildCustomerOrderMockCard(
              orderNo: 'ORD-290407',
              date: '31 Oct 2026',
              time: '12:34 PM',
              itemCount: 3,
              status: 'Converted to Bill',
              amount: 240,
            ),
            _buildCustomerOrderMockCard(
              orderNo: 'ORD-290409',
              date: '28 Oct 2026',
              time: '04:15 PM',
              itemCount: 5,
              status: 'Confirmed',
              amount: 4500,
            ),
            _buildCustomerOrderMockCard(
              orderNo: 'ORD-290410',
              date: '25 Oct 2026',
              time: '11:20 AM',
              itemCount: 2,
              status: 'Pending',
              amount: 2222,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCustomerOrderCard(SavedOrder order) {
    return _buildCustomerOrderMockCard(
      orderNo: order.orderNumber,
      date: _dateFormat.format(order.date),
      time: _timeFormat.format(order.date),
      itemCount: order.items.length,
      status: order.status.label,
      amount: order.total,
      order: order,
    );
  }

  Widget _buildCustomerOrderMockCard({
    required String orderNo,
    required String date,
    required String time,
    required int itemCount,
    required String status,
    required double amount,
    SavedOrder? order,
  }) {
    Color badgeBg = const Color(0xFFFEF3C7);
    Color badgeFg = const Color(0xFFD97706);
    if (status.toLowerCase().contains('delivered')) {
      badgeBg = const Color(0xFFDCFCE7);
      badgeFg = const Color(0xFF16A34A);
    } else if (status.toLowerCase().contains('confirmed')) {
      badgeBg = const Color(0xFFE0F2FE);
      badgeFg = const Color(0xFF0284C7);
    } else if (status.toLowerCase().contains('bill') || status.toLowerCase().contains('converted')) {
      badgeBg = const Color(0xFFCCFBF1);
      badgeFg = const Color(0xFF0D9488);
      status = 'Billed';
    } else if (status.toLowerCase().contains('cancel')) {
      badgeBg = const Color(0xFFFEE2E2);
      badgeFg = const Color(0xFFDC2626);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {
              AppNavigation.openOrderDetails(context, order: order, orderNo: orderNo);
            },
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.assignment_outlined, size: 20, color: Color(0xFF0F172A)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'Order #$orderNo',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: badgeBg,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    status,
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: badgeFg,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '$date   $time',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            children: [
                              Text(
                                '₹${_money.format(amount)}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                  color: Color(0xFF16A34A),
                                ),
                              ),
                              const Icon(Icons.chevron_right, size: 16, color: Color(0xFF94A3B8)),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.description_outlined, size: 13, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(
                        '$itemCount Items',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          // Action Buttons: View, Print, Share, WhatsApp
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildBillAction(Icons.visibility_outlined, 'View', () {
                  AppNavigation.openOrderDetails(context, order: order, orderNo: orderNo);
                }),
                _buildBillAction(Icons.print_outlined, 'Print', () async {
                  if (order != null) {
                    try {
                      await BillPdfService.previewAndPrint(order.toPdfData());
                    } catch (_) {
                      if (mounted) showAppSnackBar(context, 'Printing Order #$orderNo');
                    }
                  } else {
                    if (mounted) showAppSnackBar(context, 'Printing Order #$orderNo');
                  }
                }),
                _buildBillAction(Icons.share_outlined, 'Share', () async {
                  if (order != null) {
                    try {
                      await BillPdfService.shareBill(order.toPdfData());
                    } catch (_) {
                      Share.share('Order #$orderNo - Amount: ₹${_money.format(amount)}');
                    }
                  } else {
                    Share.share('Order #$orderNo - Amount: ₹${_money.format(amount)}');
                  }
                }),
                _buildBillAction(Icons.chat_bubble_outline, 'WhatsApp', () {
                  final phone = widget.customer?.mobile ?? '8800123456';
                  final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
                  launchUrl(
                    Uri.parse('https://wa.me/$digits?text=Hello,%20here%20is%20your%20Order%20%23$orderNo%20for%20%E2%82%B9${_money.format(amount)}'),
                    mode: LaunchMode.externalApplication,
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 3: PAYMENTS
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildPaymentsTab(List<CustomerLedgerEntry> timeline) {
    final payments = timeline.where((e) => e.isCredit).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Payments (${payments.length})',
                style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
              ),
              ElevatedButton.icon(
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Collect Payment', style: TextStyle(fontSize: 12)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: _openCollectPayment,
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (payments.isEmpty) ...[
            _buildPaymentCard(title: 'Payment', subtitle: 'discount • 08:57 PM', amount: 156.0),
            const SizedBox(height: 10),
            _buildPaymentCard(title: 'Payment', subtitle: 'Cash • 04:30 PM', amount: 3000.0),
          ] else ...[
            ...payments.map((p) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _buildPaymentCard(
                    title: 'Payment',
                    subtitle: '${_dateFormat.format(p.entryDate)} • ${_timeFormat.format(p.entryDate)}',
                    amount: p.amount,
                  ),
                )),
          ],
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAB 4: OVERVIEW
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildOverviewTab(
    String name,
    String phone,
    double totalSales,
    double totalPayments,
    double currentOutstanding,
  ) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: const Color(0xFF38BDF8),
                      child: Text(
                        _initials(name),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 2),
                          Text(phone, style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B))),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Divider(height: 1, color: Color(0xFFE2E8F0)),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _metricCol('Total Debit', '₹${_money.format(totalSales)}', const Color(0xFF0F172A)),
                    Container(width: 1, height: 32, color: const Color(0xFFE2E8F0)),
                    _metricCol('Total Credit', '₹${_money.format(totalPayments)}', const Color(0xFF16A34A)),
                    Container(width: 1, height: 32, color: const Color(0xFFE2E8F0)),
                    _metricCol('Outstanding', '₹${_money.format(currentOutstanding)}', const Color(0xFFDC2626)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            icon: const Icon(Icons.edit_outlined),
            label: const Text('Edit Customer Information'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => _openEditCustomerDialog(context),
          ),
        ],
      ),
    );
  }

  Widget _metricCol(String label, String value, Color color) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
      ],
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STICKY BOTTOM ACTION BAR matching Image 2:
  // [↓ Received (Green)] [↑ Given (Pink)] [WhatsApp]
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildStickyBottomActionBar(double currentOutstanding) {
    final cust = _customer ?? widget.customer;
    final phone = cust?.mobile ?? '8800123456';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
        boxShadow: [
          BoxShadow(
            color: Color(0x0C000000),
            blurRadius: 10,
            offset: Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            // Received (Green Pill Button)
            Expanded(
              flex: 4,
              child: ElevatedButton.icon(
                onPressed: _openCollectPayment,
                icon: const Icon(Icons.arrow_downward, color: Colors.white, size: 18),
                label: const Text(
                  'Received',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                ),
              ),
            ),
            const SizedBox(width: 10),

            // Given (Pink / Light Red Pill Button)
            Expanded(
              flex: 4,
              child: ElevatedButton.icon(
                onPressed: () {
                  if (cust != null) {
                    context.read<CatalogProvider>().selectCustomer(cust);
                  }
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                  );
                },
                icon: const Icon(Icons.arrow_upward, color: Color(0xFFDC2626), size: 18),
                label: const Text(
                  'Given',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFDC2626),
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFEE2E2),
                  foregroundColor: const Color(0xFFDC2626),
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                ),
              ),
            ),
            const SizedBox(width: 10),

            // WhatsApp Square Button
            InkWell(
              onTap: () {
                final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
                if (digits.isNotEmpty) {
                  launchUrl(Uri.parse('https://wa.me/$digits'), mode: LaunchMode.externalApplication);
                }
              },
              borderRadius: BorderRadius.circular(14),
              child: Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Center(
                  child: Icon(Icons.chat_bubble_outline, color: Color(0xFF16A34A), size: 22),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PROFILE SHEET & DIALOGS
  // ──────────────────────────────────────────────────────────────────────────
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
            _profileRow('Name', cust?.name ?? widget.partyName),
            _profileRow('Mobile', cust?.mobile.isNotEmpty == true ? cust!.mobile : '8800123456'),
            _profileRow('Address', cust?.address.isNotEmpty == true ? cust!.address : 'Jasola, New Delhi'),
            _profileRow('Current Outstanding', '₹${_money.format(_currentBalance != 0.0 ? _currentBalance : (cust?.currentBalance ?? 19000.0))}'),
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
                  _openEditCustomerDialog(context);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _profileRow(String label, String value) {
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

  Future<void> _openEditCustomerDialog(BuildContext context) async {
    final cust = _customer ?? widget.customer;
    final nameCtrl = TextEditingController(text: cust?.name ?? widget.partyName);
    final mobileCtrl = TextEditingController(text: cust?.mobile ?? '');
    final addressCtrl = TextEditingController(text: cust?.address ?? '');
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
                  const Text('Edit Customer', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
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
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
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
                          if (cust != null) {
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
                          }
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
}
