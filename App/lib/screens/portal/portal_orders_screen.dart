import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/customer_portal_service.dart';
import 'portal_order_detail_screen.dart';

class PortalOrdersScreen extends StatefulWidget {
  const PortalOrdersScreen({super.key});

  @override
  State<PortalOrdersScreen> createState() => _PortalOrdersScreenState();
}

class _PortalOrdersScreenState extends State<PortalOrdersScreen> {
  final CustomerPortalService _service = CustomerPortalService();
  String _statusFilter = 'all';
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
      final orders = await _service.listOrders(
        status: _statusFilter != 'all' ? _statusFilter : null,
      );
      if (mounted) setState(() => _orders = orders);
    } catch (_) {
      if (mounted) setState(() => _orders = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  final _tabs = [
    {'id': 'all', 'label': 'All'},
    {'id': 'pending', 'label': 'Pending'},
    {'id': 'confirmed', 'label': 'Confirmed'},
    {'id': 'processing', 'label': 'Processing'},
    {'id': 'shipped', 'label': 'Shipped'},
    {'id': 'delivered', 'label': 'Delivered'},
    {'id': 'cancelled', 'label': 'Cancelled'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF047857),
        elevation: 0,
        title: const Text(
          'My Orders',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          // Filter Tabs
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _tabs.map((tab) {
                  final isSel = _statusFilter == tab['id'];
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(tab['label']!),
                      selected: isSel,
                      onSelected: (selected) {
                        setState(() => _statusFilter = tab['id']!);
                        _loadOrders();
                      },
                      selectedColor: const Color(0xFF047857),
                      labelStyle: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isSel ? Colors.white : const Color(0xFF475569),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          // Orders List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _orders.isEmpty
                    ? Center(
                        child: Text(
                          _statusFilter != 'all' ? 'No $_statusFilter orders.' : 'No orders found.',
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadOrders,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: _orders.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (context, idx) {
                            final ord = _orders[idx];
                            final id = (ord['id'] as num).toInt();
                            final orderNum = ord['order_number']?.toString() ?? 'Order';
                            final status = ord['status']?.toString() ?? 'pending';
                            final total = ((ord['total_amount'] ?? 0) as num).toDouble();
                            final dt = ord['createdAt']?.toString();
                            final dateStr = dt != null ? DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(dt)) : '';
                            final itemsCount = (ord['items'] as List<dynamic>?)?.length ?? 0;
                            final isBilled = ord['converted_sale_id'] != null;

                            return Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: ListTile(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => PortalOrderDetailScreen(orderId: id)),
                                  ).then((_) => _loadOrders());
                                },
                                title: Row(
                                  children: [
                                    Text('#$orderNum', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    const SizedBox(width: 8),
                                    _buildStatusPill(status),
                                    if (isBilled) ...[
                                      const SizedBox(width: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                        decoration: BoxDecoration(color: const Color(0xFFDBEAFE), borderRadius: BorderRadius.circular(4)),
                                        child: const Text('BILLED', style: TextStyle(color: Color(0xFF1D4ED8), fontSize: 8, fontWeight: FontWeight.bold)),
                                      ),
                                    ],
                                  ],
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 4),
                                    Text(dateStr, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                    Text('$itemsCount item(s)', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                                  ],
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      '₹${total.toStringAsFixed(2)}',
                                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF0F172A)),
                                    ),
                                    const Icon(Icons.chevron_right, size: 18, color: Color(0xFF94A3B8)),
                                  ],
                                ),
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

  Widget _buildStatusPill(String status) {
    Color bg = const Color(0xFFF1F5F9);
    Color text = const Color(0xFF475569);
    if (status == 'pending') {
      bg = const Color(0xFFFEF3C7);
      text = const Color(0xFFB45309);
    } else if (status == 'confirmed') {
      bg = const Color(0xFFDBEAFE);
      text = const Color(0xFF1D4ED8);
    } else if (status == 'delivered') {
      bg = const Color(0xFFD1FAE5);
      text = const Color(0xFF047857);
    } else if (status == 'cancelled') {
      bg = const Color(0xFFFFE4E6);
      text = const Color(0xFFBE123C);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(color: text, fontSize: 9, fontWeight: FontWeight.bold),
      ),
    );
  }
}

