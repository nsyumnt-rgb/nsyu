import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/customer_portal_service.dart';
import '../../theme/app_theme.dart';

class PortalLedgerScreen extends StatefulWidget {
  const PortalLedgerScreen({super.key});

  @override
  State<PortalLedgerScreen> createState() => _PortalLedgerScreenState();
}

class _PortalLedgerScreenState extends State<PortalLedgerScreen> {
  final CustomerPortalService _service = CustomerPortalService();
  Map<String, dynamic>? _summary;
  List<Map<String, dynamic>> _entries = [];
  bool _loading = true;

  String _dateFilter = 'all'; // 'all', 'this_month', 'last_30', 'custom'
  DateTime? _startDate;
  DateTime? _endDate;

  @override
  void initState() {
    super.initState();
    _loadLedger();
  }

  Future<void> _loadLedger() async {
    setState(() => _loading = true);
    try {
      String? fromStr;
      String? toStr;

      if (_dateFilter == 'this_month') {
        final now = DateTime.now();
        fromStr = DateTime(now.year, now.month, 1).toIso8601String().substring(0, 10);
        toStr = DateTime(now.year, now.month + 1, 0).toIso8601String().substring(0, 10);
      } else if (_dateFilter == 'last_30') {
        final now = DateTime.now();
        fromStr = now.subtract(const Duration(days: 30)).toIso8601String().substring(0, 10);
        toStr = now.toIso8601String().substring(0, 10);
      } else if (_dateFilter == 'custom' && _startDate != null && _endDate != null) {
        fromStr = _startDate!.toIso8601String().substring(0, 10);
        toStr = _endDate!.toIso8601String().substring(0, 10);
      }

      final summary = await _service.getLedgerSummary();
      final entries = await _service.listLedger(from: fromStr, to: toStr, limit: 100);
      if (mounted) {
        setState(() {
          _summary = summary;
          _entries = entries;
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _pickCustomRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDateRange: _startDate != null && _endDate != null
          ? DateTimeRange(start: _startDate!, end: _endDate!)
          : DateTimeRange(
              start: DateTime.now().subtract(const Duration(days: 30)),
              end: DateTime.now(),
            ),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.navy900,
              onPrimary: Colors.white,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _dateFilter = 'custom';
        _startDate = picked.start;
        _endDate = picked.end;
      });
      _loadLedger();
    }
  }

  void _showTransactionDetails(Map<String, dynamic> row) {
    final isDebit = ((row['debit_amount'] ?? 0) as num) > 0;
    final debit = ((row['debit_amount'] ?? 0) as num).toDouble();
    final credit = ((row['credit_amount'] ?? 0) as num).toDouble();
    final runBal = ((row['running_balance'] ?? 0) as num).toDouble();
    final desc = row['description']?.toString() ?? (isDebit ? 'Invoice Debit' : 'Payment Credit');
    final dt = row['entry_date']?.toString() ?? row['createdAt']?.toString();
    final dateStr = dt != null ? DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(dt)) : 'N/A';
    final refType = row['reference_type']?.toString() ?? row['entry_type']?.toString() ?? (isDebit ? 'BILL' : 'PAYMENT');
    final refId = row['reference_id']?.toString() ?? row['bill_number']?.toString() ?? row['payment_number']?.toString() ?? 'N/A';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Transaction Details',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.navy900),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textSecondary),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const Divider(color: AppColors.border),
            const SizedBox(height: 8),
            _buildDetailRow('Date & Time', dateStr),
            _buildDetailRow('Transaction Type', refType.toUpperCase()),
            _buildDetailRow('Reference / Bill #', refId),
            _buildDetailRow('Description', desc),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.bg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Debit Amount', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      AmountText(amount: debit, fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.danger),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Credit Amount', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      AmountText(amount: credit, fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.success),
                    ],
                  ),
                  const Divider(height: 14, color: AppColors.border),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Running Balance', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.navy900)),
                      AmountText(
                        amount: runBal.abs(),
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        color: runBal > 0 ? AppColors.danger : AppColors.success,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          Flexible(
            child: Text(
              value,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.navy900),
              textAlign: TextAlign.right,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final balance = ((_summary?['currentBalance'] ?? 0) as num).toDouble();
    final debits = ((_summary?['totalDebits'] ?? 0) as num).toDouble();
    final credits = ((_summary?['totalCredits'] ?? 0) as num).toDouble();
    final openingBal = ((_summary?['openingBalance'] ?? 0) as num).toDouble();

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.navy900),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'My Ledger & Statement',
          style: TextStyle(color: AppColors.navy900, fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: _loading
          ? Padding(
              padding: const EdgeInsets.all(16),
              child: SkeletonLoader.list(count: 6),
            )
          : RefreshIndicator(
              color: AppColors.blue600,
              onRefresh: _loadLedger,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // ── Balance Summary Card ──
                  AppCard(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Current Outstanding',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                                ),
                                const SizedBox(height: 4),
                                AmountText(
                                  amount: balance.abs(),
                                  fontSize: 26,
                                  fontWeight: FontWeight.w900,
                                  color: balance > 0
                                      ? AppColors.danger
                                      : (balance < 0 ? AppColors.warning : AppColors.success),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  balance > 0
                                      ? 'Payment due to shop'
                                      : balance < 0
                                          ? 'Advance deposit with shop'
                                          : 'All settled (₹0.00 balance)',
                                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: AppColors.blue50,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.account_balance_wallet, color: AppColors.navy900, size: 24),
                            ),
                          ],
                        ),
                        const Divider(height: 24, color: AppColors.border),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('OPENING', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                                  const SizedBox(height: 2),
                                  AmountText(
                                    amount: openingBal.abs(),
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: openingBal > 0 ? AppColors.danger : AppColors.navy900,
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('INVOICED', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                                  const SizedBox(height: 2),
                                  AmountText(
                                    amount: debits,
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.navy900,
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('SETTLED', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                                  const SizedBox(height: 2),
                                  AmountText(
                                    amount: credits,
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.success,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // ── Date Filters ──
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip('All Time', 'all'),
                        const SizedBox(width: 8),
                        _buildFilterChip('This Month', 'this_month'),
                        const SizedBox(width: 8),
                        _buildFilterChip('Last 30 Days', 'last_30'),
                        const SizedBox(width: 8),
                        ActionChip(
                          avatar: const Icon(Icons.date_range_rounded, size: 16, color: AppColors.navy900),
                          label: Text(
                            _dateFilter == 'custom' && _startDate != null && _endDate != null
                                ? '${DateFormat('dd MMM').format(_startDate!)} - ${DateFormat('dd MMM').format(_endDate!)}'
                                : 'Custom Range',
                          ),
                          backgroundColor: _dateFilter == 'custom' ? AppColors.blue50 : Colors.white,
                          labelStyle: TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.bold,
                            color: _dateFilter == 'custom' ? AppColors.navy900 : AppColors.textSecondary,
                          ),
                          onPressed: _pickCustomRange,
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),
                  const SectionHeader(title: 'Statement Entries'),
                  const SizedBox(height: 8),

                  if (_entries.isEmpty)
                    const Center(
                      child: EmptyState(
                        icon: Icons.receipt_long_outlined,
                        title: 'No Statement Entries',
                        subtitle: 'No statement transactions found in this period.',
                      ),
                    )
                  else
                    ..._entries.map((row) {
                      final isDebit = ((row['debit_amount'] ?? 0) as num) > 0;
                      final amt = isDebit
                          ? ((row['debit_amount'] ?? 0) as num).toDouble()
                          : ((row['credit_amount'] ?? 0) as num).toDouble();
                      final runBal = ((row['running_balance'] ?? 0) as num).toDouble();
                      final desc = row['description']?.toString() ?? (isDebit ? 'Invoice Debit' : 'Payment Credit');
                      final billNum = row['bill_number']?.toString() ?? row['reference_id']?.toString();
                      final dt = row['entry_date']?.toString() ?? row['createdAt']?.toString();
                      final dateStr = dt != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(dt)) : '';

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: AppCard(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          onTap: () => _showTransactionDetails(row),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isDebit ? AppColors.blue50 : AppColors.successBg,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  isDebit ? 'DEBIT' : 'CREDIT',
                                  style: TextStyle(
                                    color: isDebit ? AppColors.navy900 : AppColors.success,
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        if (billNum != null && billNum.isNotEmpty) ...[
                                          Text(
                                            '#$billNum',
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.navy900),
                                          ),
                                          const SizedBox(width: 6),
                                        ],
                                        Expanded(
                                          child: Text(
                                            desc,
                                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: AppColors.textPrimary),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(dateStr, style: const TextStyle(fontSize: 10.5, color: AppColors.textSecondary)),
                                  ],
                                ),
                              ),
                              Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        isDebit ? '+' : '-',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13,
                                          color: isDebit ? AppColors.danger : AppColors.success,
                                        ),
                                      ),
                                      AmountText(
                                        amount: amt,
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w800,
                                        color: isDebit ? AppColors.danger : AppColors.success,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 1),
                                  Text(
                                    'Bal: ₹${runBal.abs().toStringAsFixed(2)}',
                                    style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }

  Widget _buildFilterChip(String label, String id) {
    final isSel = _dateFilter == id;
    return InkWell(
      onTap: () {
        setState(() {
          _dateFilter = id;
          _startDate = null;
          _endDate = null;
        });
        _loadLedger();
      },
      borderRadius: BorderRadius.circular(999),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSel ? AppColors.blue50 : Colors.white,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: isSel ? AppColors.blue600 : AppColors.border,
            width: isSel ? 1.4 : 1.0,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
            color: isSel ? AppColors.navy900 : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
