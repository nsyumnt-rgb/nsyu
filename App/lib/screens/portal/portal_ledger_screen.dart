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

  @override
  void initState() {
    super.initState();
    _loadLedger();
  }

  Future<void> _loadLedger() async {
    setState(() => _loading = true);
    try {
      final summary = await _service.getLedgerSummary();
      final entries = await _service.listLedger();
      if (mounted) {
        setState(() {
          _summary = summary;
          _entries = entries;
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final balance = ((_summary?['currentBalance'] ?? 0) as num).toDouble();
    final debits = ((_summary?['totalDebits'] ?? 0) as num).toDouble();
    final credits = ((_summary?['totalCredits'] ?? 0) as num).toDouble();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF047857),
        elevation: 0,
        title: const Text(
          'Account Statement',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadLedger,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Balance Metric Cards
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('CURRENT RUNNING BALANCE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                        const SizedBox(height: 6),
                        Text(
                          '₹${balance.abs().toStringAsFixed(2)}',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: balance > 0
                                ? const Color(0xFFE11D48)
                                : balance < 0
                                    ? const Color(0xFF047857)
                                    : const Color(0xFF1E293B),
                          ),
                        ),
                        Text(
                          balance > 0 ? 'Payable to shop (Due)' : balance < 0 ? 'Advance credit' : 'Zero balance',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                        const Divider(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('TOTAL INVOICED', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                                  Text('₹${debits.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A))),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('TOTAL SETTLED', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                                  Text('₹${credits.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF047857))),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),
                  const Text('Transaction Activity', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                  const SizedBox(height: 8),

                  if (_entries.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFE2E8F0))),
                      child: const Center(child: Text('No statement transactions found.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12))),
                    )
                  else
                    ..._entries.map((row) {
                      final isDebit = ((row['debit_amount'] ?? 0) as num) > 0;
                      final amt = isDebit ? ((row['debit_amount'] ?? 0) as num).toDouble() : ((row['credit_amount'] ?? 0) as num).toDouble();
                      final runBal = ((row['running_balance'] ?? 0) as num).toDouble();
                      final desc = row['description']?.toString() ?? (isDebit ? 'Invoice Debit' : 'Payment Credit');
                      final dt = row['entry_date']?.toString() ?? row['createdAt']?.toString();
                      final dateStr = dt != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(dt)) : '';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: ListTile(
                          title: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: isDebit ? const Color(0xFFFFE4E6) : const Color(0xFFD1FAE5),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  isDebit ? 'DEBIT' : 'CREDIT',
                                  style: TextStyle(
                                    color: isDebit ? const Color(0xFFBE123C) : const Color(0xFF047857),
                                    fontSize: 9,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(desc, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12), overflow: TextOverflow.ellipsis),
                              ),
                            ],
                          ),
                          subtitle: Text(dateStr, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '${isDebit ? "+" : "-"}₹${amt.toStringAsFixed(2)}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 13,
                                  color: isDebit ? const Color(0xFFE11D48) : const Color(0xFF047857),
                                ),
                              ),
                              Text('Bal: ₹${runBal.abs().toStringAsFixed(2)}', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
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
}

