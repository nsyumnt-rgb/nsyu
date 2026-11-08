import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/customer_portal_service.dart';
import 'portal_bill_detail_screen.dart';

class PortalBillsScreen extends StatefulWidget {
  const PortalBillsScreen({super.key});

  @override
  State<PortalBillsScreen> createState() => _PortalBillsScreenState();
}

class _PortalBillsScreenState extends State<PortalBillsScreen> {
  final CustomerPortalService _service = CustomerPortalService();
  String _statusFilter = 'all';
  List<Map<String, dynamic>> _bills = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadBills();
  }

  Future<void> _loadBills() async {
    setState(() => _loading = true);
    try {
      final bills = await _service.listBills(
        status: _statusFilter != 'all' ? _statusFilter : null,
      );
      if (mounted) setState(() => _bills = bills);
    } catch (_) {
      if (mounted) setState(() => _bills = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF047857),
        elevation: 0,
        title: const Text(
          'Bills & Invoices',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          // Filter Tabs
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                ChoiceChip(
                  label: const Text('All'),
                  selected: _statusFilter == 'all',
                  onSelected: (val) {
                    setState(() => _statusFilter = 'all');
                    _loadBills();
                  },
                  selectedColor: const Color(0xFF047857),
                  labelStyle: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: _statusFilter == 'all' ? Colors.white : const Color(0xFF475569),
                  ),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Unpaid'),
                  selected: _statusFilter == 'unpaid',
                  onSelected: (val) {
                    setState(() => _statusFilter = 'unpaid');
                    _loadBills();
                  },
                  selectedColor: const Color(0xFF047857),
                  labelStyle: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: _statusFilter == 'unpaid' ? Colors.white : const Color(0xFF475569),
                  ),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('Paid'),
                  selected: _statusFilter == 'paid',
                  onSelected: (val) {
                    setState(() => _statusFilter = 'paid');
                    _loadBills();
                  },
                  selectedColor: const Color(0xFF047857),
                  labelStyle: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: _statusFilter == 'paid' ? Colors.white : const Color(0xFF475569),
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _bills.isEmpty
                    ? const Center(
                        child: Text(
                          'No invoices found.',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadBills,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: _bills.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, idx) {
                            final b = _bills[idx];
                            final id = (b['id'] as num).toInt();
                            final invNum = b['invoice_number']?.toString() ?? 'INV-$id';
                            final total = ((b['total_amount'] ?? 0) as num).toDouble();
                            final paid = ((b['paid_amount'] ?? 0) as num).toDouble();
                            final balanceDue = total - paid;
                            final payStatus = b['payment_status']?.toString() ?? 'unpaid';
                            final dt = b['createdAt']?.toString() ?? b['date']?.toString();
                            final dateStr = dt != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(dt)) : '';

                            return Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: ListTile(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => PortalBillDetailScreen(billId: id)),
                                  );
                                },
                                title: Row(
                                  children: [
                                    Text(invNum, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    const SizedBox(width: 8),
                                    _buildStatusPill(payStatus),
                                  ],
                                ),
                                subtitle: Text(dateStr, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                trailing: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      '₹${total.toStringAsFixed(2)}',
                                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0F172A)),
                                    ),
                                    if (balanceDue > 0)
                                      Text(
                                        'Due: ₹${balanceDue.toStringAsFixed(2)}',
                                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFE11D48)),
                                      ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusPill(String status) {
    Color bg = const Color(0xFFFEF3C7);
    Color text = const Color(0xFFB45309);
    if (status == 'paid') {
      bg = const Color(0xFFD1FAE5);
      text = const Color(0xFF047857);
    } else if (status == 'unpaid') {
      bg = const Color(0xFFFFE4E6);
      text = const Color(0xFFBE123C);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(color: text, fontSize: 8, fontWeight: FontWeight.bold),
      ),
    );
  }
}

