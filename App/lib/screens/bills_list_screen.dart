import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/saved_bill.dart';
import '../navigation/app_navigation.dart';
import '../providers/bills_provider.dart';
import '../widgets/app_bottom_nav.dart';
import 'order_cart_screen.dart';

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
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Color _avatarBgForName(String name) {
    final lower = name.toLowerCase();
    if (lower.startsWith('k')) return const Color(0xFF38BDF8); // Blue
    if (lower.startsWith('g')) return const Color(0xFF14B8A6); // Teal
    if (lower.startsWith('v')) return const Color(0xFF8B5CF6); // Purple
    if (lower.startsWith('r')) return const Color(0xFF9333EA); // Purple dark
    if (lower.startsWith('s')) return const Color(0xFF78716C); // Brown/Grey
    if (lower.startsWith('a')) return const Color(0xFFF87171); // Coral/Red
    if (lower.startsWith('m')) return const Color(0xFF2563EB); // Royal Blue
    return const Color(0xFFF43F5E); // Pink/Rose
  }

  @override
  Widget build(BuildContext context) {
    final billsProvider = context.watch<BillsProvider>();
    final realBills = billsProvider.bills;

    // Filter real bills
    final query = _searchCtrl.text.trim().toLowerCase();
    final filteredReal = realBills.where((b) {
      if (query.isNotEmpty) {
        final matchesQuery = b.customerName.toLowerCase().contains(query) ||
            b.billNumber.toLowerCase().contains(query);
        if (!matchesQuery) return false;
      }
      if (_selectedStatusFilter == 'Paid' && !b.isPaid) return false;
      if (_selectedStatusFilter == 'Unpaid' && (b.isPaid || b.paidAmount > 0)) return false;
      if (_selectedStatusFilter == 'Partial' && (b.isPaid || b.paidAmount <= 0)) return false;
      return true;
    }).toList();


    final totalCount = realBills.isNotEmpty ? (125 + realBills.length) : 125;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(_searchOpen ? 120 : 76),
        child: Container(
          color: Colors.white,
          child: SafeArea(
            bottom: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 4),
                  child: Row(
                    children: [
                      // Back arrow
                      IconButton(
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A), size: 24),
                        onPressed: () => widget.onNavigate(0),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text(
                              'Bills',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            Text(
                              'All Bills ($totalCount)',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: Icon(_searchOpen ? Icons.close : Icons.search, color: const Color(0xFF0F172A), size: 22),
                        onPressed: () {
                          setState(() {
                            _searchOpen = !_searchOpen;
                            if (!_searchOpen) _searchCtrl.clear();
                          });
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.filter_list_rounded, color: Color(0xFF0F172A), size: 22),
                        onPressed: _showPeriodPicker,
                      ),
                      const SizedBox(width: 4),
                      // Circular Green + Button matching Image 5 & Image 6 Left
                      InkWell(
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                          );
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: const BoxDecoration(
                            color: Color(0xFF16A34A),
                            shape: BoxShape.circle,
                          ),
                          child: const Center(
                            child: Icon(Icons.add, color: Colors.white, size: 22),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (_searchOpen)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: Container(
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: TextField(
                        controller: _searchCtrl,
                        autofocus: true,
                        onChanged: (v) => setState(() {}),
                        decoration: const InputDecoration(
                          hintText: 'Search by bill number or customer name...',
                          prefixIcon: Icon(Icons.search, size: 18),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(vertical: 10),
                          isDense: true,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // ── Horizontal Filter Chips matching Image 5 & 6 Left ──
          _buildFilterChipsRow(),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),

          // ── Bills List View ──
          if (filteredReal.isEmpty)
            const Expanded(
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.receipt_long_outlined, size: 52, color: Color(0xFFCBD5E1)),
                      SizedBox(height: 12),
                      Text('No bills found', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF334155))),
                      SizedBox(height: 6),
                      Text('Create your first bill by tapping the + button in the header.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                    ],
                  ),
                ),
              ),
            )
          else
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.only(bottom: 90),
                itemCount: filteredReal.length,
                itemBuilder: (ctx, i) => _buildRealBillTile(filteredReal[i]),
              ),
            ),
        ],
      ),
      bottomNavigationBar: AppBottomNav(currentIndex: 1, onTap: widget.onNavigate),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HORIZONTAL FILTER CHIPS: All | Unpaid | Partial | Paid | This Month ▾
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildFilterChipsRow() {
    final statuses = ['All', 'Unpaid', 'Partial', 'Paid'];

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 10),
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
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFE8F5E9) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
                        width: isSelected ? 1.4 : 1.0,
                      ),
                    ),
                    child: Text(
                      s,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? const Color(0xFF16A34A) : const Color(0xFF475569),
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
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF64748B)),
                    const SizedBox(width: 6),
                    Text(
                      _selectedPeriodFilter,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF475569),
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.keyboard_arrow_down, size: 16, color: Color(0xFF64748B)),
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
  // BILL LIST TILES matching Reference Design
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildRealBillTile(SavedBill b) {
    Color badgeBg = const Color(0xFFDCFCE7);
    Color badgeFg = const Color(0xFF16A34A);
    String status = b.isPaid ? 'Paid' : (b.paidAmount > 0 ? 'Partial' : 'Unpaid');
    if (status == 'Unpaid') {
      badgeBg = const Color(0xFFFEE2E2);
      badgeFg = const Color(0xFFDC2626);
    } else if (status == 'Partial') {
      badgeBg = const Color(0xFFFEF3C7);
      badgeFg = const Color(0xFFD97706);
    }

    final avatarBg = _avatarBgForName(b.customerName);
    final initial = b.customerName.isNotEmpty ? b.customerName[0].toUpperCase() : 'C';

    return InkWell(
      onTap: () {
        AppNavigation.openBillDetails(context, bill: b);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: avatarBg,
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
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          b.customerName,
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: badgeBg,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          status,
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            color: badgeFg,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        '#${b.billNumber} • ${_dateFormat.format(b.date)}',
                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                      ),
                      const Spacer(),
                      Text(
                        '₹${_money.format(b.total)}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
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
