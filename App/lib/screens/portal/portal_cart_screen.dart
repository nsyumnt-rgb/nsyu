import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../providers/customer_portal_provider.dart';
import 'portal_order_detail_screen.dart';

class PortalCartScreen extends StatefulWidget {
  const PortalCartScreen({super.key});

  @override
  State<PortalCartScreen> createState() => _PortalCartScreenState();
}

class _PortalCartScreenState extends State<PortalCartScreen> {
  final TextEditingController _noteCtrl = TextEditingController();
  final TextEditingController _addressCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final portal = context.read<CustomerPortalProvider>();
      portal.refreshCart();
      final cust = portal.customer;
      if (cust?['address'] != null) {
        _addressCtrl.text = cust!['address'].toString();
      }
    });
  }

  @override
  void dispose() {
    _noteCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _handlePlaceOrder() async {
    final portal = context.read<CustomerPortalProvider>();
    final cart = portal.cart;
    final items = (cart?['items'] as List<dynamic>?) ?? [];

    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Your cart is empty. Please add products first.')),
      );
      return;
    }

    // Check for stock errors
    for (final it in items) {
      if (it['exceedsStock'] == true || it['isUnavailable'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${it['name']} exceeds available stock. Please adjust quantity.'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
        return;
      }
    }

    setState(() => _submitting = true);
    final clientRequestId = const Uuid().v4();

    try {
      final res = await portal.placeOrder(
        clientRequestId: clientRequestId,
        note: _noteCtrl.text.trim().isNotEmpty ? _noteCtrl.text.trim() : null,
        shippingAddress: _addressCtrl.text.trim().isNotEmpty ? _addressCtrl.text.trim() : null,
        deliveryType: 'standard',
      );

      if (!mounted) return;
      setState(() => _submitting = false);

      final orderId = (res['id'] as num?)?.toInt();
      final orderNumber = res['order_number']?.toString() ?? 'ORD-$orderId';
      final total = ((res['total_amount'] ?? 0) as num).toDouble();

      // Show professional order confirmation dialog
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                width: 64,
                height: 64,
                decoration: const BoxDecoration(
                  color: Color(0xFFDCFCE7),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 40),
              ),
              const SizedBox(height: 16),
              const Text(
                'Order Placed Successfully!',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Order #$orderNumber',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF1D4ED8)),
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'STATUS: PENDING',
                  style: TextStyle(color: Color(0xFFB45309), fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Total Amount: ₹${total.toStringAsFixed(2)}\nYour order has been sent to the store. Placing an order does not create a bill until fulfilled.',
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D4ED8),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    if (orderId != null) {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => PortalOrderDetailScreen(orderId: orderId)),
                      );
                    }
                  },
                  child: const Text('Track Order', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final portal = context.watch<CustomerPortalProvider>();
    final cart = portal.cart;
    final cust = portal.customer;
    final items = (cart?['items'] as List<dynamic>?) ?? [];
    final cartCount = portal.cartItemCount;
    final subtotal = ((cart?['subtotal'] ?? 0) as num).toDouble();
    final discount = ((cart?['discountAmount'] ?? 0) as num).toDouble();
    final tax = ((cart?['taxAmount'] ?? 0) as num).toDouble();
    final grandTotal = portal.cartEstimatedTotal;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D4ED8),
        elevation: 0,
        title: Row(
          children: [
            Badge(
              label: Text('$cartCount'),
              backgroundColor: const Color(0xFFDC2626),
              child: const Icon(Icons.shopping_cart, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Shopping Cart',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                Text(
                  '$cartCount ${cartCount == 1 ? "Item" : "Items"}',
                  style: const TextStyle(color: Color(0xFFDBEAFE), fontSize: 11),
                ),
              ],
            ),
          ],
        ),
        actions: [
          if (items.isNotEmpty)
            TextButton.icon(
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Clear Cart?'),
                    content: const Text('Are you sure you want to remove all items from your cart?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                      FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Clear'),
                      ),
                    ],
                  ),
                );
                if (confirm == true) {
                  portal.clearCart();
                }
              },
              icon: const Icon(Icons.delete_outline, color: Colors.white, size: 18),
              label: const Text(
                'Clear',
                style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
        ],
      ),

      body: items.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: const BoxDecoration(
                      color: Color(0xFFDBEAFE),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.shopping_cart_outlined, size: 40, color: Color(0xFF1D4ED8)),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Your Cart is Empty',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Browse the catalog to add items to your cart.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1D4ED8),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () => portal.switchTab(1),
                    child: const Text('Explore Catalog'),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Customer Delivery Card
                  Container(
                    padding: const EdgeInsets.all(14),
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
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDBEAFE),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.person_pin, color: Color(0xFF1D4ED8), size: 18),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    (cust?['name'] ?? 'Customer').toString(),
                                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                  ),
                                  Text(
                                    'Mobile: +91 ${cust?['phone'] ?? ''}',
                                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _addressCtrl,
                          decoration: InputDecoration(
                            labelText: 'Delivery / Shop Address',
                            labelStyle: const TextStyle(fontSize: 12),
                            prefixIcon: const Icon(Icons.location_on_outlined, size: 18),
                            filled: true,
                            fillColor: const Color(0xFFF8FAFC),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                            isDense: true,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Cart Items List
                  const Text(
                    'Selected Products',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 8),

                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, i) {
                      final item = items[i] as Map<String, dynamic>;
                      final prodId = (item['productId'] ?? item['product_id'] as num).toInt();
                      final name = item['name']?.toString() ?? 'Product';
                      final qty = (item['quantity'] as num?)?.toInt() ?? 1;
                      final unitPrice = ((item['unitPrice'] ?? item['price'] ?? 0) as num).toDouble();
                      final lineTotal = ((item['lineTotal'] ?? qty * unitPrice) as num).toDouble();
                      final img = item['imageUrl']?.toString();
                      final exceedsStock = item['exceedsStock'] == true;
                      final availableStock = (item['availableStock'] as num?)?.toInt() ?? 0;

                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: exceedsStock ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0)),
                          boxShadow: const [
                            BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Product Image
                                Container(
                                  width: 58,
                                  height: 58,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: img != null && img.isNotEmpty
                                      ? ClipRRect(
                                          borderRadius: BorderRadius.circular(10),
                                          child: Image.network(img, fit: BoxFit.contain),
                                        )
                                      : const Icon(Icons.image_outlined, color: Color(0xFF94A3B8)),
                                ),
                                const SizedBox(width: 12),

                                // Name & Unit Price
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        name,
                                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        'Unit Price: ₹${unitPrice.toStringAsFixed(2)}',
                                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                      ),
                                      if (exceedsStock)
                                        Text(
                                          'Only $availableStock left in stock!',
                                          style: const TextStyle(fontSize: 10.5, color: Color(0xFFDC2626), fontWeight: FontWeight.bold),
                                        ),
                                    ],
                                  ),
                                ),

                                // Remove button
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, size: 20, color: Color(0xFFDC2626)),
                                  onPressed: () => portal.setCartItem(prodId, 0),
                                  tooltip: 'Remove',
                                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                  padding: EdgeInsets.zero,
                                ),
                              ],
                            ),

                            const Divider(height: 16),

                            // Quantity Stepper and Item Total Row
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                // Stepper
                                Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: const Color(0xFFCBD5E1)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.remove, size: 16, color: Color(0xFF1D4ED8)),
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                        onPressed: () => portal.setCartItem(prodId, qty - 1),
                                      ),
                                      Text(
                                        '$qty',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.add, size: 16, color: Color(0xFF1D4ED8)),
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                        onPressed: () => portal.setCartItem(prodId, qty + 1),
                                      ),
                                    ],
                                  ),
                                ),

                                // Line Total
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    const Text('ITEM TOTAL', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
                                    Text(
                                      '₹${lineTotal.toStringAsFixed(2)}',
                                      style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
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

                  const SizedBox(height: 14),

                  // Order Summary Card
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
                        const Padding(
                          padding: EdgeInsets.all(14),
                          child: Text(
                            'Order Summary',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF0F172A)),
                          ),
                        ),
                        const Divider(height: 1),
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
                              _buildSummaryRow('Grand Total', '₹${grandTotal.toStringAsFixed(2)}', isBold: true, fontSize: 16, color: const Color(0xFF1D4ED8)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Order Notes (Optional)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Order Notes (Optional)',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _noteCtrl,
                          decoration: InputDecoration(
                            hintText: 'Any special instructions for the store...',
                            hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                            filled: true,
                            fillColor: const Color(0xFFF8FAFC),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFCBD5E1))),
                            isDense: true,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Place Order CTA
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1D4ED8),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 2,
                      ),
                      icon: _submitting
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Icon(Icons.check_circle_outline, color: Colors.white),
                      label: Text(
                        _submitting ? 'Placing Order...' : 'Place Order (₹${grandTotal.toStringAsFixed(2)})',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                      ),
                      onPressed: _submitting ? null : _handlePlaceOrder,
                    ),
                  ),
                  const SizedBox(height: 28),
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
