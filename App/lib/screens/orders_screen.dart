import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/customer.dart';
import '../models/saved_order.dart';
import '../providers/auth_provider.dart';
import '../providers/customer_provider.dart';
import '../providers/notifications_provider.dart';
import '../providers/orders_provider.dart';
import '../widgets/app_bottom_nav.dart';
import 'customer_ledger_detail_screen.dart';
import 'order_cart_screen.dart';
import 'notifications_screen.dart';

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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final ordersProvider = context.watch<OrdersProvider>();
    final realOrders = ordersProvider.orders;

    final shopName = auth.shopName.isNotEmpty ? auth.shopName : 'NSYU';
    final shopPhone = auth.shopPhone;

    // Real database orders
    final allOrdersList = List<SavedOrder>.from(realOrders);
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
      if (_selectedStatusFilter == 'Billed' && !o.isBilled) return false;
      return true;
    }).toList();

    final totalCount = allOrdersList.length;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            // Top App Bar
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
              child: Row(
                children: [
                  // Navy-to-SteelBlue Monogram
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F2756), Color(0xFF2563EB)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x200F2756),
                          blurRadius: 6,
                          offset: Offset(0, 2),
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

            // Secondary Row: Orders / All Orders (count) & Filter, + New Order button
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
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
                  const SizedBox(width: 6),
                  // New Order Button
                  InkWell(
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                      );
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2563EB),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x302563EB),
                            blurRadius: 8,
                            offset: Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.add, color: Colors.white, size: 18),
                          SizedBox(width: 4),
                          Text(
                            'Order',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
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
                      color: isSelected ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
                        width: isSelected ? 1.4 : 1.0,
                      ),
                    ),
                    child: Text(
                      s,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                        color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFF475569),
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
  // ORDER LIST TILES
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildOrderTile(SavedOrder o) {
    Color badgeBg = const Color(0xFFFFFBEB);
    Color badgeFg = const Color(0xFFD97706);
    String status = o.status.label;

    if (o.status == OrderStatus.delivered) {
      badgeBg = const Color(0xFFECFDF5);
      badgeFg = const Color(0xFF059669);
    } else if (o.status == OrderStatus.confirmed) {
      badgeBg = const Color(0xFFEFF6FF);
      badgeFg = const Color(0xFF2563EB);
    } else if (o.isBilled) {
      badgeBg = const Color(0xFFF0FDFA);
      badgeFg = const Color(0xFF0D9488);
      status = 'Billed';
    } else if (o.status == OrderStatus.cancelled) {
      badgeBg = const Color(0xFFFEF2F2);
      badgeFg = const Color(0xFFDC2626);
    }

    final initial = o.customerName.isNotEmpty ? o.customerName[0].toUpperCase() : 'C';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x080F2756),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
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
                  mobile: o.customerPhone,
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
          child: Padding(
            padding: const EdgeInsets.all(13),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0F2756), Color(0xFF2563EB)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      initial,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
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
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              status.toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.3,
                                color: badgeFg,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),

                      // Row 2: Order # & Date ... Total Amount
                      Row(
                        children: [
                          Text(
                            'Order #${o.orderNumber}  |  ${_dateFormat.format(o.date)}',
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                          ),
                          const Spacer(),
                          Text(
                            '₹${_money.format(o.total)}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),

                      // Row 3: Items count ... Chevron
                      Row(
                        children: [
                          const Icon(Icons.description_outlined, size: 13, color: Color(0xFF64748B)),
                          const SizedBox(width: 4),
                          Text(
                            '${o.items.length} ${o.items.length == 1 ? "item" : "items"}',
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
                trailing: _selectedPeriodFilter == p ? const Icon(Icons.check, color: Color(0xFF2563EB)) : null,
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
