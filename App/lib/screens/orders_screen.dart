import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/saved_order.dart';
import '../navigation/app_navigation.dart';
import '../providers/catalog_provider.dart';
import '../providers/orders_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bottom_nav.dart';
import 'order_cart_screen.dart';

/// Order management tab -- mirrors BillsListScreen, but tracks
/// Order -> Delivered instead of Paid/Unpaid, and the "cart bar" at the
/// bottom opens OrderCartScreen (built from Catalog, same as a Bill).
class OrdersScreen extends StatefulWidget {
  final ValueChanged<int> onNavigate;

  const OrdersScreen({super.key, required this.onNavigate});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  int _selectedTabIndex = 0;
  final _searchCtrl = TextEditingController();
  String _query = '';

  static const _statuses = <OrderStatus?>[
    null,
    OrderStatus.pending,
    OrderStatus.confirmed,
    OrderStatus.delivered,
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final orders = context.read<OrdersProvider>();
      if (!orders.loaded) await orders.load();
      if (!orders.syncing) orders.syncFromDrive();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final orders = context.watch<OrdersProvider>();
    final catalog = context.watch<CatalogProvider>();
    final money = NumberFormat('#,##0');

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              widget.onNavigate(0);
            }
          },
        ),
        title: const Text(
          'Orders',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 18),
        ),
        actions: [
          IconButton(
            tooltip: 'Sync Orders',
            icon: orders.syncing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF1D4ED8)),
                  )
                : const Icon(Icons.sync_rounded, color: Color(0xFF0F172A), size: 22),
            onPressed: orders.syncing ? null : () => orders.syncFromDrive(),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: InkWell(
              onTap: () => AppNavigation.openCreateOrder(context),
              borderRadius: BorderRadius.circular(18),
              child: Container(
                width: 34,
                height: 34,
                decoration: const BoxDecoration(
                  color: Color(0xFF1D4ED8),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 20),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search & Filter Tabs Section matching reference Image 7
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              children: [
                // Search Bar
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: TextField(
                    controller: _searchCtrl,
                    onChanged: (v) => setState(() => _query = v.trim()),
                    decoration: InputDecoration(
                      hintText: 'Search order by reference, customer...',
                      hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                      prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
                      suffixIcon: _query.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18, color: Color(0xFF64748B)),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() => _query = '');
                              },
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Filter Tabs: All, Pending, Processing, Completed
                Row(
                  children: [
                    _filterChip('All', 0),
                    const SizedBox(width: 8),
                    _filterChip('Pending', 1),
                    const SizedBox(width: 8),
                    _filterChip('Processing', 2),
                    const SizedBox(width: 8),
                    _filterChip('Completed', 3),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Orders List
          Expanded(
            child: _orderList(orders, money, _statuses[_selectedTabIndex]),
          ),
        ],
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _orderCartBar(context, catalog),
          AppBottomNav(currentIndex: 3, onTap: widget.onNavigate),
        ],
      ),
    );
  }

  /// Same idea as Catalog's bill bar -- shows how many items are waiting in
  /// the current order cart, and opens OrderCartScreen to review/save it.
  Widget _orderCartBar(BuildContext context, CatalogProvider catalog) {
    final hasItems = catalog.orderCount > 0;
    return Material(
      color: hasItems ? const Color(0xFF0D9488) : Colors.white,
      child: InkWell(
        onTap: () {
          Navigator.of(context)
              .push(MaterialPageRoute(builder: (_) => const OrderCartScreen()));
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          decoration: hasItems
              ? null
              : const BoxDecoration(
                  border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                ),
          child: Row(
            children: [
              Icon(
                Icons.shopping_bag_outlined,
                color: hasItems ? Colors.white : AppColors.steelBlue,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  hasItems
                      ? '${catalog.orderCount} item${catalog.orderCount == 1 ? '' : 's'}'
                          ' \u00b7 \u20b9${catalog.orderTotal.toStringAsFixed(0)}'
                      : 'No items in order cart yet',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: hasItems ? Colors.white : AppColors.muted,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
              Text(
                'View Order',
                style: TextStyle(
                  color: hasItems ? Colors.white : AppColors.steelBlue,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 4),
              Icon(
                Icons.arrow_forward_ios,
                size: 13,
                color: hasItems ? Colors.white : AppColors.steelBlue,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _orderList(OrdersProvider orders, NumberFormat money, OrderStatus? status) {
    if (!orders.loaded) {
      return const Center(child: CircularProgressIndicator());
    }
    final list = orders.search(orders.ordersByStatus(status), _query);

    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.shopping_bag_outlined,
                  size: 40, color: AppColors.muted.withValues(alpha: 0.5)),
              const SizedBox(height: 12),
              const Text('No orders here yet', style: AppTextStyles.body),
              const SizedBox(height: 4),
              const Text(
                'Add products from the Catalog with "+ Order" to build one',
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
      itemBuilder: (context, i) => _orderTile(context, orders, list[i], money),
    );
  }

  Widget _filterChip(String label, int index) {
    final isSelected = _selectedTabIndex == index;
    return InkWell(
      onTap: () => setState(() => _selectedTabIndex = index),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF1D4ED8) : const Color(0xFFE2E8F0),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : const Color(0xFF475569),
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
            fontSize: 12.5,
          ),
        ),
      ),
    );
  }

  Widget _orderTile(
      BuildContext context, OrdersProvider orders, SavedOrder o, NumberFormat money) {
    final (statusLabel, statusBg, statusColor) = switch (o.status) {
      OrderStatus.pending => ('Pending', const Color(0xFFFEF3C7), const Color(0xFFD97706)),
      OrderStatus.confirmed => ('Processing', const Color(0xFFE0F2FE), const Color(0xFF0284C7)),
      OrderStatus.delivered => ('Completed', const Color(0xFFDCFCE7), const Color(0xFF16A34A)),
      OrderStatus.cancelled => ('Cancelled', const Color(0xFFFEE2E2), const Color(0xFFDC2626)),
      OrderStatus.convertedToBill => ('Billed', const Color(0xFFCCFBF1), const Color(0xFF0D9488)),
    };

    final refCode = o.orderNumber.startsWith('ORD')
        ? o.orderNumber
        : 'ORD${DateFormat('yyMMdd').format(o.date)}${o.orderNumber.padLeft(3, '0')}';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.015),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => AppNavigation.openOrderDetails(context, order: o),
          onLongPress: () => _openOrderSheet(context, orders, o),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                // Order Icon in tinted square
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.receipt_long_outlined,
                    color: Color(0xFF1E60D5),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),

                // Order Reference & Customer info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        refCode,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        o.customerName.isEmpty ? 'Walk-in Customer' : o.customerName,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF334155),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        DateFormat('dd MMM yyyy, hh:mm a').format(o.date),
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                ),

                // Status pill and Amount
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        statusLabel,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: statusColor,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '₹ ${money.format(o.total)}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openOrderSheet(BuildContext context, OrdersProvider orders, SavedOrder o) {
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
                Text('Order #${o.orderNumber}',
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                Text(o.customerName.isEmpty ? 'Walk-in customer' : o.customerName,
                    style: const TextStyle(color: AppColors.muted)),
                const SizedBox(height: 12),
                for (final item in o.items)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(child: Text(item.desc)),
                        Text('${item.qty} \u00d7 \u20b9${item.price.toStringAsFixed(0)}'),
                        const SizedBox(width: 10),
                        SizedBox(
                          width: 70,
                          child: Text('\u20b9${item.amount.toStringAsFixed(0)}',
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
                    Text('\u20b9${o.total.toStringAsFixed(0)}',
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                  ],
                ),
                const SizedBox(height: 16),
                // Order -> Delivered -- tap to change status.
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final s in OrderStatus.values)
                      ChoiceChip(
                        label: Text(s.label),
                        selected: o.status == s,
                        onSelected: (_) {
                          orders.setStatus(o.orderNumber, s);
                          Navigator.pop(ctx);
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                TextButton.icon(
                  onPressed: () {
                    orders.deleteOrder(o.orderNumber);
                    Navigator.pop(ctx);
                  },
                  icon: const Icon(Icons.delete_outline, color: AppColors.red),
                  label: const Text('Delete order', style: TextStyle(color: AppColors.red)),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
