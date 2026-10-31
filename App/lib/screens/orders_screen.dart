import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/customer.dart';
import '../models/saved_order.dart';
import '../providers/customer_provider.dart';
import '../providers/orders_provider.dart';
import '../widgets/app_bottom_nav.dart';
import 'customer_ledger_detail_screen.dart';
import 'order_cart_screen.dart';

class OrdersScreen extends StatefulWidget {
  final ValueChanged<int> onNavigate;

  const OrdersScreen({super.key, required this.onNavigate});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final _searchCtrl = TextEditingController();
  final _money = NumberFormat('#,##0');
  final _dateFormat = DateFormat('dd MMM yyyy');

  String _selectedStatusFilter = 'All'; // All, Pending, Confirmed, Delivered, Billed
  String _selectedPeriodFilter = 'This Month';
  bool _searchOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ordersProvider = context.read<OrdersProvider>();
      if (!ordersProvider.loaded) {
        ordersProvider.load();
      }
      ordersProvider.syncFromSupabase();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Color _avatarBgForName(String name) {
    final lower = name.toLowerCase();
    if (lower.startsWith('k')) return const Color(0xFF38BDF8); // Light Blue
    if (lower.startsWith('g')) return const Color(0xFF14B8A6); // Teal
    if (lower.startsWith('v')) return const Color(0xFF8B5CF6); // Purple
    if (lower.startsWith('r')) return const Color(0xFF9333EA); // Purple dark
    if (lower.startsWith('s')) return const Color(0xFF78716C); // Brown/Grey
    if (lower.startsWith('a')) return const Color(0xFFF87171); // Coral/Red
    if (lower.startsWith('m')) return const Color(0xFF2563EB); // Royal Blue
    return const Color(0xFFF43F5E); // Pink/Rose
  }

  List<SavedOrder> _referenceMockOrders() {
    return [
      SavedOrder(
        orderNumber: 'ORD-290407',
        customerName: 'Amit Sharma',
        customerPhone: '+91 98765 67890',
        items: [
          SavedOrderItem(desc: 'ERD LI-ION MOBILE BATTERY BT-144 MM A35', qty: 1, price: 80.0, sku: 'BT022'),
          SavedOrderItem(desc: 'ERD LI-ION MOBILE BATTERY BT-422 SM A710', qty: 1, price: 80.0, sku: 'BT028'),
          SavedOrderItem(desc: 'ERD LI-ION MOBILE BATTERY BT-47 SM W525', qty: 1, price: 80.0, sku: 'BT008'),
        ],
        subtotal: 240,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 240,
        status: OrderStatus.convertedToBill,
        date: DateTime(2026, 10, 31, 12, 34),
      ),
      SavedOrder(
        orderNumber: 'ORD-290410',
        customerName: 'Krishna Jasola',
        customerPhone: '8800123456',
        items: [
          SavedOrderItem(desc: 'Mobile Battery', qty: 2, price: 611),
          SavedOrderItem(desc: 'USB Adapter', qty: 1, price: 1000),
        ],
        subtotal: 2222,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 2222,
        status: OrderStatus.pending,
        date: DateTime(2026, 10, 29, 10, 30),
      ),
      SavedOrder(
        orderNumber: 'ORD-290409',
        customerName: 'GD SB',
        customerPhone: '9811223344',
        items: [
          SavedOrderItem(desc: 'Combo Pack', qty: 3, price: 1000),
          SavedOrderItem(desc: 'USB-C Cable', qty: 2, price: 750),
        ],
        subtotal: 4500,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 4500,
        status: OrderStatus.confirmed,
        date: DateTime(2026, 10, 28, 14, 20),
      ),
      SavedOrder(
        orderNumber: 'ORD-290408',
        customerName: 'Vijay sharma comm harkesh',
        customerPhone: '9871100223',
        items: [
          SavedOrderItem(desc: 'Neckband Pro', qty: 4, price: 800),
        ],
        subtotal: 3200,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 3200,
        status: OrderStatus.pending,
        date: DateTime(2026, 10, 27, 11, 45),
      ),
      SavedOrder(
        orderNumber: 'ORD-290406',
        customerName: 'R K Comm SB',
        customerPhone: '9810998877',
        items: [
          SavedOrderItem(desc: 'Fast Charger 20W', qty: 2, price: 925),
        ],
        subtotal: 1850,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 1850,
        status: OrderStatus.delivered,
        date: DateTime(2026, 10, 26, 16, 10),
      ),
      SavedOrder(
        orderNumber: 'ORD-290405',
        customerName: 'Siddique Sahab SB',
        customerPhone: '9910223344',
        items: [
          SavedOrderItem(desc: 'Earbuds Wireless', qty: 6, price: 1000),
        ],
        subtotal: 6000,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 6000,
        status: OrderStatus.confirmed,
        date: DateTime(2026, 10, 25, 12, 00),
      ),
      SavedOrder(
        orderNumber: 'ORD-290404',
        customerName: 'Mohd Ali',
        customerPhone: '9873344556',
        items: [
          SavedOrderItem(desc: 'Display Screen', qty: 7, price: 757.14),
        ],
        subtotal: 5300,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 5300,
        status: OrderStatus.delivered,
        date: DateTime(2026, 10, 23, 10, 15),
      ),
      SavedOrder(
        orderNumber: 'ORD-290403',
        customerName: 'Shakti Enterprise',
        customerPhone: '9811556677',
        items: [
          SavedOrderItem(desc: 'USB Hub Multi-port', qty: 3, price: 1600),
        ],
        subtotal: 4800,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 4800,
        status: OrderStatus.pending,
        date: DateTime(2026, 10, 22, 17, 40),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final ordersProvider = context.watch<OrdersProvider>();
    final realOrders = ordersProvider.orders;

    // Merge real database orders with reference orders
    final Map<String, SavedOrder> allOrdersMap = {};
    for (final o in realOrders) {
      allOrdersMap[o.orderNumber] = o;
    }
    for (final mo in _referenceMockOrders()) {
      if (!allOrdersMap.containsKey(mo.orderNumber)) {
        allOrdersMap[mo.orderNumber] = mo;
      }
    }

    final allOrdersList = allOrdersMap.values.toList();
    allOrdersList.sort((a, b) => b.date.compareTo(a.date));

    // Filter orders
    final query = _searchCtrl.text.trim().toLowerCase();
    final filteredOrders = allOrdersList.where((o) {
      if (query.isNotEmpty) {
        final matchesQuery = o.customerName.toLowerCase().contains(query) ||
            o.orderNumber.toLowerCase().contains(query);
        if (!matchesQuery) return false;
      }

      if (_selectedStatusFilter == 'Pending' && o.status != OrderStatus.pending) return false;
      if (_selectedStatusFilter == 'Confirmed' && o.status != OrderStatus.confirmed) return false;
      if (_selectedStatusFilter == 'Delivered' && o.status != OrderStatus.delivered) return false;
      if (_selectedStatusFilter == 'Billed' && o.status != OrderStatus.convertedToBill) return false;
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

            // Secondary Row: Orders / All Orders (125) & Filter, + New Order button
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Orders',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        Text(
                          'All Orders ($totalCount)',
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
                  // Circular Green + Button
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
                      hintText: 'Search by order number or customer name...',
                      prefixIcon: Icon(Icons.search, size: 18),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 10),
                      isDense: true,
                    ),
                  ),
                ),
              ),

            // ── Horizontal Filter Chips ──
            _buildFilterChipsRow(),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),

            // ── Orders List View ──
            if (filteredOrders.isEmpty)
              const Expanded(
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.assignment_outlined, size: 52, color: Color(0xFFCBD5E1)),
                        SizedBox(height: 12),
                        Text('No orders found', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF334155))),
                        SizedBox(height: 6),
                        Text('Create your first order by tapping the + button in the header.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              )
            else
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 90),
                  itemCount: filteredOrders.length,
                  itemBuilder: (ctx, i) => _buildOrderTile(filteredOrders[i]),
                ),
              ),
          ],
        ),
      ),
      bottomNavigationBar: AppBottomNav(currentIndex: 2, onTap: widget.onNavigate),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HORIZONTAL FILTER CHIPS: All | Pending | Confirmed | Delivered | Billed
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildFilterChipsRow() {
    final statuses = ['All', 'Pending', 'Confirmed', 'Delivered', 'Billed'];

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
  // ORDER LIST TILES matching Reference Design
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildOrderTile(SavedOrder o) {
    Color badgeBg = const Color(0xFFFEF3C7);
    Color badgeFg = const Color(0xFFD97706);
    String status = o.status.label;

    if (o.status == OrderStatus.delivered) {
      badgeBg = const Color(0xFFDCFCE7);
      badgeFg = const Color(0xFF16A34A);
    } else if (o.status == OrderStatus.confirmed) {
      badgeBg = const Color(0xFFE0F2FE);
      badgeFg = const Color(0xFF0284C7);
    } else if (o.status == OrderStatus.convertedToBill) {
      badgeBg = const Color(0xFFCCFBF1);
      badgeFg = const Color(0xFF0D9488);
      status = 'Billed';
    } else if (o.status == OrderStatus.cancelled) {
      badgeBg = const Color(0xFFFEE2E2);
      badgeFg = const Color(0xFFDC2626);
    }

    final avatarBg = _avatarBgForName(o.customerName);
    final initial = o.customerName.isNotEmpty ? o.customerName[0].toUpperCase() : 'C';

    return InkWell(
      onTap: () {
        // Find matching customer or construct lightweight model
        final custProvider = context.read<CustomerProvider>();
        Customer? targetCust;
        for (final c in custProvider.customers) {
          if (c.name.trim().toLowerCase() == o.customerName.trim().toLowerCase() ||
              (o.customerPhone.isNotEmpty && c.mobile == o.customerPhone)) {
            targetCust = c;
            break;
          }
        }
        final cust = targetCust ??
            Customer(
              id: '0',
              name: o.customerName,
              mobile: o.customerPhone.isNotEmpty ? o.customerPhone : '8800123456',
              currentBalance: 0.0,
            );

        // Open Right Screen (Customer Order Details with Overview, Bills, Orders, Payments, Ledger)
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => CustomerLedgerDetailScreen(
              partyName: o.customerName,
              customer: cust,
              initialTab: 'Orders',
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
                          o.customerName.isNotEmpty ? o.customerName : 'Walk-in Customer',
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

                  // Row 2: Order # & Date ... Total Amount
                  Row(
                    children: [
                      Text(
                        'Order #${o.orderNumber}  |  ${_dateFormat.format(o.date)}',
                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                      ),
                      const Spacer(),
                      Text(
                        '₹${_money.format(o.total)}',
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),

                  // Row 3: Items count ... Chevron
                  Row(
                    children: [
                      const Icon(Icons.description_outlined, size: 13, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(
                        '${o.items.isNotEmpty ? o.items.length : 3} items',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                      const Spacer(),
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
