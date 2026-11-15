import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/customer_portal_service.dart';
import '../../theme/app_theme.dart';
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
          'My Bills & Invoices',
          style: TextStyle(
            color: AppColors.navy900,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: Column(
        children: [
          // Filter Tabs
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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
          const Divider(height: 1, color: AppColors.border),

          Expanded(
            child: _loading
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: SkeletonLoader.list(count: 6),
                  )
                : _bills.isEmpty
                    ? const Center(
                        child: EmptyState(
                          icon: Icons.receipt_long_outlined,
                          title: 'No Invoices Found',
                          subtitle: 'No bills match your currently selected filter.',
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.blue600,
                        onRefresh: _loadBills,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(14),
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

                            return AppCard(
                              padding: const EdgeInsets.all(14),
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => PortalBillDetailScreen(billId: id)),
                                );
                              },
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(6),
                                            decoration: BoxDecoration(
                                              color: AppColors.blue50,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: const Icon(Icons.receipt_outlined, size: 16, color: AppColors.blue600),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            invNum,
                                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.navy900),
                                          ),
                                        ],
                                      ),
                                      _buildStatusBadge(payStatus),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Date: $dateStr',
                                    style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                                  ),
                                  const Divider(height: 18, color: AppColors.border),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text('TOTAL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                                          const SizedBox(height: 2),
                                          AmountText(amount: total, fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.navy900),
                                        ],
                                      ),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.center,
                                        children: [
                                          const Text('PAID', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                                          const SizedBox(height: 2),
                                          AmountText(amount: paid, fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.success),
                                        ],
                                      ),
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          const Text('DUE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                                          const SizedBox(height: 2),
                                          AmountText(
                                            amount: balanceDue > 0 ? balanceDue : 0.0,
                                            fontSize: 13.5,
                                            fontWeight: FontWeight.w800,
                                            color: balanceDue > 0 ? AppColors.danger : AppColors.success,
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ],
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
    return InkWell(
      onTap: () {
        setState(() => _statusFilter = id);
        _loadBills();
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

  Widget _buildStatusBadge(String status) {
    if (status == 'PAID') {
      return const StatusChip(label: 'PAID', variant: StatusChipVariant.success);
    } else if (status == 'PARTIAL') {
      return const StatusChip(label: 'PARTIAL', variant: StatusChipVariant.warning);
    }
    return const StatusChip(label: 'UNPAID', variant: StatusChipVariant.danger);
  }
}
