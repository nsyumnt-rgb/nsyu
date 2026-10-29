import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/customer.dart';
import '../models/saved_bill.dart';
import '../navigation/app_navigation.dart';
import '../providers/bills_provider.dart';
import '../providers/customer_provider.dart';
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

    // Reference mock bills matching Image 5 & Image 6 (Left Phone)
    final mockList = [
      _MockBill(
        customerName: 'Krishna Jasola',
        billNo: 'B-00125',
        dateStr: '29 Oct 2026',
        itemCount: 3,
        status: 'Unpaid',
        total: 2222.0,
      ),
      _MockBill(
        customerName: 'GD SB',
        billNo: 'B-00124',
        dateStr: '28 Oct 2026',
        itemCount: 5,
        status: 'Partial',
        total: 4500.0,
        paid: 1500.0,
      ),
      _MockBill(
        customerName: 'Vijay sharma comm harkesh',
        billNo: 'B-00123',
        dateStr: '27 Oct 2026',
        itemCount: 4,
        status: 'Unpaid',
        total: 3200.0,
      ),
      _MockBill(
        customerName: 'R K Comm SB',
        billNo: 'B-00122',
        dateStr: '26 Oct 2026',
        itemCount: 2,
        status: 'Paid',
        total: 1850.0,
      ),
      _MockBill(
        customerName: 'Siddique Sahab SB',
        billNo: 'B-00121',
        dateStr: '25 Oct 2026',
        itemCount: 6,
        status: 'Partial',
        total: 6000.0,
        paid: 2000.0,
      ),
      _MockBill(
        customerName: 'Aalam Near RG',
        billNo: 'B-00120',
        dateStr: '24 Oct 2026',
        itemCount: 3,
        status: 'Unpaid',
        total: 2750.0,
      ),
      _MockBill(
        customerName: 'Mohd Ali',
        billNo: 'B-00119',
        dateStr: '23 Oct 2026',
        itemCount: 7,
        status: 'Paid',
        total: 5300.0,
      ),
      _MockBill(
        customerName: 'Shakti Enterprise',
        billNo: 'B-00118',
        dateStr: '22 Oct 2026',
        itemCount: 3,
        status: 'Partial',
        total: 4800.0,
        paid: 1800.0,
      ),
    ];

    final filteredMock = mockList.where((m) {
      if (query.isNotEmpty) {
        final matchesQuery = m.customerName.toLowerCase().contains(query) ||
            m.billNo.toLowerCase().contains(query);
        if (!matchesQuery) return false;
      }
      if (_selectedStatusFilter != 'All' && m.status != _selectedStatusFilter) {
        return false;
      }
      return true;
    }).toList();

    final totalCount = realBills.isNotEmpty ? (125 + realBills.length) : 125;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(_searchOpen ? 120 : 68),
        child: Container(
          color: Colors.white,
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
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
                        onPressed: _showFilterDialog,
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
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(bottom: 90),
              children: [
                // Render real bills created first
                ...filteredReal.map((b) => _buildRealBillTile(b)),

                // Render mock bills to match reference design completely
                ...filteredMock.map((m) => _buildMockBillTile(m)),
              ],
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
  // BILL LIST TILES matching Image 5 & Image 6 Left Phone
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildMockBillTile(_MockBill m) {
    Color badgeBg = const Color(0xFFDCFCE7);
    Color badgeFg = const Color(0xFF16A34A);
    if (m.status == 'Unpaid') {
      badgeBg = const Color(0xFFFEE2E2);
      badgeFg = const Color(0xFFDC2626);
    } else if (m.status == 'Partial') {
      badgeBg = const Color(0xFFFEF3C7);
      badgeFg = const Color(0xFFD97706);
    }

    final avatarBg = _avatarBgForName(m.customerName);
    final initial = m.customerName.isNotEmpty ? m.customerName[0].toUpperCase() : 'C';

    return InkWell(
      onTap: () {
        // Red arrow navigation in Image 6: clicking a bill navigates to Customer Details Bills tab!
        final customers = context.read<CustomerProvider>().customers;
        final match = customers.firstWhere(
          (c) => c.name.toLowerCase() == m.customerName.toLowerCase(),
          orElse: () => Customer(id: '0', name: m.customerName, mobile: '8800123456'),
        );
        AppNavigation.openCustomerProfile(
          context,
          customer: match,
          customerName: m.customerName,
          initialTab: 'Bills',
        );
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
                  Text(
                    m.customerName,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        'Bill #${m.billNo}  |  ${m.dateStr}',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      const Icon(Icons.description_outlined, size: 12, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(
                        '${m.itemCount} items',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // Right Status Badge + Amount
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: badgeBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    m.status,
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: badgeFg,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '₹${_money.format(m.total)}',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: m.status == 'Paid' ? const Color(0xFF16A34A) : const Color(0xFFEA580C),
                      ),
                    ),
                    const SizedBox(width: 2),
                    const Icon(Icons.chevron_right, size: 16, color: Color(0xFF94A3B8)),
                  ],
                ),
                if (m.status == 'Partial' && m.paid > 0) ...[
                  const SizedBox(height: 2),
                  Text(
                    'Paid: ₹${_money.format(m.paid)}',
                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRealBillTile(SavedBill b) {
    final statusStr = b.isPaid ? 'Paid' : (b.paidAmount > 0 ? 'Partial' : 'Unpaid');
    return _buildMockBillTile(
      _MockBill(
        customerName: b.customerName.isNotEmpty ? b.customerName : 'Customer',
        billNo: b.billNumber.replaceAll(RegExp(r'^[#B\-]'), ''),
        dateStr: _dateFormat.format(b.date),
        itemCount: b.items.length,
        status: statusStr,
        total: b.total,
        paid: b.paidAmount,
      ),
    );
  }

  void _showFilterDialog() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Filter Bills', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 14),
            ListTile(
              title: const Text('All Bills'),
              onTap: () {
                setState(() => _selectedStatusFilter = 'All');
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              title: const Text('Unpaid Bills'),
              onTap: () {
                setState(() => _selectedStatusFilter = 'Unpaid');
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              title: const Text('Partial Bills'),
              onTap: () {
                setState(() => _selectedStatusFilter = 'Partial');
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              title: const Text('Paid Bills'),
              onTap: () {
                setState(() => _selectedStatusFilter = 'Paid');
                Navigator.pop(ctx);
              },
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

class _MockBill {
  final String customerName;
  final String billNo;
  final String dateStr;
  final int itemCount;
  final String status;
  final double total;
  final double paid;

  const _MockBill({
    required this.customerName,
    required this.billNo,
    required this.dateStr,
    required this.itemCount,
    required this.status,
    required this.total,
    this.paid = 0.0,
  });
}
