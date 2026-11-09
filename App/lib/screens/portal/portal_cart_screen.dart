import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../providers/customer_portal_provider.dart';
import '../../widgets/product_item_icon.dart';
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
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CustomerPortalProvider>().refreshCart();
    });
  }

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

                  // Cart Items List - Clean, Modern Representation (Icon & Name Only)
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
                      final img = item['imageUrl']?.toString();

                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x06000000),
                              blurRadius: 4,
                              offset: Offset(0, 1),
                            ),
                          ],
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // 1. Product Icon (attractive, properly aligned, 48x48)
                            ProductItemIcon(
                              name: name,
                              category: item['category']?.toString() ?? item['brand']?.toString(),
                              sku: item['sku']?.toString(),
                              imageUrl: img,
                              size: 48,
                            ),
                            const SizedBox(width: 14),

                            // 2. Product Name (clear, readable, fully visible)
                            Expanded(
                              child: Text(
                                name.trim(),
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F172A),
                                  height: 1.3,
                                ),
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 12),

                            // 3. Direct Editable Quantity Input [ Qty ] (No +/- buttons)
                            Container(
                              width: 52,
                              height: 36,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFCBD5E1)),
                              ),
                              alignment: Alignment.center,
                              child: TextFormField(
                                key: ValueKey('portal_cart_qty_${prodId}_$qty'),
                                initialValue: '$qty',
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                ),
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                                ),
                                onChanged: (val) {
                                  final trimmed = val.trim();
                                  if (trimmed.isEmpty) return;
                                  final q = int.tryParse(trimmed);
                                  if (q != null && q >= 1) {
                                    portal.setCartItem(prodId, q);
                                  }
                                },
                              ),
                            ),
                            const SizedBox(width: 8),

                            // 4. Remove / Delete Button
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 20, color: Color(0xFFEF4444)),
                              onPressed: () => portal.setCartItem(prodId, 0),
                              tooltip: 'Remove',
                              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                              padding: EdgeInsets.zero,
                            ),
                          ],
                        ),
                      );
                    },
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

