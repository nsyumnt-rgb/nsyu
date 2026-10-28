import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/bill_item.dart';
import '../models/customer.dart';
import '../models/saved_order.dart';
import '../providers/catalog_provider.dart';
import '../providers/customer_provider.dart';
import '../providers/orders_provider.dart';
import 'bill_screen.dart';
import 'customer_ledger_detail_screen.dart';
import 'product_detail_screen.dart';

/// Full-page Order Details screen displaying authoritative database order info,
/// customer relationships, items, line calculations, and controlled Convert to Bill action.
class OrderDetailScreen extends StatefulWidget {
  final SavedOrder? initialOrder;
  final String? orderNo;

  const OrderDetailScreen({
    super.key,
    this.initialOrder,
    this.orderNo,
  }) : assert(initialOrder != null || orderNo != null,
            'Must provide either initialOrder or orderNo');

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final _money = NumberFormat('#,##0.00');
  SavedOrder? _order;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _order = widget.initialOrder;
    if (_order == null && widget.orderNo != null) {
      _loadOrder();
    }
  }

  void _loadOrder() {
    setState(() {
      _loading = true;
      _error = null;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ordersProvider = context.read<OrdersProvider>();
      final match = ordersProvider.orders.cast<SavedOrder?>().firstWhere(
            (o) =>
                o != null &&
                (o.orderNumber.toLowerCase() == widget.orderNo!.toLowerCase() ||
                    'ord-${o.orderNumber.toLowerCase()}' == widget.orderNo!.toLowerCase()),
            orElse: () => null,
          );

      if (match != null) {
        if (mounted) {
          setState(() {
            _order = match;
            _loading = false;
          });
        }
      } else {
        ordersProvider.load().then((_) {
          if (!mounted) return;
          final retryMatch = ordersProvider.orders.cast<SavedOrder?>().firstWhere(
                (o) =>
                    o != null &&
                    (o.orderNumber.toLowerCase() == widget.orderNo!.toLowerCase() ||
                        'ord-${o.orderNumber.toLowerCase()}' == widget.orderNo!.toLowerCase()),
                orElse: () => null,
              );
          setState(() {
            _order = retryMatch;
            _loading = false;
            if (retryMatch == null) {
              _error = 'Order "${widget.orderNo}" not found.';
            }
          });
        }).catchError((e) {
          if (!mounted) return;
          setState(() {
            _loading = false;
            _error = e.toString();
          });
        });
      }
    });
  }

  void _openCustomerLedger(BuildContext context, SavedOrder order) {
    final custProvider = context.read<CustomerProvider>();
    Customer? targetCustomer;
    for (final c in custProvider.customers) {
      if (c.name.trim().toLowerCase() == order.customerName.trim().toLowerCase() ||
          (order.customerPhone.isNotEmpty && c.mobile == order.customerPhone)) {
        targetCustomer = c;
        break;
      }
    }

    final cust = targetCustomer ??
        Customer(
          id: '0',
          name: order.customerName.isNotEmpty ? order.customerName : 'Walk-in Customer',
          mobile: order.customerPhone,
          currentBalance: 0.0,
        );

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CustomerLedgerDetailScreen(
          partyName: cust.name,
          customer: cust,
        ),
      ),
    );
  }

  void _convertToBill(BuildContext context, SavedOrder order) {
    final catalog = context.read<CatalogProvider>();
    final custProvider = context.read<CustomerProvider>();

    Customer? matchedCustomer;
    for (final c in custProvider.customers) {
      if (c.name.trim().toLowerCase() == order.customerName.trim().toLowerCase() ||
          (order.customerPhone.isNotEmpty && c.mobile == order.customerPhone)) {
        matchedCustomer = c;
        break;
      }
    }

    // Populate CatalogProvider's bill items safely without duplicating database records
    catalog.billItems.clear();
    for (final oi in order.items) {
      catalog.billItems.add(
        BillItem(
          code: oi.sku.isNotEmpty ? oi.sku : oi.desc,
          desc: oi.desc,
          spec: '',
          price: oi.price,
          qty: oi.qty,
          availableStock: oi.availableStock,
        ),
      );
    }

    if (matchedCustomer != null) {
      catalog.selectCustomer(matchedCustomer);
    } else {
      catalog.setCustomerName(order.customerName);
    }

    // Set order status to converted
    context.read<OrdersProvider>().setStatus(order.orderNumber, OrderStatus.convertedToBill);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Order products transferred to Create Bill draft.'),
        backgroundColor: Color(0xFF1D4ED8),
        duration: Duration(seconds: 2),
      ),
    );

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const BillScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final o = _order;
    final title = o?.orderNumber ?? widget.orderNo ?? 'Order Details';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D9488),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Order Details',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
            ),
            Text(
              'Order #$title',
              style: const TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null || o == null
              ? _buildErrorView()
              : _buildOrderContent(context, o),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.assignment_outlined, size: 54, color: Color(0xFF94A3B8)),
            const SizedBox(height: 16),
            Text(
              _error ?? 'Order record not found.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0D9488)),
              child: const Text('Back to Orders', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderContent(BuildContext context, SavedOrder o) {
    final isConverted = o.status == OrderStatus.convertedToBill;
    final isDelivered = o.status == OrderStatus.delivered;
    final isCancelled = o.status == OrderStatus.cancelled;

    final Color statusColor = isConverted
        ? const Color(0xFF1D4ED8)
        : isDelivered
            ? const Color(0xFF16A34A)
            : isCancelled
                ? const Color(0xFFDC2626)
                : const Color(0xFFD97706);

    final Color statusBg = statusColor.withOpacity(0.12);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Order Header Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Order #${o.orderNumber}',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: statusBg, borderRadius: BorderRadius.circular(6)),
                      child: Text(
                        o.status.label.toUpperCase(),
                        style: TextStyle(color: statusColor, fontSize: 11.5, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF64748B)),
                    const SizedBox(width: 6),
                    Text(
                      'Ordered: ${DateFormat('dd MMM yyyy, hh:mm a').format(o.date)}',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                if (o.expectedDeliveryDate != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.local_shipping_outlined, size: 14, color: Color(0xFF0D9488)),
                      const SizedBox(width: 6),
                      Text(
                        'Expected: ${DateFormat('dd MMM yyyy').format(o.expectedDeliveryDate!)}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0D9488)),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Customer Profile Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDFA),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.person, color: Color(0xFF0D9488), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'CUSTOMER',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.5),
                      ),
                      Text(
                        o.customerName.isEmpty ? 'Walk-in Customer' : o.customerName,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                      ),
                      if (o.customerPhone.isNotEmpty)
                        Text(o.customerPhone, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                    ],
                  ),
                ),
                OutlinedButton(
                  onPressed: () => _openCustomerLedger(context, o),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF99F6E4)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Ledger', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0D9488))),
                      SizedBox(width: 4),
                      Icon(Icons.arrow_forward_ios, size: 10, color: Color(0xFF0D9488)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Order Items Table
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(
                    'Order Items (${o.items.length})',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                for (var i = 0; i < o.items.length; i++) ...[
                  InkWell(
                    onTap: () {
                      final item = o.items[i];
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ProductDetailScreen(
                            productCode: item.sku.isNotEmpty ? item.sku : item.desc,
                          ),
                        ),
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 20,
                            child: Text('${i + 1}', style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  o.items[i].desc,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0D9488)),
                                ),
                                if (o.items[i].sku.isNotEmpty)
                                  Text('SKU: ${o.items[i].sku}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                                Text(
                                  '${o.items[i].qty} × ₹${_money.format(o.items[i].price)}' +
                                      (o.items[i].discountPercent > 0 ? ' (${o.items[i].discountPercent}% off)' : ''),
                                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '₹${_money.format(o.items[i].amount)}',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (i < o.items.length - 1)
                    const Divider(height: 1, indent: 14, endIndent: 14, color: Color(0xFFF1F5F9)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Financial Summary
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                _calcRow('Subtotal', '₹${_money.format(o.subtotal)}'),
                if (o.discountAmount > 0)
                  _calcRow('Discount', '-₹${_money.format(o.discountAmount)}', valueColor: const Color(0xFFDC2626)),
                if (o.taxAmount > 0)
                  _calcRow('Tax (18% GST)', '+₹${_money.format(o.taxAmount)}'),
                const Divider(height: 16, color: Color(0xFFE2E8F0)),
                _calcRow('Final Order Total', '₹${_money.format(o.totalAmount)}', isBold: true, fontSize: 16),
              ],
            ),
          ),
          if (o.remarks.isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.notes, size: 16, color: Color(0xFF64748B)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('Remarks: ${o.remarks}', style: const TextStyle(fontSize: 12.5, color: Color(0xFF475569))),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 20),

          // Convert to Bill Action Button
          if (!isConverted)
            ElevatedButton.icon(
              onPressed: () => _convertToBill(context, o),
              icon: const Icon(Icons.receipt_long, size: 18),
              label: const Text('Convert to Bill (Create Sales Bill)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _calcRow(String label, String value, {bool isBold = false, Color? valueColor, double fontSize = 13}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
              color: isBold ? const Color(0xFF0F172A) : const Color(0xFF64748B),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
              color: valueColor ?? (isBold ? const Color(0xFF0F172A) : const Color(0xFF334155)),
            ),
          ),
        ],
      ),
    );
  }
}
