import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/saved_bill.dart';
import '../navigation/app_navigation.dart';
import '../providers/auth_provider.dart';
import '../providers/bills_provider.dart';
import '../providers/notifications_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bottom_nav.dart';
import 'order_cart_screen.dart';
import 'notifications_screen.dart';

class BillsListScreen extends StatefulWidget {
  final ValueChanged<int> onNavigate;

  const BillsListScreen({super.key, required this.onNavigate});

  @override
  State<BillsListScreen> createState() => _BillsListScreenState();
}

class _BillsListScreenState extends State<BillsListScreen> {
  final _searchCtrl = TextEditingController();
  final _money = NumberFormat('#,##0');
  final _dateFormat = DateFormat('dd MMM yyyy');

  String _selectedStatusFilter = 'All'; // All, Unpaid, Partial, Paid
  String _selectedPeriodFilter = 'This Month';
  bool _searchOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final billsProvider = context.read<BillsProvider>();
      if (!billsProvider.loaded) {
        billsProvider.load();
      }
      billsProvider.syncFromSupabase();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final billsProvider = context.watch<BillsProvider>();
    final realBills = billsProvider.bills;

    final shopName = auth.shopName.isNotEmpty ? auth.shopName : 'NSYU';
    final shopPhone = auth.shopPhone;

    // Real database bills
    final allBillsList = List<SavedBill>.from(realBills);
    allBillsList.sort((a, b) => b.date.compareTo(a.date));

    // Filter bills: support searching with or without '#', '-', e.g. INV000017, #INV000017, ORD...
    final query = _searchCtrl.text.trim().toLowerCase();
    final cleanQuery = query.replaceAll('#', '').replaceAll('-', '').trim();
    final filteredBills = allBillsList.where((b) {
      if (query.isNotEmpty) {
        final rawNum = b.billNumber.toLowerCase();
        final dispNum = b.displayBillNumber.toLowerCase();
        final rawClean = rawNum.replaceAll('#', '').replaceAll('-', '');
        final dispClean = dispNum.replaceAll('#', '').replaceAll('-', '');

        final matchesQuery = b.customerName.toLowerCase().contains(query) ||
            rawNum.contains(query) ||
            dispNum.contains(query) ||
            (cleanQuery.isNotEmpty && (rawClean.contains(cleanQuery) || dispClean.contains(cleanQuery)));
        if (!matchesQuery) return false;
      }
      final isPaid = b.isPaid || b.due <= 0;
      final isPartial = !isPaid && b.paidAmount > 0;
      final isUnpaid = !isPaid && b.paidAmount <= 0;

      if (_selectedStatusFilter == 'Paid' && !isPaid) return false;
      if (_selectedStatusFilter == 'Unpaid' && !isUnpaid) return false;
      if (_selectedStatusFilter == 'Partial' && !isPartial) return false;
      return true;
    }).toList();

    final totalCount = allBillsList.length;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // Top App Bar — Clean, White & Navy Header
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
              child: Row(
                children: [
                  // Emerald Monogram Avatar
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFF064E3B), Color(0xFF047857)],
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF047857).withValues(alpha: 0.25),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      shopName.isNotEmpty ? shopName[0].toUpperCase() : 'N',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // NSYU ▾ and Phone Number
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              shopName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.keyboard_arrow_down, size: 18, color: Color(0xFF64748B)),
                          ],
                        ),
                        if (shopPhone.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            shopPhone,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Share, Notifications, Search
                  IconButton(
                    icon: const Icon(Icons.share_outlined, color: Color(0xFF475569), size: 21),
                    onPressed: () {},
                  ),
                  Builder(builder: (ctx) {
                    final unread = ctx.watch<NotificationsProvider>().unreadCount;
                    return IconButton(
                      icon: Badge(
                        isLabelVisible: unread > 0,
                        label: Text('$unread', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                        backgroundColor: const Color(0xFFEF4444),
                        child: const Icon(Icons.notifications_outlined, color: Color(0xFF475569), size: 23),
                      ),
                      onPressed: () {
                        final notifs = ctx.read<NotificationsProvider>();
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationsScreen())).then((_) {
                          notifs.fetchUnreadCount();
                        });
                      },
                    );
                  }),
                  IconButton(
                    icon: Icon(_searchOpen ? Icons.close : Icons.search, color: const Color(0xFF475569), size: 22),
                    onPressed: () {
                      setState(() {
                        _searchOpen = !_searchOpen;
                        if (!_searchOpen) _searchCtrl.clear();
                      });
                    },
                  ),
                ],
              ),
            ),

            // Secondary Row: Bills / All Bills & Filter, + New Bill button
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Bills',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy900,
                          ),
                        ),
                        Text(
                          'All Bills ($totalCount)',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.filter_list_rounded, color: AppColors.navy900, size: 22),
                    tooltip: 'Filter period',
                    onPressed: _showPeriodPicker,
                  ),
                  const SizedBox(width: 6),
                  ElevatedButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                      );
                    },
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text(
                      'New Bill',
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.navy900,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ],
              ),
            ),

            if (_searchOpen)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: AppColors.bg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: TextField(
                    controller: _searchCtrl,
                    autofocus: true,
                    onChanged: (v) => setState(() {}),
                    decoration: const InputDecoration(
                      hintText: 'Search by bill number or customer name...',
                      hintStyle: TextStyle(fontSize: 12.5, color: AppColors.textSecondary),
                      prefixIcon: Icon(Icons.search, size: 18, color: AppColors.textSecondary),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 10),
                      isDense: true,
                    ),
                  ),
                ),
              ),

            // ── Horizontal Filter Chips ──
            _buildFilterChipsRow(),
            const Divider(height: 1, color: AppColors.border),

            // ── Bills List View ──
            if (!billsProvider.loaded)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: SkeletonLoader.list(count: 6),
                ),
              )
            else if (filteredBills.isEmpty)
              Expanded(
                child: EmptyState(
                  icon: Icons.receipt_long_outlined,
                  title: 'No bills found',
                  subtitle: 'Create your first bill by tapping "+ New Bill"',
                  buttonLabel: '+ New Bill',
                  onButtonPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                    );
                  },
                ),
              )
            else
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 90),
                  itemCount: filteredBills.length,
                  itemBuilder: (ctx, i) => _buildRealBillTile(filteredBills[i]),
                ),
              ),
          ],
        ),
      ),
      bottomNavigationBar: AppBottomNav(currentIndex: 1, onTap: widget.onNavigate),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HORIZONTAL FILTER CHIPS: All | Unpaid | Partial | Paid | 📅 This Month ▾
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildFilterChipsRow() {
    final statuses = ['All', 'Unpaid', 'Partial', 'Paid'];

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            ...statuses.map((s) {
              final isSelected = _selectedStatusFilter == s;
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: InkWell(
                  onTap: () => setState(() => _selectedStatusFilter = s),
                  borderRadius: BorderRadius.circular(20),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? AppColors.blue50 : AppColors.bg,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? AppColors.blue600 : AppColors.border,
                        width: isSelected ? 1.4 : 1.0,
                      ),
                    ),
                    child: Text(
                      s,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? AppColors.navy900 : AppColors.textSecondary,
                      ),
                    ),
                  ),
                ),
              );
            }),

            // Period Dropdown: 📅 This Month ▾
            InkWell(
              onTap: _showPeriodPicker,
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.bg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, size: 13, color: AppColors.textSecondary),
                    const SizedBox(width: 6),
                    Text(
                      _selectedPeriodFilter,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.keyboard_arrow_down, size: 16, color: AppColors.textSecondary),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BILL LIST TILES
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildRealBillTile(SavedBill b) {
    final isPaid = b.isPaid || b.due <= 0;
    final isPartial = !isPaid && b.paidAmount > 0;
    final status = isPaid ? 'Paid' : (isPartial ? 'Partial' : 'Unpaid');
    final initial = b.customerName.isNotEmpty ? b.customerName[0].toUpperCase() : 'C';

    return InkWell(
      onTap: () {
        AppNavigation.openBillDetails(context, bill: b);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.border)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.navy900, AppColors.blue600],
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Text(
                initial,
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
                children: [
                  // Row 1: Customer Name & Status Badge
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          b.customerName,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      StatusChip(
                        label: status,
                        variant: isPaid
                            ? StatusChipVariant.success
                            : (isPartial ? StatusChipVariant.warning : StatusChipVariant.danger),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),

                  // Row 2: Bill # & Date ... Total Amount
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Bill #${b.displayBillNumber} • ${_dateFormat.format(b.date)}',
                          style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      AmountText(
                        amount: b.total,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: isPaid ? AppColors.success : AppColors.danger,
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),

                  // Row 3: Items count ... Paid amount (if partial) ... Chevron
                  Row(
                    children: [
                      const Icon(Icons.receipt_outlined, size: 13, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Text(
                        '${b.items.length} ${b.items.length == 1 ? "item" : "items"}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                      const Spacer(),
                      if (isPartial) ...[
                        Text(
                          'Paid: ₹${_money.format(b.paidAmount)}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.success),
                        ),
                        const SizedBox(width: 6),
                      ],
                      const Icon(Icons.chevron_right, size: 16, color: AppColors.textSecondary),
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

  void _showPeriodPicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Select Period', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 14),
            ...['Today', 'This Week', 'This Month', 'Last 3 Months', 'All Time'].map(
              (p) => ListTile(
                title: Text(p),
                trailing: _selectedPeriodFilter == p ? const Icon(Icons.check, color: Color(0xFF16A34A)) : null,
                onTap: () {
                  setState(() => _selectedPeriodFilter = p);
                  Navigator.pop(ctx);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
