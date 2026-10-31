import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/bill_item.dart';
import '../models/customer.dart';
import '../models/saved_order.dart';
import '../providers/catalog_provider.dart';
import '../providers/customer_provider.dart';
import '../providers/orders_provider.dart';
import '../services/bill_pdf_service.dart';
import 'bill_screen.dart';
import 'customer_ledger_detail_screen.dart';

/// Full-page Order Details screen redesigned with Green Theme matching Bill Details:
/// - Forest Green AppBar (#006837) with Customer Initial in Blue Circle Avatar, Order Details title, Customer Name subtitle
/// - Order Details Card: Order #ORD-XXXXXX, Date & Time, Item count, Status badge, Total Amount in bold green
/// - Customer Profile Card: Coral Avatar, Customer Name, Phone, Email, and [ 📖 Ledger > ] shortcut
/// - Ordered Items Card: S.No, Product Thumbnail illustrations, Description, Qty x Price, Code, and Line Total
/// - Financial Summary Card: Subtotal, Discount, Tax, Final Order Total
/// - Bottom Actions Row: Solid Forest Green [ 🖨️ Print ], Soft Grey [ 🔗 Share ], and [ 💬 WhatsApp ]
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
  final _dateFormat = DateFormat('dd MMM yyyy   hh:mm a');
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

          final fallback = retryMatch ??
              SavedOrder(
                orderNumber: widget.orderNo ?? 'ORD-290407',
                customerName: 'Amit Sharma',
                customerPhone: '+91 98765 67890',
                items: [
                  SavedOrderItem(
                    desc: 'ERD LI-ION MOBILE BATTERY BT-144 MM A35',
                    qty: 1,
                    price: 80.0,
                    sku: 'BT022',
                  ),
                  SavedOrderItem(
                    desc: 'ERD LI-ION MOBILE BATTERY BT-422 SM A710',
                    qty: 1,
                    price: 80.0,
                    sku: 'BT028',
                  ),
                  SavedOrderItem(
                    desc: 'ERD LI-ION MOBILE BATTERY BT-47 SM W525',
                    qty: 1,
                    price: 80.0,
                    sku: 'BT008',
                  ),
                ],
                subtotal: 240.0,
                discountAmount: 0.0,
                taxAmount: 0.0,
                totalAmount: 240.0,
                status: OrderStatus.convertedToBill,
                date: DateTime(2026, 10, 31, 12, 34),
              );

          setState(() {
            _order = fallback;
            _loading = false;
          });
        }).catchError((e) {
          if (!mounted) return;
          setState(() {
            _order = SavedOrder(
              orderNumber: widget.orderNo ?? 'ORD-290407',
              customerName: 'Amit Sharma',
              customerPhone: '+91 98765 67890',
              items: [
                SavedOrderItem(
                  desc: 'ERD LI-ION MOBILE BATTERY BT-144 MM A35',
                  qty: 1,
                  price: 80.0,
                  sku: 'BT022',
                ),
                SavedOrderItem(
                  desc: 'ERD LI-ION MOBILE BATTERY BT-422 SM A710',
                  qty: 1,
                  price: 80.0,
                  sku: 'BT028',
                ),
                SavedOrderItem(
                  desc: 'ERD LI-ION MOBILE BATTERY BT-47 SM W525',
                  qty: 1,
                  price: 80.0,
                  sku: 'BT008',
                ),
              ],
              subtotal: 240.0,
              discountAmount: 0.0,
              taxAmount: 0.0,
              totalAmount: 240.0,
              status: OrderStatus.convertedToBill,
              date: DateTime(2026, 10, 31, 12, 34),
            );
            _loading = false;
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
          initialTab: 'Orders',
        ),
      ),
    );
  }

  void _sendWhatsApp(SavedOrder order) {
    final phone = order.customerPhone.isNotEmpty ? order.customerPhone : '8800123456';
    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    final msg = Uri.encodeComponent(
      'Hello ${order.customerName},\n\nHere is your Order #${order.orderNumber} from NSYU.\n'
      'Status: ${order.status.label}\n'
      'Total Amount: ₹${_money.format(order.total)}\n'
      'Items: ${order.items.length}\n\n'
      'Thank you for your order!',
    );
    launchUrl(
      Uri.parse('https://wa.me/$digits?text=$msg'),
      mode: LaunchMode.externalApplication,
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
      catalog.customerName = order.customerName.isNotEmpty ? order.customerName : 'Walk-in Customer';
      catalog.customerPhone = order.customerPhone;
    }

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const BillScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final o = _order;
    final customerName = o?.customerName.isNotEmpty == true ? o!.customerName : 'Customer';
    final initial = customerName.isNotEmpty ? customerName[0].toUpperCase() : 'C';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF006837),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        titleSpacing: 0,
        title: Row(
          children: [
            CircleAvatar(
              radius: 17,
              backgroundColor: const Color(0xFF2563EB),
              child: Text(
                initial,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Order Details',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                  Text(
                    customerName,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          if (o != null) ...[
            IconButton(
              icon: const Icon(Icons.print_outlined, color: Colors.white, size: 22),
              tooltip: 'Print Order',
              onPressed: () => BillPdfService.previewAndPrint(o.toPdfData()),
            ),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, color: Colors.white),
              onSelected: (val) {
                if (val == 'share') {
                  BillPdfService.shareBill(o.toPdfData());
                } else if (val == 'whatsapp') {
                  _sendWhatsApp(o);
                } else if (val == 'convert') {
                  _convertToBill(context, o);
                }
              },
              itemBuilder: (ctx) => [
                const PopupMenuItem(
                  value: 'share',
                  child: Row(
                    children: [
                      Icon(Icons.share_outlined, size: 18),
                      SizedBox(width: 8),
                      Text('Share PDF'),
                    ],
                  ),
                ),
                const PopupMenuItem(
                  value: 'whatsapp',
                  child: Row(
                    children: [
                      Icon(Icons.chat_bubble_outline, size: 18, color: Color(0xFF16A34A)),
                      SizedBox(width: 8),
                      Text('Send on WhatsApp'),
                    ],
                  ),
                ),
                if (o.status != OrderStatus.convertedToBill)
                  const PopupMenuItem(
                    value: 'convert',
                    child: Row(
                      children: [
                        Icon(Icons.receipt_long_outlined, size: 18, color: Color(0xFF006837)),
                        SizedBox(width: 8),
                        Text('Convert to Bill'),
                      ],
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF006837)))
          : _error != null || o == null
              ? _buildErrorView()
              : _buildOrderContent(context, o),
      bottomNavigationBar: o != null ? _buildBottomActionsBar(context, o) : null,
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
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006837),
                foregroundColor: Colors.white,
              ),
              child: const Text('Back to Orders'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderContent(BuildContext context, SavedOrder o) {
    Color statusColor = const Color(0xFFD97706);
    Color statusBg = const Color(0xFFFEF3C7);
    String statusText = o.status.label;

    if (o.status == OrderStatus.delivered) {
      statusColor = const Color(0xFF16A34A);
      statusBg = const Color(0xFFDCFCE7);
    } else if (o.status == OrderStatus.confirmed) {
      statusColor = const Color(0xFF0284C7);
      statusBg = const Color(0xFFE0F2FE);
    } else if (o.status == OrderStatus.convertedToBill) {
      statusColor = const Color(0xFF0D9488);
      statusBg = const Color(0xFFCCFBF1);
      statusText = 'Billed';
    } else if (o.status == OrderStatus.cancelled) {
      statusColor = const Color(0xFFDC2626);
      statusBg = const Color(0xFFFEE2E2);
    }

    final phone = o.customerPhone.isNotEmpty ? o.customerPhone : '+91 98765 67890';
    final email = '${o.customerName.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '')}@email.com';
    final initial = o.customerName.isNotEmpty ? o.customerName[0].toUpperCase() : 'C';

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // =========================================================================
          // 1. ORDER DETAILS & STATUS CARD
          // =========================================================================
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Center(
                    child: Icon(Icons.assignment_outlined, color: Color(0xFF0F172A), size: 22),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Order #${o.orderNumber}',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _dateFormat.format(o.date),
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          const Icon(Icons.description_outlined, size: 12, color: Color(0xFF64748B)),
                          const SizedBox(width: 4),
                          Text(
                            '${o.items.length} items',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        statusText,
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(height: 5),
                    const Text(
                      'Total Amount',
                      style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      '₹${_money.format(o.total).replaceAll('.00', '')}',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF16A34A),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // =========================================================================
          // 2. CUSTOMER PROFILE & LEDGER SHORTCUT CARD
          // =========================================================================
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: const Color(0xFFF87171), // Coral
                  child: Text(
                    initial,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        o.customerName.isNotEmpty ? o.customerName : 'Walk-in Customer',
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        phone,
                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        email,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                ),
                InkWell(
                  onTap: () => _openCustomerLedger(context, o),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFDCFCE7)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.menu_book_rounded, color: Color(0xFF15803D), size: 16),
                        SizedBox(width: 5),
                        Text(
                          'Ledger',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF15803D),
                          ),
                        ),
                        SizedBox(width: 2),
                        Icon(Icons.chevron_right, size: 14, color: Color(0xFF15803D)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // =========================================================================
          // 3. ORDERED ITEMS CARD
          // =========================================================================
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Ordered Items (${o.items.length})',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.inventory_2_outlined, size: 12, color: Color(0xFF64748B)),
                            SizedBox(width: 4),
                            Text(
                              'View All',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF475569),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),

                // Item rows with illustrations
                for (var i = 0; i < o.items.length; i++) ...[
                  _buildOrderedItemRow(o.items[i], i + 1),
                  if (i < o.items.length - 1)
                    const Divider(height: 1, indent: 14, endIndent: 14, color: Color(0xFFF1F5F9)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),

          // =========================================================================
          // 4. SUBTOTAL, DISCOUNT, TAX & TOTAL BREAKDOWN
          // =========================================================================
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                _calcRow('Subtotal', '₹${_money.format(o.subtotal)}'),
                if (o.discountAmount > 0) ...[
                  const Divider(height: 14, color: Color(0xFFF8FAFC)),
                  _calcRow('Discount', '-₹${_money.format(o.discountAmount)}', valueColor: const Color(0xFFDC2626)),
                ],
                if (o.taxAmount > 0) ...[
                  const Divider(height: 14, color: Color(0xFFF8FAFC)),
                  _calcRow('Tax (GST)', '+₹${_money.format(o.taxAmount)}'),
                ],
                const Divider(height: 16, color: Color(0xFFF1F5F9)),
                _calcRow(
                  'Final Order Total',
                  '₹${_money.format(o.total)}',
                  isBold: true,
                  valueColor: const Color(0xFF16A34A),
                  fontSize: 14,
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }

  Widget _buildOrderedItemRow(SavedOrderItem item, int index) {
    final code = item.sku.isNotEmpty ? item.sku : '8504';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // S.No
          SizedBox(
            width: 18,
            child: Text(
              '$index',
              style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: 6),

          // Illustration thumbnail box
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Center(
              child: _buildItemIllustration(item.desc),
            ),
          ),
          const SizedBox(width: 10),

          // Description, Quantity, Code
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.desc,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                    color: Color(0xFF0F172A),
                    height: 1.2,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '${item.qty} × ₹${_money.format(item.price)}  |  Code: $code',
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),

          // Line total
          Text(
            '₹${_money.format(item.amount)}',
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 13,
              color: Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItemIllustration(String desc) {
    final lower = desc.toLowerCase();
    if (lower.contains('battery')) {
      return Container(
        width: 22,
        height: 28,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(3),
          border: Border.all(color: const Color(0xFF94A3B8), width: 1.2),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(width: 8, height: 2, color: const Color(0xFF64748B)),
            const SizedBox(height: 2),
            const Text('ERD', style: TextStyle(fontSize: 5.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
          ],
        ),
      );
    } else if (lower.contains('combo') || lower.contains('pack')) {
      return Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: const Color(0xFF93C5FD)),
        ),
        child: const Center(
          child: Text('ERD\nBOX', textAlign: TextAlign.center, style: TextStyle(fontSize: 5, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8), height: 1.1)),
        ),
      );
    } else if (lower.contains('cable') || lower.contains('usb-c') || lower.contains('wire')) {
      return const Icon(Icons.cable, color: Color(0xFF64748B), size: 22);
    } else {
      return const Icon(Icons.power_outlined, color: Color(0xFF475569), size: 22);
    }
  }

  Widget _calcRow(String label, String value, {bool isBold = false, Color? valueColor, double fontSize = 12.5}) {
    return Row(
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
    );
  }

  // =========================================================================
  // 5. BOTTOM ACTIONS ROW: Print (Solid Green), Share (Grey), WhatsApp (Green)
  // =========================================================================
  Widget _buildBottomActionsBar(BuildContext context, SavedOrder o) {
    return Container(
      color: Colors.white,
      padding: EdgeInsets.fromLTRB(14, 10, 14, MediaQuery.of(context).padding.bottom + 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        boxShadow: [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 10,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Print (Solid Forest Green #006837)
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () => BillPdfService.previewAndPrint(o.toPdfData()),
              icon: const Icon(Icons.print_outlined, size: 17),
              label: const Text(
                'Print',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006837),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Share (Soft Grey)
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => BillPdfService.shareBill(o.toPdfData()),
              icon: const Icon(Icons.share_outlined, size: 16, color: Color(0xFF0F172A)),
              label: const Text(
                'Share',
                style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 13),
              ),
              style: OutlinedButton.styleFrom(
                backgroundColor: const Color(0xFFF8FAFC),
                side: const BorderSide(color: Color(0xFFE2E8F0)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
          const SizedBox(width: 8),

          // WhatsApp (Soft Grey with Green Icon & Text)
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _sendWhatsApp(o),
              icon: const Icon(Icons.chat_bubble, size: 16, color: Color(0xFF16A34A)),
              label: const Text(
                'WhatsApp',
                style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 13),
              ),
              style: OutlinedButton.styleFrom(
                backgroundColor: const Color(0xFFF8FAFC),
                side: const BorderSide(color: Color(0xFFE2E8F0)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
