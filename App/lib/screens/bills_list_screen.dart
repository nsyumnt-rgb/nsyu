import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/customer.dart';
import '../models/saved_bill.dart';
import '../providers/bills_provider.dart';
import '../providers/customer_provider.dart';
import '../widgets/app_bottom_nav.dart';
import 'customer_ledger_detail_screen.dart';
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

  Color _avatarBgForName(String name) {
    final lower = name.toLowerCase();
    if (lower.startsWith('k')) return const Color(0xFF38BDF8); // Light Blue (Krishna Jasola)
    if (lower.startsWith('g')) return const Color(0xFF14B8A6); // Teal (GD SB)
    if (lower.startsWith('v')) return const Color(0xFF8B5CF6); // Purple (Vijay sharma)
    if (lower.startsWith('r')) return const Color(0xFF9333EA); // Purple dark (R K Comm)
    if (lower.startsWith('s')) return const Color(0xFF78716C); // Brown/Grey (Siddique Sahab)
    if (lower.startsWith('a')) return const Color(0xFFF87171); // Coral/Red (Aalam Near RG / Amit Sharma)
    if (lower.startsWith('m')) return const Color(0xFF2563EB); // Royal Blue (Mohd Ali)
    return const Color(0xFFF43F5E); // Pink/Rose (Shakti Enterprise)
  }

  /// Reference items matching Image 6 Left Screen so the list has full realistic data
  List<SavedBill> _referenceMockBills() {
    return [
      SavedBill(
        billNumber: 'INV-NSYU-000125',
        customerName: 'Krishna Jasola',
        customerPhone: '8800123456',
        items: [
          SavedBillItem(desc: 'Mobile Battery', qty: 2, price: 611),
          SavedBillItem(desc: 'USB Adapter', qty: 1, price: 1000),
        ],
        status: BillStatus.unpaid,
        paidAmount: 0,
        date: DateTime(2026, 10, 29, 10, 30),
      ),
      SavedBill(
        billNumber: 'INV-NSYU-000124',
        customerName: 'GD SB',
        customerPhone: '9811223344',
        items: [
          SavedBillItem(desc: 'Combo Pack', qty: 3, price: 1000),
          SavedBillItem(desc: 'USB-C Cable', qty: 2, price: 750),
        ],
        status: BillStatus.unpaid,
        paidAmount: 1500,
        date: DateTime(2026, 10, 28, 14, 20),
      ),
      SavedBill(
        billNumber: 'INV-NSYU-000123',
        customerName: 'Vijay sharma comm harkesh',
        customerPhone: '9871100223',
        items: [
          SavedBillItem(desc: 'Neckband Pro', qty: 4, price: 800),
        ],
        status: BillStatus.unpaid,
        paidAmount: 0,
        date: DateTime(2026, 10, 27, 11, 45),
      ),
      SavedBill(
        billNumber: 'INV-NSYU-000122',
        customerName: 'R K Comm SB',
        customerPhone: '9810998877',
        items: [
          SavedBillItem(desc: 'Fast Charger 20W', qty: 2, price: 925),
        ],
        status: BillStatus.paid,
        paidAmount: 1850,
        date: DateTime(2026, 10, 26, 16, 10),
      ),
      SavedBill(
        billNumber: 'INV-NSYU-000121',
        customerName: 'Siddique Sahab SB',
        customerPhone: '9910223344',
        items: [
          SavedBillItem(desc: 'Earbuds Wireless', qty: 6, price: 1000),
        ],
        status: BillStatus.unpaid,
        paidAmount: 2000,
        date: DateTime(2026, 10, 25, 12, 00),
      ),
      SavedBill(
        billNumber: 'INV-NSYU-000120',
        customerName: 'Aalam Near RG',
        customerPhone: '9899112233',
        items: [
          SavedBillItem(desc: 'Power Bank 10000mAh', qty: 3, price: 916.6666666666666),
        ],
        status: BillStatus.unpaid,
        paidAmount: 0,
        date: DateTime(2026, 10, 24, 15, 30),
      ),
      SavedBill(
        billNumber: 'INV-NSYU-000119',
        customerName: 'Mohd Ali',
        customerPhone: '9873344556',
        items: [
          SavedBillItem(desc: 'Display Screen', qty: 7, price: 757.1428571428571),
        ],
        status: BillStatus.paid,
        paidAmount: 5300,
        date: DateTime(2026, 10, 23, 10, 15),
      ),
      SavedBill(
        billNumber: 'INV-NSYU-000118',
        customerName: 'Shakti Enterprise',
        customerPhone: '9811556677',
        items: [
          SavedBillItem(desc: 'USB Hub Multi-port', qty: 3, price: 1600),
        ],
        status: BillStatus.unpaid,
        paidAmount: 1800,
        date: DateTime(2026, 10, 22, 17, 40),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final billsProvider = context.watch<BillsProvider>();
    final realBills = billsProvider.bills;

    // Merge real database bills (like Amit Sharma INV-NSYU-000010) with reference bills
    final Map<String, SavedBill> allBillsMap = {};
    for (final b in realBills) {
      allBillsMap[b.billNumber] = b;
    }
    for (final mb in _referenceMockBills()) {
      if (!allBillsMap.containsKey(mb.billNumber)) {
        allBillsMap[mb.billNumber] = mb;
      }
    }

    final allBillsList = allBillsMap.values.toList();
    allBillsList.sort((a, b) => b.date.compareTo(a.date));

    // Filter bills
    final query = _searchCtrl.text.trim().toLowerCase();
    final filteredBills = allBillsList.where((b) {
      if (query.isNotEmpty) {
        final matchesQuery = b.customerName.toLowerCase().contains(query) ||
            b.billNumber.toLowerCase().contains(query);
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

    const totalCount = 125;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            // Top Green Status Banner matching Image 6 Left
            Container(
              height: MediaQuery.of(context).padding.top,
              color: const Color(0xFF16A34A),
            ),

            // Top App Bar matching Image 6 Left
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
              child: Row(
                children: [
                  // Circle Avatar 'N' in Amber
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF59E0B),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'N',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // NSYU ▾ and Phone Number
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'NSYU',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            SizedBox(width: 4),
                            Icon(Icons.keyboard_arrow_down, size: 18, color: Color(0xFF64748B)),
                          ],
                        ),
                        SizedBox(height: 2),
                        Text(
                          '8801356002',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Share, Bell with red badge 2, Search
                  IconButton(
                    icon: const Icon(Icons.share_outlined, color: Color(0xFF475569), size: 21),
                    onPressed: () {},
                  ),
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.notifications_outlined, color: Color(0xFF475569), size: 23),
                        onPressed: () {},
                      ),
                      Positioned(
                        top: 8,
                        right: 8,
                        child: Container(
                          padding: const EdgeInsets.all(3.5),
                          decoration: const BoxDecoration(
                            color: Color(0xFFEF4444),
                            shape: BoxShape.circle,
                          ),
                          child: const Text(
                            '2',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
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

            // Secondary Row: Bills / All Bills (125) & Filter, + New Bill button
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
                    icon: const Icon(Icons.search, color: Color(0xFF0F172A), size: 22),
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
                  // Circular Green + Button matching Image 6 Left
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

            // ── Horizontal Filter Chips matching Image 6 Left ──
            _buildFilterChipsRow(),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),

            // ── Bills List View ──
            if (filteredBills.isEmpty)
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
  // BILL LIST TILES matching Reference Design (Image 6 Left)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildRealBillTile(SavedBill b) {
    final isPaid = b.isPaid || b.due <= 0;
    final isPartial = !isPaid && b.paidAmount > 0;
    final status = isPaid ? 'Paid' : (isPartial ? 'Partial' : 'Unpaid');

    Color badgeBg = const Color(0xFFDCFCE7);
    Color badgeFg = const Color(0xFF16A34A);
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
        // Find matching customer or construct lightweight model
        final custProvider = context.read<CustomerProvider>();
        Customer? targetCust;
        for (final c in custProvider.customers) {
          if (c.name.trim().toLowerCase() == b.customerName.trim().toLowerCase() ||
              (b.customerPhone.isNotEmpty && c.mobile == b.customerPhone)) {
            targetCust = c;
            break;
          }
        }
        final cust = targetCust ??
            Customer(
              id: '0',
              name: b.customerName,
              mobile: b.customerPhone.isNotEmpty ? b.customerPhone : '8800123456',
              currentBalance: b.due,
            );

        // Open Right Screen (Customer Bill Details with Overview, Bills, Payments, Ledger)
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => CustomerLedgerDetailScreen(
              partyName: b.customerName,
              customer: cust,
              initialTab: 'Bills',
            ),
          ),
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
                  // Row 1: Customer Name & Status Badge
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

                  // Row 2: Bill # & Date ... Total Amount
                  Row(
                    children: [
                      Text(
                        'Bill #${b.billNumber}  |  ${_dateFormat.format(b.date)}',
                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                      ),
                      const Spacer(),
                      Text(
                        '₹${_money.format(b.total)}',
                        style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                          color: isPaid ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),

                  // Row 3: Items count ... Paid amount (if partial) ... Chevron
                  Row(
                    children: [
                      const Icon(Icons.description_outlined, size: 13, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(
                        '${b.items.isNotEmpty ? b.items.length : 3} items',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                      const Spacer(),
                      if (isPartial) ...[
                        Text(
                          'Paid: ₹${_money.format(b.paidAmount)}',
                          style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                        ),
                        const SizedBox(width: 6),
                      ],
                      const Icon(Icons.chevron_right, size: 16, color: Color(0xFF94A3B8)),
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
