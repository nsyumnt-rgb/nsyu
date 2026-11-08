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
  bool _submitting = false;

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _handlePlaceOrder() async {
    final portal = context.read<CustomerPortalProvider>();
    final cart = portal.cart;
    final items = cart?['items'] as List<dynamic>?;

    if (items == null || items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Your cart is empty.')),
      );
      return;
    }

    setState(() => _submitting = true);
    final clientRequestId = const Uuid().v4();

    try {
      final res = await portal.placeOrder(
        clientRequestId: clientRequestId,
        note: _noteCtrl.text.trim().isNotEmpty ? _noteCtrl.text.trim() : null,
        deliveryType: 'pickup',
      );

      if (!mounted) return;
      setState(() => _submitting = false);

      final orderId = (res['id'] as num?)?.toInt();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Order placed successfully! Shop staff has been notified.'),
          backgroundColor: Color(0xFF047857),
        ),
      );

      if (orderId != null) {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => PortalOrderDetailScreen(orderId: orderId)),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: const Color(0xFFBE123C),
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
      backgroundColor: const Color(0xFFF1F5F9),
      // Top Green App Bar matching screenshot
      appBar: AppBar(
        backgroundColor: const Color(0xFF047857),
        elevation: 0,
        title: Row(
          children: [
            Badge(
              label: Text('$cartCount'),
              backgroundColor: const Color(0xFFE11D48),
              child: const Icon(Icons.shopping_cart, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Cart',
                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                Text(
                  '$cartCount Items',
                  style: const TextStyle(color: Color(0xFFD1FAE5), fontSize: 11),
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
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE11D48)),
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
                'Clear Cart',
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
                      color: Color(0xFFD1FAE5),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.shopping_cart_outlined, size: 40, color: Color(0xFF047857)),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Your Cart is Empty',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Browse the catalog to add items to your order.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Customer Info Card matching reference screenshot
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.person_outline, color: Color(0xFF475569)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Customer',
                                style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold),
                              ),
                              Text(
                                (cust?['name'] ?? 'Customer').toString().toUpperCase(),
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Mobile: ${cust?['phone'] ?? ''} ${cust?['address'] != null ? '| ${cust!['address']}' : ''}',
                                style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Cart Items Table Header matching reference screenshot
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: const BoxDecoration(
                      color: Color(0xFF047857),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
                    ),
                    child: const Row(
                      children: [
                        SizedBox(width: 28, child: Text('S.No.', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold))),
                        Expanded(flex: 4, child: Text('Product', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold))),
                        Expanded(flex: 2, child: Text('Req. Qty.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold))),
                        Expanded(flex: 2, child: Text('Selling Price\n(Incl. GST)', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold))),
                        Expanded(flex: 2, child: Text('Total', textAlign: TextAlign.right, style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold))),
                        SizedBox(width: 30),
                      ],
                    ),
                  ),

                  // Cart Items List
                  Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(bottom: Radius.circular(8)),
                    ),
                    child: Column(
                      children: items.asMap().entries.map((entry) {
                        final idx = entry.key + 1;
                        final item = entry.value as Map<String, dynamic>;
                        final prodId = (item['productId'] ?? item['product_id'] as num).toInt();
                        final name = item['name']?.toString() ?? '';
                        final qty = (item['quantity'] as num).toInt();
                        final unitPrice = ((item['unitPrice'] ?? item['price'] ?? 0) as num).toDouble();
                        final lineTotal = ((item['lineTotal'] ?? item['total'] ?? qty * unitPrice) as num).toDouble();
                        final img = item['imageUrl']?.toString();

                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                          decoration: const BoxDecoration(
                            border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                          ),
                          child: Row(
                            children: [
                              // S.No
                              SizedBox(
                                width: 28,
                                child: Text('$idx', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                              ),

                              // Product details with image thumbnail
                              Expanded(
                                flex: 4,
                                child: Row(
                                  children: [
                                    Container(
                                      width: 36,
                                      height: 36,
                                      margin: const EdgeInsets.only(right: 6),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF8FAFC),
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: const Color(0xFFE2E8F0)),
                                      ),
                                      child: img != null && img.isNotEmpty
                                          ? Image.network(img, fit: BoxFit.contain)
                                          : const Icon(Icons.image, size: 16, color: Color(0xFFCBD5E1)),
                                    ),
                                    Expanded(
                                      child: Text(
                                        name,
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                                        maxLines: 3,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              // Req Qty Stepper
                              Expanded(
                                flex: 2,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: const Color(0xFFCBD5E1)),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      InkWell(
                                        onTap: () => portal.setCartItem(prodId, qty - 1),
                                        child: const Icon(Icons.remove, size: 14, color: Color(0xFF475569)),
                                      ),
                                      Text('$qty', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
                                      InkWell(
                                        onTap: () => portal.setCartItem(prodId, qty + 1),
                                        child: const Icon(Icons.add, size: 14, color: Color(0xFF475569)),
                                      ),
                                    ],
                                  ),
                                ),
                              ),

                              // Unit price
                              Expanded(
                                flex: 2,
                                child: Text(
                                  '₹${unitPrice.toStringAsFixed(2)}',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                                ),
                              ),

                              // Line total (in bold blue matching reference)
                              Expanded(
                                flex: 2,
                                child: Text(
                                  '₹${lineTotal.toStringAsFixed(2)}',
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF2563EB)),
                                ),
                              ),

                              // Red trash icon
                              SizedBox(
                                width: 30,
                                child: IconButton(
                                  icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFFE11D48)),
                                  onPressed: () => portal.setCartItem(prodId, 0),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Terms & Conditions card matching screenshot
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.article_outlined, size: 16, color: Color(0xFF047857)),
                            SizedBox(width: 6),
                            Text('Terms & Conditions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF0F172A))),
                          ],
                        ),
                        SizedBox(height: 8),
                        Text('1. Warranty as per product company rule.', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        SizedBox(height: 3),
                        Text('2. Payment must be cleared within maximum 21 days.', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                        SizedBox(height: 3),
                        Text('3. 5% charges add per week after due date.', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Financial calculations card matching screenshot
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Sub Total', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                                  Text('₹${subtotal.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Discount', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                                  Text('₹${discount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Tax (GST)', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                                  Text('₹${tax.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                ],
                              ),
                            ],
                          ),
                        ),

                        // Grand Total Green Bar matching screenshot
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: const BoxDecoration(
                            color: Color(0xFF047857),
                            borderRadius: BorderRadius.vertical(bottom: Radius.circular(11)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Grand Total', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                              Text('₹${grandTotal.toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // Payment Note (Optional) TextField matching screenshot
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.edit_note, size: 18, color: Color(0xFF047857)),
                            SizedBox(width: 6),
                            Text('Payment / Order Note (Optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _noteCtrl,
                          decoration: InputDecoration(
                            hintText: 'Add payment note...',
                            hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                            filled: true,
                            fillColor: const Color(0xFFF8FAFC),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Place Order CTA Button matching screenshot
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF047857),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: _submitting
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Icon(Icons.receipt, color: Colors.white),
                      label: Text(
                        _submitting ? 'Placing Order...' : 'Create Order >',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      onPressed: _submitting ? null : _handlePlaceOrder,
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }
}

