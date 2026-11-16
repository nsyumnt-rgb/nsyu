import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/saved_order.dart';
import '../navigation/app_navigation.dart';
import '../providers/auth_provider.dart';
import '../providers/notifications_provider.dart';
import '../providers/orders_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bottom_nav.dart';
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

    // Filter orders: support searching with or without '#', '-', e.g. ORD265436, #ORD265436, ORD-265436
    final query = _searchCtrl.text.trim().toLowerCase();
    final cleanQuery = query.replaceAll('#', '').replaceAll('-', '').trim();
    final filteredOrders = allOrdersList.where((o) {
      if (query.isNotEmpty) {
        final rawNum = o.orderNumber.toLowerCase();
        final dispNum = o.displayOrderNumber.toLowerCase();
        final rawClean = rawNum.replaceAll('#', '').replaceAll('-', '');
        final dispClean = dispNum.replaceAll('#', '').replaceAll('-', '');

        final matchesQuery = o.customerName.toLowerCase().contains(query) ||
            rawNum.contains(query) ||
            dispNum.contains(query) ||
            (cleanQuery.isNotEmpty && (rawClean.contains(cleanQuery) || dispClean.contains(cleanQuery)));
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
                  // Emerald Monogram
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF064E3B), Color(0xFF047857)],
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

            // Secondary Row: Orders / All Orders & Filter, + New Order button
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
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy900,
                          ),
                        ),
                        Text(
                          'All Orders ($totalCount)',
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
                      'New Order',
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
                      hintText: 'Search by order number or customer name...',
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

            // ── Orders List View ──
            if (!ordersProvider.loaded)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: SkeletonLoader.list(count: 6),
                ),
              )
            else if (filteredOrders.isEmpty)
              Expanded(
                child: EmptyState(
                  icon: Icons.assignment_outlined,
                  title: 'No orders found',
                  subtitle: 'Create your first order by tapping "+ New Order"',
                  buttonLabel: '+ New Order',
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
  // ORDER LIST TILES
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildOrderTile(SavedOrder o) {
    StatusChipVariant variant = StatusChipVariant.warning;
    String status = o.status.label;

    if (o.status == OrderStatus.delivered) {
      variant = StatusChipVariant.success;
    } else if (o.status == OrderStatus.confirmed) {
      variant = StatusChipVariant.info;
    } else if (o.isBilled) {
      variant = StatusChipVariant.success;
      status = 'Billed';
    } else if (o.status == OrderStatus.cancelled) {
      variant = StatusChipVariant.danger;
    }

    final initial = o.customerName.isNotEmpty ? o.customerName[0].toUpperCase() : 'C';

    return InkWell(
      onTap: () {
        AppNavigation.openOrderDetails(context, order: o);
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
                  colors: [AppColors.navy900, AppColors.blue600],
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
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      StatusChip(
                        label: status,
                        variant: variant,
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),

                  // Row 2: Order # & Date ... Total Amount
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Order #${o.displayOrderNumber} • ${_dateFormat.format(o.date)}',
                          style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      AmountText(
                        amount: o.total,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.navy900,
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),

                  // Row 3: Items count ... Chevron
                  Row(
                    children: [
                      const Icon(Icons.shopping_bag_outlined, size: 13, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Text(
                        '${o.items.length} ${o.items.length == 1 ? "item" : "items"}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                      const Spacer(),
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
                trailing: _selectedPeriodFilter == p ? const Icon(Icons.check, color: Color(0xFF047857)) : null,
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
