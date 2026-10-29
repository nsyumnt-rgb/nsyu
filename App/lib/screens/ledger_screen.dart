import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/customer.dart';
import '../models/saved_bill.dart';
import '../models/saved_payment.dart';
import '../providers/bills_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/customer_provider.dart';
import '../services/payment_receipt_pdf_service.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bottom_nav.dart';
import 'catalog_screen.dart';
import 'customer_ledger_detail_screen.dart';
import 'customer_picker_screen.dart';
import 'payment_collect_screen.dart';

class LedgerScreen extends StatefulWidget {
  final ValueChanged<int> onNavigate;

  const LedgerScreen({super.key, required this.onNavigate});

  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 4, vsync: this);
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final bills = context.read<BillsProvider>();
      if (!bills.loaded) await bills.load();
      if (!bills.syncing) await bills.syncFromSupabase();
      if (!mounted) return;
      if (bills.syncError != null) {
        showAppSnackBar(
          context,
          'Could not sync ledger from Supabase: ${bills.syncError}',
          isError: true,
          duration: const Duration(seconds: 8),
        );
      }
    });
  }

  Future<void> _syncFromSupabase(BuildContext context) async {
    final bills = context.read<BillsProvider>();
    if (bills.syncing) return;
    await bills.syncFromSupabase();
    if (!context.mounted) return;
    showAppSnackBar(
      context,
      bills.syncError ??
          'Ledger synced — ${bills.totalPartyCount} parties, '
              '${bills.totalBillsCount} bills from Supabase',
      isError: bills.syncError != null,
    );
  }

  @override
  void dispose() {
    _tabs.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  static const _avatarColors = [
    Color(0xFF2563EB),
    Color(0xFF16A34A),
    Color(0xFFF59E0B),
    Color(0xFF7C3AED),
    Color(0xFFDC2626),
    Color(0xFF0891B2),
  ];

  @override
  Widget build(BuildContext context) {
    final bills = context.watch<BillsProvider>();
    final money = NumberFormat('#,##0');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ledger'),
        actions: [
          IconButton(
            tooltip: 'Sync from Supabase',
            icon: bills.syncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.cloud_sync_outlined),
            onPressed: bills.syncing ? null : () => _syncFromSupabase(context),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          isScrollable: false,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
          unselectedLabelStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
          tabs: const [
            Tab(icon: Icon(Icons.receipt_long_outlined, size: 18), text: 'Due'),
            Tab(icon: Icon(Icons.currency_rupee, size: 18), text: 'Receive'),
            Tab(icon: Icon(Icons.bar_chart_outlined, size: 18), text: 'Statement'),
            Tab(icon: Icon(Icons.history, size: 18), text: 'History'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _outstandingTab(bills, money),
          _receivePaymentTab(bills, money),
          _statementTab(bills, money),
          _paymentHistoryTab(bills, money),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'ledger_fab',
        backgroundColor: AppColors.steelBlue,
        onPressed: () => _startNewBill(context),
        icon: const Icon(Icons.add),
        label: const Text('New Bill'),
      ),
      bottomNavigationBar: AppBottomNav(currentIndex: 2, onTap: widget.onNavigate),
    );
  }

  /// Ledger -> Select Customer -> Create Bill -> Product Catalog: lets the
  /// user pick (or add) a customer straight from the Ledger, pre-fills the
  /// customer on a fresh bill, then opens the Product Catalog to select
  /// items. `startNewBill()` clears any stale in-progress cart first so
  /// items left over from a previous, unrelated bill never leak into this
  /// one.
  Future<void> _startNewBill(BuildContext context) async {
    final customer = await Navigator.of(context).push<Customer>(
      MaterialPageRoute(builder: (_) => const CustomerPickerScreen(selectMode: true)),
    );
    if (customer == null || !context.mounted) return;
    final catalog = context.read<CatalogProvider>();
    catalog.startNewBill();
    catalog.setCustomerName(customer.name);
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const CatalogScreen()),
    );
  }

  Color _avatarColor(int i) => _avatarColors[i % _avatarColors.length];

  String _initials(String name) => name.trim().isEmpty
      ? '?'
      : name.trim().split(RegExp(r'\s+')).take(2).map((s) => s[0]).join().toUpperCase();

  double _todaysCollection(BillsProvider bills) {
    final now = DateTime.now();
    return bills.paymentReceipts
        .where((p) => p.date.year == now.year && p.date.month == now.month && p.date.day == now.day)
        .fold(0.0, (s, p) => s + p.amount);
  }

  DateTime? _lastPaymentDate(BillsProvider bills, String customerName) {
    final list = bills.paymentReceipts.where((p) => p.customerName == customerName).toList();
    if (list.isEmpty) return null;
    list.sort((a, b) => b.date.compareTo(a.date));
    return list.first.date;
  }

  // ---------------- Outstanding ----------------

  Widget _outstandingTab(BillsProvider bills, NumberFormat money) {
    if (!bills.loaded || bills.syncing) {
      return const Center(child: CircularProgressIndicator());
    }
    final customers = context.watch<CustomerProvider>();
    final allParties = bills.parties
        .where((p) => p.name.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Column(
      children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              Expanded(
                child: _summaryCard(Icons.groups_2_outlined, AppColors.steelBlue, 'Total Customers',
                    '${customers.customers.isNotEmpty ? customers.customers.length : bills.totalPartyCount}'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _summaryCard(Icons.account_balance_wallet_outlined, AppColors.red, 'Total Receivable',
                    '₹${money.format(bills.totalPartyDue)}'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _summaryCard(Icons.today_outlined, AppColors.billGreen, "Today's Collection",
                    '₹${money.format(_todaysCollection(bills))}'),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: TextField(
            controller: _searchCtrl,
            onChanged: (v) => setState(() => _query = v),
            decoration: const InputDecoration(
              hintText: 'Search Customer',
              prefixIcon: Icon(Icons.search),
            ),
          ),
        ),
        Expanded(
          child: allParties.isEmpty
              ? const Center(
                  child: Text('No customers yet. They appear once you save a bill.',
                      style: TextStyle(color: AppColors.muted)),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                  itemCount: allParties.length,
                  itemBuilder: (context, i) {
                    final p = allParties[i];
                    Customer? match;
                    for (final c in customers.customers) {
                      if (c.name.trim().toLowerCase() == p.name.trim().toLowerCase()) {
                        match = c;
                        break;
                      }
                    }
                    final lastPayment = _lastPaymentDate(bills, p.name);
                    final isDue = p.totalDue > 0.005;

                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => CustomerLedgerDetailScreen(partyName: p.name, customer: match),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              CircleAvatar(
                                radius: 24,
                                backgroundColor: _avatarColor(i),
                                child: Text(_initials(p.name),
                                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(p.name,
                                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis),
                                    const SizedBox(height: 2),
                                    Text(
                                      [
                                        if (match != null && match.id.isNotEmpty) match.id,
                                        if (match != null && match.mobile.isNotEmpty) match.mobile,
                                      ].join(' · '),
                                      style: const TextStyle(color: AppColors.muted, fontSize: 12),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      lastPayment == null
                                          ? '${p.billCount} bill${p.billCount == 1 ? '' : 's'}'
                                          : 'Last Payment: ${DateFormat('dd MMM yyyy').format(lastPayment)}',
                                      style: const TextStyle(color: AppColors.muted, fontSize: 11.5),
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '₹${money.format(isDue ? p.totalDue : 0)}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                      color: isDue ? AppColors.red : AppColors.billGreen,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: (isDue ? AppColors.red : AppColors.billGreen).withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Text(
                                      isDue ? 'Due' : 'Paid',
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w700,
                                        color: isDue ? AppColors.red : AppColors.billGreen,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _summaryCard(IconData icon, Color color, String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withOpacity(0.12), color.withOpacity(0.04)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(value,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10.5, color: AppColors.muted)),
        ],
      ),
    );
  }


  // ---------------- Receive Payment ----------------

  Widget _receivePaymentTab(BillsProvider bills, NumberFormat money) {
    if (!bills.loaded || bills.syncing) {
      return const Center(child: CircularProgressIndicator());
    }
    final parties = bills.outstandingParties;

    if (parties.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('No pending payments to receive.', style: TextStyle(color: AppColors.muted)),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: parties.length,
      itemBuilder: (context, i) {
        final p = parties[i];
        final unpaidBills =
            bills.billsForParty(p.name).where((b) => b.status == BillStatus.unpaid).toList();
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: ExpansionTile(
            leading: CircleAvatar(
              backgroundColor: _avatarColor(i),
              child: Text(_initials(p.name), style: const TextStyle(color: Colors.white, fontSize: 13)),
            ),
            title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text('Due: \u20b9${money.format(p.totalDue)}',
                style: const TextStyle(color: AppColors.red, fontWeight: FontWeight.w700)),
            children: [
              for (final b in unpaidBills)
                ListTile(
                  dense: true,
                  title: Text('Bill #${b.billNumber}'),
                  subtitle: Text(DateFormat('dd MMM yyyy').format(b.date)),
                  trailing: Wrap(
                    spacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text('\u20b9${money.format(b.due)}',
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.billGreen,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          minimumSize: const Size(0, 32),
                        ),
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => PaymentCollectScreen(bill: b),
                            ),
                          );
                        },
                        child: const Text('Receive', style: TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  // ---------------- Statement ----------------

  Widget _statementTab(BillsProvider bills, NumberFormat money) {
    if (!bills.loaded || bills.syncing) {
      return const Center(child: CircularProgressIndicator());
    }
    final allParties = bills.parties;

    if (allParties.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('No parties yet. They appear once you save bills.',
              style: TextStyle(color: AppColors.muted)),
        ),
      );
    }

    return _StatementBody(parties: allParties, bills: bills, money: money);
  }

  // ---------------- Payment History ----------------

  Widget _paymentHistoryTab(BillsProvider bills, NumberFormat money) {
    if (!bills.loaded || bills.syncing) {
      return const Center(child: CircularProgressIndicator());
    }
    final receipts = bills.paymentReceipts;

    if (receipts.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'No payments recorded yet. Use "Receive" on a due bill '
            'and it will show up here as a receipt.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted),
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      itemCount: receipts.length,
      itemBuilder: (context, i) {
        final SavedPayment p = receipts[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: ListTile(
            leading: const Icon(Icons.check_circle, color: AppColors.billGreen),
            title: Text(p.customerName.isEmpty ? 'Walk-in customer' : p.customerName,
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(
              '${p.receiptNumber} \u00b7 ${p.method.label} \u00b7 '
              '${DateFormat('dd MMM yyyy').format(p.date)}',
            ),
            trailing: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('\u20b9${money.format(p.amount)}',
                    style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.billGreen)),
                const Icon(Icons.picture_as_pdf_outlined, size: 16, color: AppColors.muted),
              ],
            ),
            onTap: () => PaymentReceiptPdfService.previewAndPrint(p),
          ),
        );
      },
    );
  }
}

/// Party picker + running Debit/Credit/Balance statement — mirrors the
/// Ledger.xlsx columns: Date | Customer | Bill No | Debit | Credit | Balance.
class _StatementBody extends StatefulWidget {
  final List<LedgerParty> parties;
  final BillsProvider bills;
  final NumberFormat money;

  const _StatementBody({required this.parties, required this.bills, required this.money});

  @override
  State<_StatementBody> createState() => _StatementBodyState();
}

class _StatementBodyState extends State<_StatementBody> {
  String? _selectedParty;

  @override
  void initState() {
    super.initState();
    _selectedParty = widget.parties.first.name;
  }

  @override
  Widget build(BuildContext context) {
    final money = widget.money;
    final partyBills = _selectedParty == null
        ? <SavedBill>[]
        : widget.bills.billsForParty(_selectedParty!);

    double runningBalance = 0;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: DropdownButtonFormField<String>(
            initialValue: _selectedParty,
            decoration: const InputDecoration(labelText: 'Select Party'),
            items: [
              for (final p in widget.parties)
                DropdownMenuItem(value: p.name, child: Text(p.name)),
            ],
            onChanged: (v) => setState(() => _selectedParty = v),
          ),
        ),
        if (partyBills.isNotEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(child: Text('Date', style: TextStyle(fontSize: 11, color: AppColors.muted))),
                Expanded(child: Text('Bill No', style: TextStyle(fontSize: 11, color: AppColors.muted))),
                Expanded(child: Text('Debit', style: TextStyle(fontSize: 11, color: AppColors.muted))),
                Expanded(child: Text('Credit', style: TextStyle(fontSize: 11, color: AppColors.muted))),
                Expanded(
                    child: Text('Balance',
                        textAlign: TextAlign.right,
                        style: TextStyle(fontSize: 11, color: AppColors.muted))),
              ],
            ),
          ),
        const Divider(height: 12),
        Expanded(
          child: partyBills.isEmpty
              ? const Center(
                  child: Text('No transactions for this party.',
                      style: TextStyle(color: AppColors.muted)),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  itemCount: partyBills.length,
                  itemBuilder: (context, i) {
                    final b = partyBills[i];
                    final debit = b.status == BillStatus.cancelled ? 0.0 : b.total;
                    final credit = b.status == BillStatus.cancelled ? 0.0 : b.paidAmount;
                    runningBalance += debit - credit;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          Expanded(
                              child: Text(DateFormat('dd MMM').format(b.date),
                                  style: const TextStyle(fontSize: 12))),
                          Expanded(child: Text(b.billNumber, style: const TextStyle(fontSize: 12))),
                          Expanded(
                              child: Text(debit > 0 ? money.format(debit) : '-',
                                  style: const TextStyle(fontSize: 12, color: AppColors.red))),
                          Expanded(
                              child: Text(credit > 0 ? money.format(credit) : '-',
                                  style: const TextStyle(fontSize: 12, color: AppColors.billGreen))),
                          Expanded(
                              child: Text(money.format(runningBalance),
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
