import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/customer_portal_service.dart';
import 'portal_bill_detail_screen.dart';

class PortalOrderDetailScreen extends StatefulWidget {
  final int orderId;
  const PortalOrderDetailScreen({super.key, required this.orderId});

  @override
  State<PortalOrderDetailScreen> createState() => _PortalOrderDetailScreenState();
}

class _PortalOrderDetailScreenState extends State<PortalOrderDetailScreen> {
  final CustomerPortalService _service = CustomerPortalService();
  Map<String, dynamic>? _order;
  bool _loading = true;
  bool _cancelling = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchOrder();
  }

  Future<void> _fetchOrder() async {
    setState(() => _loading = true);
    try {
      final ord = await _service.getOrder(widget.orderId);
      if (mounted) setState(() => _order = ord);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _handleCancel() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Cancel Order?', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Are you sure you want to cancel this pending order? This action cannot be reversed.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Back')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Yes, Cancel Order'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _cancelling = true);
    try {
      await _service.cancelOrder(widget.orderId);
      await _fetchOrder();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Order has been cancelled successfully.'),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll('Exception: ', '')),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  int _getStatusStepIndex(String status) {
    final s = status.toLowerCase();
    switch (s) {
      case 'pending':
        return 0;
      case 'confirmed':
        return 1;
      case 'processing':
        return 2;
      case 'ready':
      case 'shipped':
        return 3;
      case 'completed':
      case 'delivered':
      case 'billed':
        return 4;
      default:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(
          backgroundColor: const Color(0xFF1D4ED8),
          title: const Text('Order Details', style: TextStyle(color: Colors.white)),
        ),
        body: const Center(child: CircularProgressIndicator(color: Color(0xFF1D4ED8))),
      );
    }

    if (_error != null || _order == null) {
      return Scaffold(
        appBar: AppBar(
          backgroundColor: const Color(0xFF1D4ED8),
          title: const Text('Order Details', style: TextStyle(color: Colors.white)),
        ),
        body: Center(
          child: Text(_error ?? 'Order not found', style: const TextStyle(color: Color(0xFF64748B))),
        ),
      );
    }

    final orderNum = _order!['order_number']?.toString() ?? '${widget.orderId}';
    final status = _order!['status']?.toString() ?? 'pending';
    final total = ((_order!['total_amount'] ?? 0) as num).toDouble();
    final subtotal = ((_order!['subtotal'] ?? total) as num).toDouble();
    final discount = ((_order!['discount_amount'] ?? _order!['discount'] ?? 0) as num).toDouble();
    final tax = ((_order!['tax_amount'] ?? _order!['tax'] ?? 0) as num).toDouble();
    final items = (_order!['items'] as List<dynamic>?) ?? [];
    final dt = _order!['createdAt']?.toString();
    final dateStr = dt != null ? DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(dt)) : '';
    final convertedSaleId = (_order!['converted_sale_id'] as num?)?.toInt();
    final shippingAddress = _order!['shipping_address']?.toString() ?? _order!['customer']?['address']?.toString();
    final cancelReason = _order!['rejection_reason']?.toString() ?? _order!['notes']?.toString();

    const workflowSteps = ['Pending', 'Confirmed', 'Processing', 'Ready', 'Completed'];
    final currentStepIdx = _getStatusStepIndex(status);
    final isCancelled = status.toLowerCase() == 'cancelled' || status.toLowerCase() == 'rejected';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D4ED8),
        elevation: 0,
        title: Text(
          'Order #$orderNum',
          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Order Workflow Timeline Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'ORDER STATUS TRACKER',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF64748B), letterSpacing: 0.5),
                      ),
                      Text(dateStr, style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8))),
                    ],
                  ),
                  const SizedBox(height: 16),

                  if (isCancelled)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Column(
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.cancel_outlined, color: Color(0xFFDC2626), size: 18),
                              SizedBox(width: 6),
                              Text(
                                'Order Cancelled / Rejected',
                                style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ],
                          ),
                          if (cancelReason != null && cancelReason.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Reason: $cancelReason',
                              style: const TextStyle(fontSize: 11.5, color: Color(0xFF7F1D1D)),
                            ),
                          ],
                        ],
                      ),
                    )
                  else
                    // 5-step workflow tracker
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: workflowSteps.asMap().entries.map((entry) {
                        final idx = entry.key;
                        final stepName = entry.value;
                        final isPassed = currentStepIdx >= idx;
                        final isCurrent = currentStepIdx == idx;

                        return Column(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: isCurrent
                                    ? const Color(0xFF1D4ED8)
                                    : isPassed
                                        ? const Color(0xFF16A34A)
                                        : const Color(0xFFF1F5F9),
                                shape: BoxShape.circle,
                                border: isCurrent ? Border.all(color: const Color(0xFFDBEAFE), width: 3) : null,
                              ),
                              child: Center(
                                child: Text(
                                  isPassed ? '✓' : '${idx + 1}',
                                  style: TextStyle(
                                    color: (isPassed || isCurrent) ? Colors.white : const Color(0xFF94A3B8),
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              stepName,
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                                color: isCurrent
                                    ? const Color(0xFF1D4ED8)
                                    : isPassed
                                        ? const Color(0xFF16A34A)
                                        : const Color(0xFF94A3B8),
                              ),
                            ),
                          ],
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),

            if (convertedSaleId != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.receipt_long, color: Color(0xFF1D4ED8), size: 22),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        'Tax Invoice generated for this fulfilled order.',
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF1E40AF)),
                      ),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1D4ED8),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => PortalBillDetailScreen(billId: convertedSaleId)),
                        );
                      },
                      child: const Text('View Bill', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 16),

            // Delivery Details Card
            if (shippingAddress != null && shippingAddress.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.location_on_outlined, color: Color(0xFF1D4ED8), size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Delivery Address', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                          Text(shippingAddress, style: const TextStyle(fontSize: 12.5, color: Color(0xFF0F172A), fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Ordered Items
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Ordered Products',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF0F172A)),
                        ),
                        Text(
                          '${items.length} items',
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  ...items.map((it) {
                    final pName = it['product_name']?.toString() ?? 'Product';
                    final q = ((it['quantity'] ?? 1) as num).toInt();
                    final rate = ((it['unit_price'] ?? 0) as num).toDouble();
                    final lineTot = ((it['line_total'] ?? q * rate) as num).toDouble();

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: const BoxDecoration(
                        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  pName,
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Qty: $q × ₹${rate.toStringAsFixed(2)}',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '₹${lineTot.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                    );
                  }),

                  // Financial Summary
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        _buildSummaryRow('Subtotal', '₹${subtotal.toStringAsFixed(2)}'),
                        if (discount > 0)
                          _buildSummaryRow('Discount', '-₹${discount.toStringAsFixed(2)}', color: const Color(0xFF16A34A)),
                        if (tax > 0)
                          _buildSummaryRow('GST Tax', '₹${tax.toStringAsFixed(2)}'),
                        const Divider(height: 18),
                        _buildSummaryRow('Order Total', '₹${total.toStringAsFixed(2)}', isBold: true, fontSize: 15, color: const Color(0xFF1D4ED8)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Cancel Order Action if Pending
            if (status.toLowerCase() == 'pending')
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFDC2626),
                    side: const BorderSide(color: Color(0xFFDC2626)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: const Icon(Icons.cancel_outlined, size: 18),
                  label: Text(_cancelling ? 'Cancelling Order...' : 'Cancel Order'),
                  onPressed: _cancelling ? null : _handleCancel,
                ),
              ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false, Color? color, double fontSize = 12.5}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: const Color(0xFF64748B),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.bold,
              color: color ?? const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }
}
