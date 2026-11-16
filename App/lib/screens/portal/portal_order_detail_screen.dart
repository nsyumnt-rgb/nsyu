import 'package:flutter/material.dart';
import '../../services/customer_portal_service.dart';
import '../../theme/app_theme.dart';
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
        content: const Text(
          'Are you sure you want to cancel this pending order? This action cannot be reversed.',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Order', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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
        showAppSnackBar(context, 'Order has been cancelled successfully.');
      }
    } catch (e) {
      if (mounted) {
        showAppSnackBar(context, e.toString().replaceAll('Exception: ', ''), isError: true);
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
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text('Order Details', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
        ),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: SkeletonLoader.list(count: 3),
        ),
      );
    }

    if (_error != null || _order == null) {
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
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text('Order Details', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
        ),
        body: Center(
          child: EmptyState(
            icon: Icons.error_outline_rounded,
            title: 'Unable to Load Order',
            subtitle: _error ?? 'Order details could not be found.',
            buttonLabel: 'Retry',
            onButtonPressed: _fetchOrder,
          ),
        ),
      );
    }

    final orderNum = _order!['order_number']?.toString() ?? '${widget.orderId}';
    final status = _order!['status']?.toString() ?? 'pending';
    final total = parseDouble(_order!['total_amount']);
    final subtotal = parseDouble(_order!['subtotal'] ?? total);
    final discount = parseDouble(_order!['discount_amount'] ?? _order!['discount']);
    final tax = parseDouble(_order!['tax_amount'] ?? _order!['tax']);
    final items = (_order!['items'] as List<dynamic>?) ?? [];
    final dt = _order!['createdAt']?.toString() ?? _order!['order_date']?.toString();
    final dateStr = formatDateSafe(dt, 'dd MMM yyyy, hh:mm a');
    final convertedSaleId = parseInt(_order!['converted_sale_id']);
    final shippingAddress = _order!['shipping_address']?.toString() ?? _order!['customer']?['address']?.toString();
    final cancelReason = _order!['rejection_reason']?.toString() ?? _order!['notes']?.toString();

    const workflowSteps = ['Pending', 'Confirmed', 'Processing', 'Ready', 'Completed'];
    final currentStepIdx = _getStatusStepIndex(status);
    final isCancelled = status.toLowerCase() == 'cancelled' || status.toLowerCase() == 'rejected';

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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          '#$orderNum',
          style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── 1. Order Status Tracking Stepper ──
            AppCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'ORDER STATUS TRACKER',
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textSecondary,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        dateStr,
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  if (isCancelled)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.dangerBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFECACA)),
                      ),
                      child: Column(
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.cancel_rounded, color: AppColors.danger, size: 20),
                              SizedBox(width: 8),
                              Text(
                                'Order Cancelled / Rejected',
                                style: TextStyle(
                                  color: AppColors.danger,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13.5,
                                ),
                              ),
                            ],
                          ),
                          if (cancelReason != null && cancelReason.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              'Reason: $cancelReason',
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 12, color: Color(0xFF991B1B)),
                            ),
                          ],
                        ],
                      ),
                    )
                  else
                    // 5-step visual tracking timeline
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: workflowSteps.asMap().entries.map((entry) {
                        final idx = entry.key;
                        final stepName = entry.value;
                        final isPassed = currentStepIdx > idx;
                        final isCurrent = currentStepIdx == idx;

                        Color circleBg;
                        Color circleFg;
                        Border? circleBorder;

                        if (isCurrent) {
                          circleBg = AppColors.navy900;
                          circleFg = Colors.white;
                          circleBorder = Border.all(color: AppColors.blue100, width: 3);
                        } else if (isPassed) {
                          circleBg = AppColors.successBg;
                          circleFg = AppColors.success;
                          circleBorder = Border.all(color: const Color(0xFFBBF7D0));
                        } else {
                          circleBg = AppColors.bg;
                          circleFg = AppColors.textSecondary;
                          circleBorder = Border.all(color: AppColors.border);
                        }

                        return Expanded(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: circleBg,
                                  shape: BoxShape.circle,
                                  border: circleBorder,
                                ),
                                child: Center(
                                  child: isPassed
                                      ? const Icon(Icons.check_rounded, size: 16, color: AppColors.success)
                                      : Text(
                                          '${idx + 1}',
                                          style: TextStyle(
                                            color: circleFg,
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                stepName,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                                  color: isCurrent
                                      ? AppColors.navy900
                                      : (isPassed ? AppColors.success : AppColors.textSecondary),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),

            // ── 2. Converted Invoice Banner (if fulfilled) ──
            if (convertedSaleId > 0) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.blue50,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.blue100),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.receipt_long_rounded, color: AppColors.navy900, size: 20),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Tax Invoice Generated',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.navy900),
                          ),
                          Text(
                            'Official bill is available for download.',
                            style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.navy900,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => PortalBillDetailScreen(billId: convertedSaleId)),
                        );
                      },
                      child: const Text('View Bill', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 14),

            // ── 3. Delivery Address Card ──
            if (shippingAddress != null && shippingAddress.isNotEmpty) ...[
              AppCard(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.blue50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.location_on_outlined, color: AppColors.blue600, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'DELIVERY ADDRESS',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textSecondary,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            shippingAddress,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],

            // ── 4. Ordered Products & Price Breakdown ──
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Ordered Products',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.navy900),
                        ),
                        Text(
                          '${items.length} ${items.length == 1 ? "item" : "items"}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                  ...items.map((it) {
                    final pName = it['product_name']?.toString() ?? 'Product';
                    final q = parseInt(it['quantity'], 1);
                    final rate = parseDouble(it['unit_price']);
                    final lineTot = parseDouble(it['line_total'] ?? (q * rate));

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: const BoxDecoration(
                        border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
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
                                  style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Qty: $q × ₹${rate.toStringAsFixed(2)}',
                                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          AmountText(
                            amount: lineTot,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ],
                      ),
                    );
                  }),

                  // Price Summary Lines
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        _buildSummaryLine('Subtotal', subtotal),
                        if (discount > 0)
                          _buildSummaryLine('Discount', -discount, color: AppColors.success),
                        if (tax > 0)
                          _buildSummaryLine('GST Tax', tax),
                        const Divider(height: 20, color: AppColors.border),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Grand Total',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: AppColors.navy900,
                              ),
                            ),
                            AmountText(
                              amount: total,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: AppColors.navy900,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ── 5. Cancel Action if Pending ──
            if (status.toLowerCase() == 'pending')
              SizedBox(
                width: double.infinity,
                child: SecondaryButton(
                  label: _cancelling ? 'Cancelling Order...' : 'Cancel Order',
                  icon: Icons.cancel_outlined,
                  onPressed: _cancelling ? null : _handleCancel,
                ),
              ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryLine(String label, double amount, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
          ),
          AmountText(
            amount: amount,
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: color ?? AppColors.textPrimary,
          ),
        ],
      ),
    );
  }
}
