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
  String _statusFilter = 'all'; // 'all', 'unpaid', 'partial', 'paid'
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
        backgroundColor: const Color(0xFF1D4ED8),
        elevation: 0,
        title: const Text(
          'My Bills & Invoices',
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
                _buildFilterChip('All', 'all'),
                const SizedBox(width: 8),
                _buildFilterChip('Unpaid', 'unpaid'),
                const SizedBox(width: 8),
                _buildFilterChip('Partial', 'partial'),
                const SizedBox(width: 8),
                _buildFilterChip('Paid', 'paid'),
              ],
            ),
          ),

          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF1D4ED8)))
                : _bills.isEmpty
                    ? const Center(
                        child: Text(
                          'No invoices found for this filter.',
                          style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        ),
                      )
                    : RefreshIndicator(
                        color: const Color(0xFF1D4ED8),
                        onRefresh: _loadBills,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: _bills.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, idx) {
                            final b = _bills[idx];
                            final id = (b['id'] as num).toInt();
                            final invNum = b['invoice_number']?.toString() ?? 'INV-$id';
                            final total = ((b['total_amount'] ?? 0) as num).toDouble();
                            final paid = ((b['paid_amount'] ?? 0) as num).toDouble();
                            final balanceDue = total - paid;
                            final payStatus = (b['payment_status']?.toString() ?? 'unpaid').toUpperCase();
                            final dt = b['date']?.toString() ?? b['createdAt']?.toString();
                            final dateStr = dt != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(dt)) : '';

                            return Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                boxShadow: const [
                                  BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
                                ],
                              ),
                              child: InkWell(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => PortalBillDetailScreen(billId: id)),
                                  );
                                },
                                borderRadius: BorderRadius.circular(14),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Row(
                                            children: [
                                              const Icon(Icons.receipt_outlined, size: 18, color: Color(0xFF1D4ED8)),
                                              const SizedBox(width: 6),
                                              Text(
                                                invNum,
                                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A)),
                                              ),
                                            ],
                                          ),
                                          _buildStatusBadge(payStatus),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        'Date: $dateStr',
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                      ),
                                      const Divider(height: 16),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text('TOTAL AMOUNT', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                                              const SizedBox(height: 2),
                                              Text('₹${total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A))),
                                            ],
                                          ),
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.center,
                                            children: [
                                              const Text('PAID AMOUNT', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                                              const SizedBox(height: 2),
                                              Text('₹${paid.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF16A34A))),
                                            ],
                                          ),
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.end,
                                            children: [
                                              const Text('DUE AMOUNT', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                                              const SizedBox(height: 2),
                                              Text(
                                                '₹${balanceDue > 0 ? balanceDue.toStringAsFixed(2) : "0.00"}',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.w900,
                                                  fontSize: 13,
                                                  color: balanceDue > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                                                ),
                                              ),
                                            ],
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
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String id) {
    final isSel = _statusFilter == id;
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
          setState(() => _statusFilter = id);
          _loadBills();
        }
      },
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = const Color(0xFFFEE2E2);
    Color text = const Color(0xFFDC2626);
    if (status == 'PAID') {
      bg = const Color(0xFFDCFCE7);
      text = const Color(0xFF16A34A);
    } else if (status == 'PARTIAL') {
      bg = const Color(0xFFFEF3C7);
      text = const Color(0xFFB45309);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        status,
        style: TextStyle(color: text, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}
