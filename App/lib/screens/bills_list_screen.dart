import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/saved_bill.dart';
import '../navigation/app_navigation.dart';
import '../providers/bills_provider.dart';
import '../services/bill_pdf_service.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bottom_nav.dart';
import 'bill_screen.dart';

class BillsListScreen extends StatefulWidget {
  final ValueChanged<int> onNavigate;

  const BillsListScreen({super.key, required this.onNavigate});

  @override
  State<BillsListScreen> createState() => _BillsListScreenState();
}

class _BillsListScreenState extends State<BillsListScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 4, vsync: this);
  final _searchCtrl = TextEditingController();
  String _query = '';
  DateTime? _selectedDate;

  @override
  void dispose() {
    _tabs.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  static const _statuses = <BillStatus?>[null, BillStatus.paid, BillStatus.unpaid, BillStatus.cancelled];

  @override
  Widget build(BuildContext context) {
    final bills = context.watch<BillsProvider>();
    final money = NumberFormat('#,##0');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bills'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Paid'),
            Tab(text: 'Pending'),
            Tab(text: 'Cancelled'),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _query = v),
              decoration: const InputDecoration(
                hintText: 'Search by Label, Bill No. or Customer',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          _dateNavigator(),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                for (final status in _statuses) _billList(bills, money, status),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        heroTag: 'bills_fab',
        backgroundColor: const Color(0xFF1D4ED8),
        onPressed: () => AppNavigation.openCreateBill(context),
        tooltip: 'Create a new bill',
        child: const Icon(Icons.add, color: Colors.white),
      ),
      bottomNavigationBar: AppBottomNav(currentIndex: 2, onTap: widget.onNavigate),
    );
  }

  Widget _dateNavigator() {
    final label = _selectedDate == null
        ? 'All Dates'
        : DateFormat('dd MMM yyyy').format(_selectedDate!);
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left),
            onPressed: () => setState(() {
              _selectedDate =
                  (_selectedDate ?? DateTime.now()).subtract(const Duration(days: 1));
            }),
          ),
          Expanded(
            child: InkWell(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _selectedDate ?? DateTime.now(),
                  firstDate: DateTime(2020),
                  lastDate: DateTime(2100),
                );
                if (picked != null) setState(() => _selectedDate = picked);
              },
              child: Center(
                child: Text(label,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right),
            onPressed: () => setState(() {
              _selectedDate =
                  (_selectedDate ?? DateTime.now()).add(const Duration(days: 1));
            }),
          ),
          if (_selectedDate != null)
            IconButton(
              tooltip: 'Show all dates',
              icon: const Icon(Icons.close, size: 18),
              onPressed: () => setState(() => _selectedDate = null),
            ),
        ],
      ),
    );
  }

  Widget _billList(BillsProvider bills, NumberFormat money, BillStatus? status) {
    if (!bills.loaded) {
      return const Center(child: CircularProgressIndicator());
    }
    var list = bills.search(bills.billsByStatus(status), _query);
    if (_selectedDate != null) {
      list = list
          .where((b) =>
              b.date.year == _selectedDate!.year &&
              b.date.month == _selectedDate!.month &&
              b.date.day == _selectedDate!.day)
          .toList();
    }

    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.receipt_long_outlined, size: 40, color: AppColors.muted.withOpacity(0.5)),
              const SizedBox(height: 12),
              const Text('No bills here yet', style: AppTextStyles.body),
              const SizedBox(height: 4),
              const Text(
                'Bills you create will show up here',
                style: AppTextStyles.hint,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 90),
      itemCount: list.length,
      itemBuilder: (context, i) => _billTile(context, bills, list[i], money),
    );
  }

  Widget _billTile(BuildContext context, BillsProvider bills, SavedBill b, NumberFormat money) {
    final color = switch (b.status) {
      BillStatus.paid => AppColors.billGreen,
      BillStatus.unpaid => AppColors.red,
      BillStatus.cancelled => AppColors.muted,
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: const Icon(Icons.description_outlined, color: AppColors.steelBlue),
        title: Text(
          b.customerBillLabel,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, letterSpacing: -0.2),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Inv: #${b.billNumber} · ${b.customerName.isEmpty ? 'Walk-in' : b.customerName}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.muted),
              ),
              const SizedBox(height: 2),
              Text(
                DateFormat('dd MMM yyyy, hh:mm a').format(b.date),
                style: const TextStyle(fontSize: 11, color: AppColors.silverDark),
              ),
            ],
          ),
        ),
        trailing: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('₹${money.format(b.total)}', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 3),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                b.status.label,
                style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        onTap: () => AppNavigation.openBillDetails(context, bill: b),
      ),
    );
  }

  void _openBillSheet(BuildContext context, BillsProvider bills, SavedBill b) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          expand: false,
          builder: (ctx, scrollCtrl) {
            return ListView(
              controller: scrollCtrl,
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  b.customerBillLabel,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.steelBlue),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.steelBlue.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'Inv: #${b.billNumber}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.steelBlue),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        b.customerName.isEmpty ? 'Walk-in customer' : b.customerName,
                        style: const TextStyle(fontSize: 13, color: AppColors.muted, fontWeight: FontWeight.w500),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormat('dd MMM yyyy, hh:mm a').format(b.date),
                  style: const TextStyle(fontSize: 12, color: AppColors.silverDark),
                ),
                const SizedBox(height: 12),
                for (final item in b.items)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(child: Text(item.desc)),
                        Text('${item.qty} × ₹${item.price.toStringAsFixed(0)}'),
                        const SizedBox(width: 10),
                        SizedBox(
                          width: 70,
                          child: Text('₹${item.amount.toStringAsFixed(0)}',
                              textAlign: TextAlign.right),
                        ),
                      ],
                    ),
                  ),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total', style: TextStyle(fontWeight: FontWeight.w800)),
                    Text('₹${b.total.toStringAsFixed(0)}',
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                  ],
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final s in BillStatus.values)
                      ChoiceChip(
                        label: Text(s.label),
                        selected: b.status == s,
                        onSelected: (_) {
                          bills.setStatus(b.billNumber, s);
                          Navigator.pop(ctx);
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => BillPdfService.previewAndPrint(b.toPdfData()),
                        icon: const Icon(Icons.print_outlined),
                        label: const Text('Print'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => BillPdfService.shareBill(b.toPdfData()),
                        icon: const Icon(Icons.share),
                        label: const Text('Share'),
                      ),
                    ),
                  ],
                ),
                if (b.imagePath != null && File(b.imagePath!).existsSync()) ...[
                  const SizedBox(height: 16),
                  const Text('Saved photo copy:', style: TextStyle(color: AppColors.muted, fontSize: 12)),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.file(File(b.imagePath!)),
                  ),
                ],
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: () {
                    bills.deleteBill(b.billNumber);
                    Navigator.pop(ctx);
                  },
                  icon: const Icon(Icons.delete_outline, color: AppColors.red),
                  label: const Text('Delete bill', style: TextStyle(color: AppColors.red)),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
