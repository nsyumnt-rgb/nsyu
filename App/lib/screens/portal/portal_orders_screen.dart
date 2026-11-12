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

  final _tabs = const [
    {'id': 'all', 'label': 'All'},
    {'id': 'pending', 'label': 'Pending'},
    {'id': 'processing', 'label': 'Processing'},
    {'id': 'completed', 'label': 'Completed'},
    {'id': 'cancelled', 'label': 'Cancelled'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D4ED8),
        elevation: 0,
        title: const Text(
          'My Orders & Tracking',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          // Filter Tabs
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
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
                        setState(() => _statusFilter = tab['id']!);
                        _loadOrders();
                      },
                      selectedColor: const Color(0xFF1D4ED8),
                      backgroundColor: Colors.white,
                      labelStyle: TextStyle(
                        fontSize: 11.5,
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
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF1D4ED8)))
                : _orders.isEmpty
                    ? Center(
                        child: Text(
                          _statusFilter != 'all' ? 'No $_statusFilter orders.' : 'No orders placed yet.',
                          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                        ),
                      )
                    : RefreshIndicator(
                        color: const Color(0xFF1D4ED8),
                        onRefresh: _loadOrders,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(12),
                          itemCount: _orders.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, idx) {
                            final ord = _orders[idx];
                            final id = (ord['id'] as num).toInt();
                            final orderNum = ord['order_number']?.toString() ?? 'ORD-$id';
                            final status = ord['status']?.toString() ?? 'pending';
                            final total = ((ord['total_amount'] ?? 0) as num).toDouble();
                            final dt = ord['createdAt']?.toString();
                            final dateStr = dt != null ? DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(dt)) : '';
                            final items = (ord['items'] as List<dynamic>?) ?? [];
                            final itemsCount = items.fold<int>(0, (sum, it) => sum + (((it['quantity'] ?? 1) as num).toInt()));
                            final isBilled = ord['converted_sale_id'] != null;

                            return Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                boxShadow: const [
                                  BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
                                ],
                              ),
                              child: InkWell(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => PortalOrderDetailScreen(orderId: id)),
                                  ).then((_) => _loadOrders());
                                },
                                borderRadius: BorderRadius.circular(16),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Row(
                                            children: [
                                              const Icon(Icons.shopping_bag_outlined, size: 18, color: Color(0xFF1D4ED8)),
                                              const SizedBox(width: 6),
                                              Text(
                                                '#$orderNum',
                                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF0F172A)),
                                              ),
                                            ],
                                          ),
                                          Row(
                                            children: [
                                              _buildStatusPill(status),
                                              if (isBilled) ...[
                                                const SizedBox(width: 4),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                                  decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(4)),
                                                  child: const Text('BILLED', style: TextStyle(color: Color(0xFF16A34A), fontSize: 9, fontWeight: FontWeight.bold)),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        dateStr,
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                      ),
                                      const Divider(height: 18),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text('ITEMS', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                                              const SizedBox(height: 2),
                                              Text(
                                                '$itemsCount ${itemsCount == 1 ? "unit" : "units"}',
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF475569)),
                                              ),
                                            ],
                                          ),
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.end,
                                            children: [
                                              const Text('TOTAL AMOUNT', style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                                              const SizedBox(height: 2),
                                              Text(
                                                '₹${total.toStringAsFixed(2)}',
                                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF0F172A)),
                                              ),
                                            ],
                                          ),
                                          const Icon(Icons.chevron_right, size: 20, color: Color(0xFF94A3B8)),
                                        ],
                                      ),
                                    ],
                                  ),
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
    final s = status.toLowerCase();
    if (s == 'pending') {
      bg = const Color(0xFFFEF3C7);
      text = const Color(0xFFB45309);
    } else if (s == 'confirmed' || s == 'processing' || s == 'ready') {
      bg = const Color(0xFFDBEAFE);
      text = const Color(0xFF1D4ED8);
    } else if (s == 'delivered' || s == 'completed' || s == 'billed') {
      bg = const Color(0xFFDCFCE7);
      text = const Color(0xFF16A34A);
    } else if (s == 'cancelled' || s == 'rejected') {
      bg = const Color(0xFFFEE2E2);
      text = const Color(0xFFDC2626);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(color: text, fontSize: 9.5, fontWeight: FontWeight.bold),
      ),
    );
  }
}
