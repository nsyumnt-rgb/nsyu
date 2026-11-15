import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/customer_portal_provider.dart';
import '../../services/customer_portal_service.dart';
import '../../theme/app_theme.dart';
import 'portal_order_detail_screen.dart';

class PortalOrdersScreen extends StatefulWidget {
  const PortalOrdersScreen({super.key});

  @override
  State<PortalOrdersScreen> createState() => _PortalOrdersScreenState();
}

class _PortalOrdersScreenState extends State<PortalOrdersScreen> {
  final CustomerPortalService _service = CustomerPortalService();
  String _statusFilter = 'all'; // 'all', 'pending', 'processing', 'completed', 'cancelled'
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    setState(() => _loading = true);
    try {
      String? backendFilter;
      if (_statusFilter == 'pending') {
        backendFilter = 'pending';
      } else if (_statusFilter == 'processing') {
        backendFilter = 'processing';
      } else if (_statusFilter == 'completed') {
        backendFilter = 'delivered';
      } else if (_statusFilter == 'cancelled') {
        backendFilter = 'cancelled';
      }

      final orders = await _service.listOrders(
        status: backendFilter,
      );
      if (mounted) setState(() => _orders = orders);
    } catch (_) {
      if (mounted) setState(() => _orders = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static const _tabs = [
    {'id': 'all', 'label': 'All Orders'},
    {'id': 'pending', 'label': 'Pending'},
    {'id': 'processing', 'label': 'Processing'},
    {'id': 'completed', 'label': 'Completed'},
    {'id': 'cancelled', 'label': 'Cancelled'},
  ];

  StatusChipVariant _getStatusVariant(String status) {
    final s = status.toLowerCase();
    if (s == 'pending') return StatusChipVariant.warning;
    if (s == 'confirmed' || s == 'processing' || s == 'ready' || s == 'shipped') {
      return StatusChipVariant.info;
    }
    if (s == 'delivered' || s == 'completed' || s == 'billed') {
      return StatusChipVariant.success;
    }
    if (s == 'cancelled' || s == 'rejected') {
      return StatusChipVariant.danger;
    }
    return StatusChipVariant.neutral;
  }

  @override
  Widget build(BuildContext context) {
    final portal = context.read<CustomerPortalProvider>();

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.navy900, AppColors.navy700],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        elevation: 0,
        title: const Text(
          'My Orders',
          style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white),
            tooltip: 'Refresh',
            onPressed: _loadOrders,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs Bar
          Container(
            color: Colors.white,
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: AppColors.border, width: 1)),
            ),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _tabs.map((tab) {
                  final isSel = _statusFilter == tab['id'];
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(tab['label']!),
                      selected: isSel,
                      onSelected: (selected) {
                        if (selected) {
                          setState(() => _statusFilter = tab['id']!);
                          _loadOrders();
                        }
                      },
                      selectedColor: AppColors.navy900,
                      backgroundColor: AppColors.bg,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999),
                        side: BorderSide(
                          color: isSel ? AppColors.navy900 : AppColors.border,
                        ),
                      ),
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: isSel ? FontWeight.bold : FontWeight.w500,
                        color: isSel ? Colors.white : AppColors.textSecondary,
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // Orders List
          Expanded(
            child: _loading
                ? Padding(
                    padding: const EdgeInsets.all(16),
                    child: SkeletonLoader.list(count: 4),
                  )
                : _orders.isEmpty
                    ? Center(
                        child: EmptyState(
                          icon: Icons.receipt_long_outlined,
                          title: _statusFilter != 'all'
                              ? 'No $_statusFilter orders found'
                              : 'No orders placed yet',
                          subtitle: _statusFilter != 'all'
                              ? 'You do not have any orders with status "$_statusFilter".'
                              : 'Browse our product catalog to place your first order.',
                          buttonLabel: 'Explore Catalog',
                          onButtonPressed: () => portal.switchTab(1),
                        ),
                      )
                    : RefreshIndicator(
                        color: AppColors.blue600,
                        onRefresh: _loadOrders,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _orders.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, idx) {
                            final ord = _orders[idx];
                            final id = (ord['id'] as num).toInt();
                            final orderNum = ord['order_number']?.toString() ?? 'ORD-$id';
                            final status = ord['status']?.toString() ?? 'pending';
                            final total = ((ord['total_amount'] ?? 0) as num).toDouble();
                            final dt = ord['createdAt']?.toString();
                            final dateStr = dt != null
                                ? DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(dt))
                                : '';
                            final items = (ord['items'] as List<dynamic>?) ?? [];
                            final itemsCount = items.fold<int>(
                              0,
                              (sum, it) => sum + (((it['quantity'] ?? 1) as num).toInt()),
                            );
                            final isBilled = ord['converted_sale_id'] != null;

                            // Summary string of items
                            final itemNames = items
                                .map((it) => it['product_name']?.toString() ?? 'Item')
                                .take(2)
                                .join(', ');
                            final summaryText = items.length > 2
                                ? '$itemNames +${items.length - 2} more'
                                : (itemNames.isNotEmpty ? itemNames : '$itemsCount item(s)');

                            return AppCard(
                              padding: const EdgeInsets.all(16),
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => PortalOrderDetailScreen(orderId: id),
                                  ),
                                ).then((_) => _loadOrders());
                              },
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Top row: order number + status chips
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(7),
                                            decoration: BoxDecoration(
                                              color: AppColors.blue50,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: const Icon(
                                              Icons.receipt_long_rounded,
                                              size: 16,
                                              color: AppColors.navy900,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            '#$orderNum',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 14.5,
                                              color: AppColors.navy900,
                                            ),
                                          ),
                                        ],
                                      ),
                                      Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          StatusChip(
                                            label: status.toUpperCase(),
                                            variant: _getStatusVariant(status),
                                          ),
                                          if (isBilled) ...[
                                            const SizedBox(width: 6),
                                            const StatusChip(
                                              label: 'BILLED',
                                              variant: StatusChipVariant.success,
                                            ),
                                          ],
                                        ],
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    dateStr,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    summaryText,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      color: AppColors.textSecondary,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  const Divider(height: 20, color: AppColors.border),
                                  // Bottom row: items quantity + total amount + arrow
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'QUANTITY',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.textSecondary,
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            '$itemsCount ${itemsCount == 1 ? "unit" : "units"}',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 13,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                        ],
                                      ),
                                      Row(
                                        children: [
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.end,
                                            children: [
                                              const Text(
                                                'ORDER TOTAL',
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppColors.textSecondary,
                                                  letterSpacing: 0.5,
                                                ),
                                              ),
                                              const SizedBox(height: 2),
                                              AmountText(
                                                amount: total,
                                                fontSize: 15,
                                                fontWeight: FontWeight.w800,
                                                color: AppColors.navy900,
                                              ),
                                            ],
                                          ),
                                          const SizedBox(width: 8),
                                          const Icon(
                                            Icons.chevron_right_rounded,
                                            size: 20,
                                            color: AppColors.textSecondary,
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
}
