import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../models/customer.dart';
import '../../../models/customer_ledger_entry.dart';
import '../../../providers/bills_provider.dart';
import '../../../providers/customer_provider.dart';
import '../../../providers/payments_provider.dart';
import '../../../services/supabase_service.dart';
import '../../../screens/collect_payment_screen.dart';

import '../widgets/ledger_timeline_card.dart';
import '../widgets/customer_bills_tab_view.dart';
import '../widgets/customer_orders_tab_view.dart';
import '../widgets/customer_profile_sheet.dart';
import '../widgets/customer_ledger_bottom_bar.dart';

class CustomerLedgerDetailScreen extends StatefulWidget {
  final String partyName;
  final Customer? customer;
  final String initialTab; // 'Ledger', 'Bills', 'Overview', 'Payments', 'Orders'

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
  late String _activeTab;

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
        _currentBalance = (res['currentBalance'] as num?)?.toDouble() ?? 0.0;
        _totalDebit = (res['totalDebit'] as num?)?.toDouble() ?? 0.0;
        _totalCredit = (res['totalCredit'] as num?)?.toDouble() ?? 0.0;
        final rawEntries = (res['entries'] as List<CustomerLedgerEntry>?) ?? [];
        rawEntries.sort((a, b) => b.entryDate.compareTo(a.entryDate));
        _backendEntries = rawEntries;
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
        context.read<PaymentsProvider>().syncFromSupabase();
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
            id: (i + 1) * 1000,
            customerId: int.tryParse(widget.customer?.id ?? '0') ?? 0,
            shopId: 1,
            entryType: 'credit',
            amount: b.paidAmount,
            runningBalance: running,
            referenceType: 'Payment',
            referenceId: (i + 1) * 1000,
            description: 'Payment for ${b.billNumber}',
            entryDate: b.date.add(const Duration(minutes: 5)),
          ),
        );
      }
    }

    entries.sort((a, b) => b.entryDate.compareTo(a.entryDate));
    return entries;
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

  @override
  Widget build(BuildContext context) {
    final billsProvider = context.watch<BillsProvider>();
    final timeline = _buildTimeline(billsProvider);

    final cust = _customer ?? widget.customer;
    final name = cust?.name ?? widget.partyName;
    final phone = cust?.mobile.isNotEmpty == true ? cust!.mobile : '-';

    final totalSales = _totalDebit != 0.0 ? _totalDebit : timeline.where((e) => e.isDebit).fold(0.0, (s, e) => s + e.amount);
    final totalPayments = _totalCredit != 0.0 ? _totalCredit : timeline.where((e) => e.isCredit).fold(0.0, (s, e) => s + e.amount);
    final currentOutstanding = _backendEntries.isNotEmpty ? _currentBalance : (totalSales - totalPayments);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(72),
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Color(0xFF0F172A)),
                    onPressed: () => Navigator.pop(context),
                  ),
                  InkWell(
                    onTap: () => CustomerProfileSheetHelper.showProfileSheet(
                      context: context,
                      customer: cust,
                      partyName: widget.partyName,
                      currentBalance: currentOutstanding,
                      moneyFormatter: _money,
                      onCustomerUpdated: (updated) {
                        setState(() {
                          _customer = updated;
                          _currentBalance = updated.currentBalance;
                        });
                      },
                    ),
                    borderRadius: BorderRadius.circular(10),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircleAvatar(
                          radius: 19,
                          backgroundColor: const Color(0xFF16A34A),
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : 'C',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Row(
                              children: [
                                Text(
                                  name,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                const Icon(Icons.chevron_right, size: 16, color: Color(0xFF94A3B8)),
                              ],
                            ),
                            Text(
                              phone,
                              style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
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
          _buildSubTabs(),
          Expanded(
            child: _activeTab == 'Orders'
                ? CustomerOrdersTabView(
                    customer: cust,
                    partyName: widget.partyName,
                    moneyFormatter: _money,
                    dateFormat: _dateFormat,
                    timeFormat: _timeFormat,
                  )
                : _activeTab == 'Bills'
                    ? CustomerBillsTabView(
                        customer: cust,
                        partyName: widget.partyName,
                        moneyFormatter: _money,
                        dateFormat: _dateFormat,
                        timeFormat: _timeFormat,
                      )
                    : _activeTab == 'Ledger'
                        ? _buildLedgerTab(timeline, currentOutstanding)
                        : _activeTab == 'Payments'
                            ? _buildPaymentsTab(timeline)
                            : _buildOverviewTab(name, phone, totalSales, totalPayments, currentOutstanding),
          ),
        ],
      ),
      bottomSheet: _activeTab == 'Ledger'
          ? CustomerLedgerBottomBar(
              customer: cust,
              onCollectPayment: _openCollectPayment,
            )
          : null,
    );
  }

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

  Widget _buildLedgerTab(List<CustomerLedgerEntry> timeline, double currentOutstanding) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
      children: [
        // Total Due Header Card
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
              Text(
                currentOutstanding > 0
                    ? 'Total Due'
                    : (currentOutstanding < 0 ? 'Advance Balance' : 'All Settled'),
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: currentOutstanding > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '₹ ${_money.format(currentOutstanding.abs())}',
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                  color: currentOutstanding > 0 ? const Color(0xFFEA580C) : const Color(0xFF16A34A),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Last Transaction',
                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500, color: Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 4),
              if (timeline.isNotEmpty) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(_dateFormat.format(timeline.first.entryDate), style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                    const Text(' • ', style: TextStyle(color: Color(0xFFCBD5E1))),
                    Text(
                      timeline.first.isCredit
                          ? '₹ ${_money.format(timeline.first.amount)} Received'
                          : '₹ ${_money.format(timeline.first.amount)} Billed',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: timeline.first.isCredit ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                      ),
                    ),
                  ],
                ),
              ] else ...[
                const Text('No transactions yet', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Timeline items
        if (timeline.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 48, horizontal: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.receipt_long_outlined, size: 48, color: Color(0xFFCBD5E1)),
                  SizedBox(height: 12),
                  Text(
                    'No transactions recorded yet',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF334155)),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Bills and payments for this customer will appear here.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                  ),
                ],
              ),
            ),
          )
        else
          ..._buildGroupedTimelineWidgets(timeline),
      ],
    );
  }

  List<Widget> _buildGroupedTimelineWidgets(List<CustomerLedgerEntry> timeline) {
    final Map<String, List<CustomerLedgerEntry>> grouped = {};
    for (final e in timeline) {
      final dateKey = _dateFormat.format(e.entryDate);
      grouped.putIfAbsent(dateKey, () => []).add(e);
    }

    final List<Widget> widgets = [];
    for (final entry in grouped.entries) {
      widgets.add(LedgerDatePill(date: entry.key));
      widgets.add(const SizedBox(height: 8));

      for (final e in entry.value) {
        final ref = e.description.replaceAll(RegExp(r'^(Bill|Payment|Sale|Order)\s*#?'), '').trim();
        final timeStr = _timeFormat.format(e.entryDate);

        if (e.isDebit) {
          widgets.add(Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: LedgerBillCard(
              billNo: ref.isNotEmpty ? ref : 'INV-${e.referenceId ?? "001"}',
              time: timeStr,
              amount: e.amount,
              moneyFormatter: _money,
              hasPdf: true,
            ),
          ));
        } else {
          widgets.add(Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: LedgerPaymentCard(
              title: 'Payment',
              subtitle: '${e.description.contains("Cash") ? "Cash" : "Payment"} • $timeStr',
              amount: e.amount,
              moneyFormatter: _money,
            ),
          ));
        }
      }
    }
    return widgets;
  }

  Widget _buildPaymentsTab(List<CustomerLedgerEntry> timeline) {
    final payments = timeline.where((e) => e.isCredit).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
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
        if (payments.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text(
                'No payments recorded yet.',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
              ),
            ),
          )
        else
          ...payments.map((p) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: LedgerPaymentCard(
                  title: 'Payment',
                  subtitle: '${_dateFormat.format(p.entryDate)} • ${_timeFormat.format(p.entryDate)}',
                  amount: p.amount,
                  moneyFormatter: _money,
                ),
              )),
      ],
    );
  }

  Widget _buildOverviewTab(
    String name,
    String phone,
    double totalSales,
    double totalPayments,
    double currentOutstanding,
  ) {
    final cust = _customer ?? widget.customer;
    return ListView(
      padding: const EdgeInsets.all(16),
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
                      name.isNotEmpty ? name[0].toUpperCase() : 'C',
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
                  _metricCol(
                    currentOutstanding < 0 ? 'Advance' : 'Outstanding',
                    '₹ ${_money.format(currentOutstanding.abs())}',
                    currentOutstanding > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                  ),
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
          onPressed: () => CustomerProfileSheetHelper.showEditDialog(
            context: context,
            customer: cust,
            partyName: widget.partyName,
            onCustomerUpdated: (updated) {
              setState(() {
                _customer = updated;
                _currentBalance = updated.currentBalance;
              });
            },
          ),
        ),
      ],
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
}
