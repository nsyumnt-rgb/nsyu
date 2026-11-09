import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../models/customer.dart';
import '../../../models/saved_bill.dart';
import '../../../models/saved_order.dart';
import '../../../navigation/app_navigation.dart';
import '../../../providers/bills_provider.dart';
import '../../../providers/catalog_provider.dart';
import '../../../providers/orders_provider.dart';
import '../../../theme/app_theme.dart';
import '../../../screens/customer_picker_screen.dart';
import '../widgets/cart_customer_card.dart';
import '../widgets/cart_financial_summary.dart';
import '../widgets/cart_item_card.dart';
import '../widgets/cart_sticky_footer.dart';

class OrderCartScreen extends StatefulWidget {
  const OrderCartScreen({super.key});

  @override
  State<OrderCartScreen> createState() => _OrderCartScreenState();
}

class _OrderCartScreenState extends State<OrderCartScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _notesCtrl = TextEditingController();
  final TextEditingController _discountValCtrl = TextEditingController(text: '0.00');

  String _documentMode = 'Bill'; // 'Bill' or 'Order'
  bool _isDiscountPercent = false; // true = %, false = ₹
  double _discountValue = 0.0;
  bool _saving = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    _notesCtrl.dispose();
    _discountValCtrl.dispose();
    super.dispose();
  }

  void _clearCart(CatalogProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Clear Cart?'),
        content: const Text('Are you sure you want to remove all items from the cart?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              provider.orderItems.clear();
              provider.clearBill();
              Navigator.pop(ctx);
            },
            child: const Text('Clear Cart'),
          ),
        ],
      ),
    );
  }

  Future<void> _selectCustomer(BuildContext context, CatalogProvider provider) async {
    final picked = await Navigator.of(context).push<Customer>(
      MaterialPageRoute(builder: (_) => const CustomerPickerScreen()),
    );
    if (picked != null) {
      provider.selectCustomer(picked);
    }
  }

  void _showAddProductDialog(BuildContext context, CatalogProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final query = _searchCtrl.text.toLowerCase().trim();
          final allProducts = provider.products;
          final filtered = query.isEmpty
              ? allProducts
              : allProducts
                  .where((p) =>
                      p.desc.toLowerCase().contains(query) ||
                      p.code.toLowerCase().contains(query) ||
                      p.category.toLowerCase().contains(query))
                  .toList();

          return Container(
            height: MediaQuery.of(context).size.height * 0.75,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Add Product to Cart',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _searchCtrl,
                  autofocus: true,
                  decoration: InputDecoration(
                    hintText: 'Search product...',
                    prefixIcon: const Icon(Icons.search),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  onChanged: (_) => setSheetState(() {}),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: filtered.isEmpty
                      ? const Center(child: Text('No products found'))
                      : ListView.separated(
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (c, idx) {
                            final p = filtered[idx];
                            final isAdded = provider.isItemInCart(p.code);
                            return ListTile(
                              title: Text(
                                p.desc,
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              subtitle: Text('${p.code} • In Stock: ${p.stock}'),
                              trailing: isAdded
                                  ? const Icon(Icons.check_circle, color: Color(0xFF16A34A))
                                  : ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF006837),
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(horizontal: 12),
                                      ),
                                      onPressed: () {
                                        provider.addToOrder(p, qty: 1);
                                        setSheetState(() {});
                                      },
                                      child: const Text('Add'),
                                    ),
                            );
                          },
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _createBillOrOrder(
    CatalogProvider provider,
    double subtotal,
    double discount,
    double grandTotal,
  ) async {
    final isOrder = _documentMode == 'Order';
    final items = isOrder
        ? (provider.orderItems.isNotEmpty ? provider.orderItems : provider.billItems)
        : (provider.billItems.isNotEmpty ? provider.billItems : provider.orderItems);

    if (items.isEmpty) {
      showAppSnackBar(context, 'Cart is empty. Add products first.', isError: true);
      return;
    }

    final cust = provider.selectedCustomer;
    final custName = cust != null && cust.name.isNotEmpty ? cust.name : 'Walk-in Customer';
    final custPhone = cust?.mobile ?? '';

    setState(() => _saving = true);

    try {
      if (isOrder) {
        final orderItemsList = items
            .map((e) => SavedOrderItem(
                  sku: e.code,
                  desc: e.desc,
                  qty: e.qty,
                  price: e.price,
                ))
            .toList();

        final order = SavedOrder(
          id: DateTime.now().millisecondsSinceEpoch,
          orderNumber: 'ORD-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
          customerName: custName,
          customerPhone: custPhone,
          date: DateTime.now(),
          items: orderItemsList,
          subtotal: subtotal,
          discountAmount: discount,
          taxAmount: 0.0,
          totalAmount: grandTotal,
          status: OrderStatus.pending,
        );

        final ordersProvider = context.read<OrdersProvider>();
        await ordersProvider.addOrder(order);

        if (!mounted) return;
        provider.orderItems.clear();
        provider.billItems.clear();
        setState(() => _saving = false);
        showAppSnackBar(context, 'Order #${order.orderNumber} created successfully!');
        AppNavigation.openOrderDetails(context, order: order);
        return;
      }

      final billItemsList = items
          .map((e) => SavedBillItem(
                sku: e.code,
                desc: e.desc,
                qty: e.qty,
                price: e.price,
              ))
          .toList();

      final bill = SavedBill(
        id: DateTime.now().millisecondsSinceEpoch,
        billNumber: 'B-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
        customerName: custName,
        customerPhone: custPhone,
        date: DateTime.now(),
        items: billItemsList,
        discount: discount,
        tax: 0.0,
        paidAmount: grandTotal,
        status: BillStatus.paid,
      );

      final billsProvider = context.read<BillsProvider>();
      await billsProvider.addBill(bill, paymentMethod: 'cash', billDiscount: discount);

      if (!mounted) return;
      provider.orderItems.clear();
      provider.billItems.clear();
      provider.clearBill();
      setState(() => _saving = false);
      showAppSnackBar(context, 'Bill #${bill.billNumber} created successfully!');
      AppNavigation.openBillDetails(context, bill: bill);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showAppSnackBar(context, 'Failed to create $_documentMode: $e', isError: true);
    }
  }

  Widget _buildPaymentNoteCard() {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.description_outlined, size: 14, color: Color(0xFF0F172A)),
              SizedBox(width: 5),
              Text(
                'Payment Note (Optional)',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _notesCtrl,
            style: const TextStyle(fontSize: 11.5),
            decoration: const InputDecoration(
              hintText: 'Add payment note...',
              hintStyle: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
              border: OutlineInputBorder(borderSide: BorderSide(color: Color(0xFFE2E8F0))),
              enabledBorder:
                  OutlineInputBorder(borderSide: BorderSide(color: Color(0xFFE2E8F0))),
              isDense: true,
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAddProductAndSearchRow(BuildContext context, CatalogProvider provider) {
    return Row(
      children: [
        // + Add Product Button
        InkWell(
          onTap: () => _showAddProductDialog(context, provider),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            height: 38,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: const Row(
              children: [
                Icon(Icons.add_circle, color: Color(0xFF006837), size: 22),
                SizedBox(width: 6),
                Text(
                  'Add Product',
                  style: TextStyle(
                    color: Color(0xFF006837),
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),

        // Search Input with Barcode Scanner
        Expanded(
          child: Container(
            height: 38,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Icon(Icons.search, size: 18, color: Color(0xFF64748B)),
                ),
                Expanded(
                  child: TextField(
                    controller: _searchCtrl,
                    decoration: const InputDecoration(
                      hintText: 'Search and add more products to cart',
                      hintStyle: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(vertical: 8),
                    ),
                    onSubmitted: (query) {
                      if (query.isNotEmpty) {
                        _showAddProductDialog(context, provider);
                      }
                    },
                  ),
                ),
                InkWell(
                  onTap: () => _showAddProductDialog(context, provider),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: Icon(Icons.qr_code_scanner, size: 18, color: Color(0xFF006837)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CatalogProvider>();
    final isOrder = _documentMode == 'Order';
    final items = isOrder
        ? (provider.orderItems.isNotEmpty ? provider.orderItems : provider.billItems)
        : (provider.billItems.isNotEmpty ? provider.billItems : provider.orderItems);

    final customer = provider.selectedCustomer;
    final customerName =
        customer?.name.isNotEmpty == true ? customer!.name : 'Select Customer';
    final customerMobile = customer?.mobile.isNotEmpty == true
        ? customer!.mobile
        : 'No customer selected';
    final customerAddress = customer?.address.isNotEmpty == true
        ? customer!.address
        : 'Tap "Select Customer" to choose from directory';

    double subtotal = 0.0;
    for (final it in items) {
      subtotal += it.price * it.qty;
    }

    final discountAmount = _isDiscountPercent
        ? subtotal * (_discountValue / 100.0)
        : _discountValue;

    const taxAmount = 0.0;
    final grandTotal = (subtotal - discountAmount + taxAmount) < 0
        ? 0.0
        : (subtotal - discountAmount + taxAmount);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(66),
        child: Container(
          color: const Color(0xFF006837),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white, size: 24),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                    onPressed: () => Navigator.of(context).pop(),
                  ),

                  // Shopping cart with dynamic count badge
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Icon(Icons.shopping_cart_outlined,
                          color: Colors.white, size: 24),
                      if (items.isNotEmpty)
                        Positioned(
                          right: -3,
                          top: -3,
                          child: Container(
                            width: 17,
                            height: 17,
                            decoration: const BoxDecoration(
                              color: Color(0xFFEF4444),
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                '${items.length}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 8),

                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Cart',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        '${items.length} ${items.length == 1 ? "Item" : "Items"}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),

                  // Mode Switcher Popover Menu (Bill ▾ / Order)
                  PopupMenuButton<String>(
                    onSelected: (val) => setState(() => _documentMode = val),
                    color: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    offset: const Offset(0, 36),
                    itemBuilder: (ctx) => [
                      PopupMenuItem(
                        value: 'Bill',
                        child: Row(
                          children: [
                            const Icon(Icons.description_outlined,
                                size: 16, color: Color(0xFF0F172A)),
                            const SizedBox(width: 8),
                            const Text(
                              'Bill',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const Spacer(),
                            if (_documentMode == 'Bill')
                              const Icon(Icons.check,
                                  size: 18, color: Color(0xFF16A34A)),
                          ],
                        ),
                      ),
                      PopupMenuItem(
                        value: 'Order',
                        child: Row(
                          children: [
                            const Icon(Icons.shopping_cart_outlined,
                                size: 16, color: Color(0xFF0F172A)),
                            const SizedBox(width: 8),
                            const Text(
                              'Order',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const Spacer(),
                            if (_documentMode == 'Order')
                              const Icon(Icons.check,
                                  size: 18, color: Color(0xFF16A34A)),
                          ],
                        ),
                      ),
                    ],
                    child: Container(
                      height: 32,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _documentMode == 'Bill'
                                ? Icons.description_outlined
                                : Icons.shopping_cart_outlined,
                            size: 15,
                            color: const Color(0xFF0F172A),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _documentMode,
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.keyboard_arrow_down,
                              size: 16, color: Color(0xFF0F172A)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Header Trash Can Icon
                  IconButton(
                    icon: const Icon(Icons.delete_outline,
                        color: Colors.white, size: 22),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                    onPressed: () => _clearCart(provider),
                  ),
                  const SizedBox(width: 2),

                  // Clear Cart Outline Pill Button
                  InkWell(
                    onTap: () => _clearCart(provider),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      height: 30,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white, width: 1.2),
                      ),
                      child: const Center(
                        child: Text(
                          'Clear Cart',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 110),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Customer Card
            CartCustomerCard(
              customerName: customerName,
              customerMobile: customerMobile,
              customerAddress: customerAddress,
              onSelectCustomer: () => _selectCustomer(context, provider),
            ),
            const SizedBox(height: 10),

            // 2. Items Cart List
            if (items.isEmpty)
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                padding: const EdgeInsets.symmetric(vertical: 36),
                child: const Center(
                  child: Column(
                    children: [
                      Icon(Icons.shopping_cart_outlined,
                          size: 36, color: Color(0xFF94A3B8)),
                      SizedBox(height: 8),
                      Text(
                        'Cart is empty. Tap "+ Add Product" below.',
                        style: TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (ctx, i) {
                  final it = items[i];
                  return CartItemCard(
                    key: ValueKey(it.code),
                    item: it,
                    isOrder: isOrder,
                    provider: provider,
                  );
                },
              ),
            const SizedBox(height: 10),

            // 3. Add Product & Search Bar
            _buildAddProductAndSearchRow(context, provider),
            const SizedBox(height: 14),

            // 4. Terms & Conditions & Financial Summary
            CartFinancialSummary(
              subtotal: subtotal,
              discountAmount: discountAmount,
              taxAmount: taxAmount,
              grandTotal: grandTotal,
              isDiscountPercent: _isDiscountPercent,
              discountValCtrl: _discountValCtrl,
              onToggleDiscountType: (isPct) =>
                  setState(() => _isDiscountPercent = isPct),
              onDiscountChanged: (v) {
                setState(() {
                  _discountValue = double.tryParse(v) ?? 0.0;
                });
              },
            ),
            const SizedBox(height: 12),

            // 5. Payment Note (Optional)
            _buildPaymentNoteCard(),
          ],
        ),
      ),
      bottomSheet: CartStickyFooter(
        provider: provider,
        documentMode: _documentMode,
        subtotal: subtotal,
        discount: discountAmount,
        grandTotal: grandTotal,
        saving: _saving,
        onCreateBillOrOrder: () => _createBillOrOrder(
          provider,
          subtotal,
          discountAmount,
          grandTotal,
        ),
      ),
    );
  }
}
