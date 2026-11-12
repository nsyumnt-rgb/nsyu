import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/customer_portal_service.dart';

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
              primary: Color(0xFF1D4ED8),
              onPrimary: Colors.white,
              onSurface: Color(0xFF0F172A),
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
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const Divider(),
            const SizedBox(height: 8),
            _buildDetailRow('Date & Time', dateStr),
            _buildDetailRow('Transaction Type', refType.toUpperCase()),
            _buildDetailRow('Reference / Bill #', refId),
            _buildDetailRow('Description', desc),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Debit Amount', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                      Text(
                        '₹${debit.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFFDC2626)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Credit Amount', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                      Text(
                        '₹${credit.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF16A34A)),
                      ),
                    ],
                  ),
                  const Divider(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Running Balance', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A))),
                      Text(
                        '₹${runBal.abs().toStringAsFixed(2)} ${runBal > 0 ? "(Due)" : runBal < 0 ? "(Advance)" : ""}',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                          color: runBal > 0
                              ? const Color(0xFFDC2626)
                              : runBal < 0
                                  ? const Color(0xFF16A34A)
                                  : const Color(0xFF0F172A),
                        ),
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
          Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          Flexible(
            child: Text(
              value,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
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
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D4ED8),
        elevation: 0,
        title: const Text(
          'My Ledger & Statement',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF1D4ED8)))
          : RefreshIndicator(
              color: const Color(0xFF1D4ED8),
              onRefresh: _loadLedger,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // ── Balance Cards ──
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: const [
                        BoxShadow(color: Color(0x06000000), blurRadius: 8, offset: Offset(0, 2)),
                      ],
                    ),
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
                                  'CURRENT OUTSTANDING',
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '₹${balance.abs().toStringAsFixed(2)}',
                                  style: TextStyle(
                                    fontSize: 24,
                                    fontWeight: FontWeight.w900,
                                    color: balance > 0
                                        ? const Color(0xFFDC2626)
                                        : balance < 0
                                            ? const Color(0xFF16A34A)
                                            : const Color(0xFF0F172A),
                                  ),
                                ),
                                Text(
                                  balance > 0
                                      ? 'Payment due to shop'
                                      : balance < 0
                                          ? 'Advance deposit with shop'
                                          : 'All settled (₹0.00 balance)',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDBEAFE),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.account_balance_wallet, color: Color(0xFF1D4ED8), size: 24),
                            ),
                          ],
                        ),
                        const Divider(height: 24),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('OPENING BALANCE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                                  const SizedBox(height: 2),
                                  Text(
                                    '₹${openingBal.abs().toStringAsFixed(2)}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                      color: openingBal > 0 ? const Color(0xFFDC2626) : const Color(0xFF0F172A),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('TOTAL INVOICED', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                                  const SizedBox(height: 2),
                                  Text(
                                    '₹${debits.toStringAsFixed(2)}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('TOTAL SETTLED', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                                  const SizedBox(height: 2),
                                  Text(
                                    '₹${credits.toStringAsFixed(2)}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF16A34A)),
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
                          avatar: const Icon(Icons.date_range, size: 16, color: Color(0xFF1D4ED8)),
                          label: Text(
                            _dateFilter == 'custom' && _startDate != null && _endDate != null
                                ? '${DateFormat('dd MMM').format(_startDate!)} - ${DateFormat('dd MMM').format(_endDate!)}'
                                : 'Custom Range',
                          ),
                          backgroundColor: _dateFilter == 'custom' ? const Color(0xFFDBEAFE) : Colors.white,
                          labelStyle: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: _dateFilter == 'custom' ? const Color(0xFF1D4ED8) : const Color(0xFF475569),
                          ),
                          onPressed: _pickCustomRange,
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),
                  const Text(
                    'Ledger Transactions (Read-Only)',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 8),

                  if (_entries.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: const Center(
                        child: Text(
                          'No statement transactions found in this period.',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                        ),
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

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                          onTap: () => _showTransactionDetails(row),
                          title: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isDebit ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  isDebit ? 'DEBIT' : 'CREDIT',
                                  style: TextStyle(
                                    color: isDebit ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              if (billNum != null && billNum.isNotEmpty) ...[
                                const SizedBox(width: 8),
                                Text(
                                  '#$billNum',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF1D4ED8)),
                                ),
                              ],
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  desc,
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          subtitle: Text(dateStr, style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '${isDebit ? "+" : "-"}₹${amt.toStringAsFixed(2)}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 13.5,
                                  color: isDebit ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                                ),
                              ),
                              Text(
                                'Bal: ₹${runBal.abs().toStringAsFixed(2)}',
                                style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
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
    return ChoiceChip(
      label: Text(label),
      selected: isSel,
      selectedColor: const Color(0xFF1D4ED8),
      backgroundColor: Colors.white,
      labelStyle: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.bold,
        color: isSel ? Colors.white : const Color(0xFF475569),
      ),
      onSelected: (val) {
        if (val) {
          setState(() {
            _dateFilter = id;
            _startDate = null;
            _endDate = null;
          });
          _loadLedger();
        }
      },
    );
  }
}
