import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../models/saved_order.dart';
import '../../providers/customer_portal_provider.dart';
import '../../theme/app_theme.dart';
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
      showAppSnackBar(context, 'Your cart is empty. Please add products first.', isError: true);
      return;
    }

    // Check for stock errors
    for (final it in items) {
      if (it['exceedsStock'] == true || it['isUnavailable'] == true) {
        showAppSnackBar(
          context,
          '${it['name']} exceeds available stock. Please adjust quantity.',
          isError: true,
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

      final orderId = parseInt(res['id']);
      final orderNumber = formatOrderNumber(res['order_number']?.toString() ?? orderId);
      final total = parseDouble(res['total_amount']);

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
                  color: AppColors.successBg,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 40),
              ),
              const SizedBox(height: 16),
              const Text(
                'Order Placed Successfully!',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.navy900),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Order #$orderNumber',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.navy900),
              ),
              const SizedBox(height: 6),
              const StatusChip(
                label: 'PENDING CONFIRMATION',
                variant: StatusChipVariant.warning,
              ),
              const SizedBox(height: 12),
              Text(
                'Total: ₹${total.toStringAsFixed(2)}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navy900),
              ),
              const SizedBox(height: 6),
              const Text(
                'The shop has been notified. They will confirm and fulfill your order soon.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.3),
              ),
              const SizedBox(height: 20),
              PrimaryButton(
                label: 'View Order Details',
                onPressed: () {
                  Navigator.pop(ctx);
                  if (orderId > 0) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => PortalOrderDetailScreen(orderId: orderId),
                      ),
                    );
                  } else {
                    portal.switchTab(2);
                    if (Navigator.canPop(context)) {
                      Navigator.pop(context);
                    }
                  }
                },
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  portal.switchTab(1); // Back to Catalog
                  if (Navigator.canPop(context)) {
                    Navigator.pop(context);
                  }
                },
                child: const Text(
                  'Continue Shopping',
                  style: TextStyle(color: AppColors.navy900, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      showAppSnackBar(context, 'Failed to place order: $e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final portal = context.watch<CustomerPortalProvider>();
    final cart = portal.cart;
    final items = (cart?['items'] as List<dynamic>?) ?? [];
    final subtotal = parseDouble(cart?['subtotal'] ?? cart?['estimatedTotal']);
    final taxTotal = parseDouble(cart?['taxTotal'] ?? cart?['tax_total']);
    final grandTotal = parseDouble(cart?['grandTotal'] ?? cart?['estimatedTotal'] ?? (subtotal + taxTotal));
    final cust = portal.customer;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF04261D), Color(0xFF064E3B), Color(0xFF047857)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        elevation: 0,
        leading: Navigator.canPop(context)
            ? IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () => Navigator.pop(context),
              )
            : null,
        title: Text(
          items.isNotEmpty ? 'My Cart (${items.length} items)' : 'My Cart',
          style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
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
                        style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
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
              child: EmptyState(
                icon: Icons.shopping_cart_outlined,
                title: 'Your Cart is Empty',
                subtitle: 'Browse the catalog to add products to your cart.',
                buttonLabel: 'Explore Catalog',
                onButtonPressed: () {
                  portal.switchTab(1);
                  if (Navigator.canPop(context)) {
                    Navigator.pop(context);
                  }
                },
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Customer Delivery Card
                  AppCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.blue50,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.person_pin_rounded, color: AppColors.navy900, size: 20),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    (cust?['name'] ?? 'Customer').toString(),
                                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.navy900),
                                  ),
                                  Text(
                                    'Mobile: +91 ${cust?['phone'] ?? ''}',
                                    style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
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
                            prefixIcon: const Icon(Icons.location_on_outlined, size: 18, color: AppColors.textSecondary),
                            filled: true,
                            fillColor: AppColors.bg,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                            isDense: true,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Cart Items List
                  const SectionHeader(title: 'Selected Products'),
                  const SizedBox(height: 8),

                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, i) {
                      final item = items[i] as Map<String, dynamic>;
                      final prodId = parseInt(item['productId'] ?? item['product_id']);
                      final name = item['name']?.toString() ?? 'Product';
                      final qty = parseInt(item['quantity'], 1);
                      final unitPrice = parseDouble(item['unitPrice'] ?? item['price']);
                      final lineTotal = parseDouble(item['lineTotal'] ?? (qty * unitPrice));
                      final img = item['imageUrl']?.toString();
                      final exceedsStock = item['exceedsStock'] == true;
                      final availableStock = parseInt(item['availableStock']);

                      return AppCard(
                        padding: const EdgeInsets.all(12),
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
                                    color: AppColors.bg,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: img != null && img.isNotEmpty
                                      ? ClipRRect(
                                          borderRadius: BorderRadius.circular(10),
                                          child: Image.network(img, fit: BoxFit.contain),
                                        )
                                      : const Icon(Icons.image_outlined, color: AppColors.textSecondary),
                                ),
                                const SizedBox(width: 12),

                                // Name & Unit Price
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        name,
                                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: AppColors.navy900),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 3),
                                      Row(
                                        children: [
                                          const Text('Unit: ', style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                                          AmountText(amount: unitPrice, fontSize: 11.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                                        ],
                                      ),
                                      if (exceedsStock)
                                        Text(
                                          'Only $availableStock left in stock!',
                                          style: const TextStyle(fontSize: 10.5, color: AppColors.danger, fontWeight: FontWeight.bold),
                                        ),
                                    ],
                                  ),
                                ),

                                // Remove button
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded, size: 20, color: AppColors.danger),
                                  onPressed: () => portal.setCartItem(prodId, 0),
                                  tooltip: 'Remove',
                                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                  padding: EdgeInsets.zero,
                                ),
                              ],
                            ),

                            const Divider(height: 16, color: AppColors.border),

                            // Quantity Stepper and Item Total Row
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                // Stepper
                                Container(
                                  decoration: BoxDecoration(
                                    color: AppColors.bg,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.remove, size: 16, color: AppColors.navy900),
                                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                        padding: EdgeInsets.zero,
                                        onPressed: () {
                                          portal.setCartItem(prodId, qty - 1);
                                        },
                                      ),
                                      Container(
                                        constraints: const BoxConstraints(minWidth: 28),
                                        alignment: Alignment.center,
                                        child: Text(
                                          '$qty',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.navy900),
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.add, size: 16, color: AppColors.navy900),
                                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                        padding: EdgeInsets.zero,
                                        onPressed: () {
                                          portal.setCartItem(prodId, qty + 1);
                                        },
                                      ),
                                    ],
                                  ),
                                ),

                                // Item Total
                                AmountText(
                                  amount: lineTotal,
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.navy900,
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),

                  const SizedBox(height: 18),

                  // Order Summary Card
                  AppCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Payment & Price Details',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.navy900),
                        ),
                        const SizedBox(height: 12),
                        _buildSummaryRow('Items Subtotal', subtotal),
                        if (taxTotal > 0)
                          _buildSummaryRow('Estimated Tax / GST', taxTotal),
                        const Divider(height: 16, color: AppColors.border),
                        _buildSummaryRow(
                          'Grand Total',
                          grandTotal,
                          isBold: true,
                          fontSize: 16,
                          color: AppColors.navy900,
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.blue50,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.info_outline, size: 16, color: AppColors.blue600),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Payment will be recorded to your Ledger balance upon delivery.',
                                  style: TextStyle(fontSize: 11, color: AppColors.navy900),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Order Note Card
                  AppCard(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Order Note / Remarks (Optional)',
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppColors.navy900),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _noteCtrl,
                          decoration: InputDecoration(
                            hintText: 'Any special instructions for the store...',
                            hintStyle: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            filled: true,
                            fillColor: AppColors.bg,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                            isDense: true,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Place Order CTA
                  PrimaryButton(
                    label: 'Place Order',
                    icon: Icons.check_circle_outline,
                    loading: _submitting,
                    onPressed: _submitting ? null : _handlePlaceOrder,
                  ),
                  const SizedBox(height: 28),
                ],
              ),
            ),
    );
  }

  Widget _buildSummaryRow(String label, double amount, {bool isBold = false, Color? color, double fontSize = 13}) {
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
              color: isBold ? AppColors.navy900 : AppColors.textSecondary,
            ),
          ),
          AmountText(
            amount: amount,
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            color: color ?? AppColors.navy900,
          ),
        ],
      ),
    );
  }
}
