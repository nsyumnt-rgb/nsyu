import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/bill_item.dart';
import '../models/customer.dart';
import '../models/saved_bill.dart';
import '../models/saved_order.dart';
import '../navigation/app_navigation.dart';
import '../providers/orders_provider.dart';
import '../providers/bills_provider.dart';
import '../providers/catalog_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/product_item_icon.dart';
import 'customer_picker_screen.dart';

/// Cart Screen matching Reference Image:
/// - Forest Green (#006837) Header with Cart icon (badge 3), Mode Dropdown (Bill / Order), Clear Cart
/// - Customer Card (Sharma Ji Communication) with Select Customer action
/// - Spreadsheet Table: S.No., Product thumbnail & specs, Req. Qty., Selling Price, Total, Delete
/// - Add Product & Search with in-field barcode trigger
/// - Side-by-side Terms & Conditions & Financial Totals (Sub Total, Discount %/₹ toggle, Tax, Grand Total)
/// - Payment Note (Optional)
/// - Bottom Sticky Action Bar: Save as Draft, Print, Share, Send on WhatsApp, Create Bill >
class OrderCartScreen extends StatefulWidget {
  const OrderCartScreen({super.key});

  @override
  State<OrderCartScreen> createState() => _OrderCartScreenState();
}

class _OrderCartScreenState extends State<OrderCartScreen> {
  final NumberFormat _money = NumberFormat('#,##0.00');
  final TextEditingController _searchCtrl = TextEditingController();
  final TextEditingController _notesCtrl = TextEditingController();
  final TextEditingController _discountValCtrl = TextEditingController(text: '0.00');

  String _documentMode = 'Bill'; // 'Bill' or 'Order'
  bool _isDiscountPercent = false; // true = %, false = ₹
  double _discountValue = 0.0;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
  }

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
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
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
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final query = _searchCtrl.text.toLowerCase().trim();
          final allProducts = provider.products;
          final filtered = query.isEmpty
              ? allProducts
              : allProducts.where((p) => p.desc.toLowerCase().contains(query) || p.code.toLowerCase().contains(query)).toList();

          return Container(
            height: MediaQuery.of(context).size.height * 0.75,
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Add Product to Cart', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                TextField(
                  controller: _searchCtrl,
                  autofocus: true,
                  decoration: const InputDecoration(
                    hintText: 'Search products by name or code...',
                    prefixIcon: Icon(Icons.search),
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  onChanged: (v) => setSheetState(() {}),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (ctx, i) {
                      final p = filtered[i];
                      return ListTile(
                        title: Text(p.desc, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                        subtitle: Text('${p.code} • ${p.spec} • Stock: ${p.stock}'),
                        trailing: Text('₹${_money.format(p.slPrice)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        onTap: () {
                          if (_documentMode == 'Bill') {
                            provider.addToBill(p);
                          } else {
                            provider.addToOrder(p);
                          }
                          Navigator.pop(ctx);
                          showAppSnackBar(context, 'Added ${p.desc} to cart');
                        },
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

  void _editQtyDialog(BuildContext context, BillItem it, bool isOrder, CatalogProvider provider) {
    final ctrl = TextEditingController(text: it.qty.toString());
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Edit Quantity for ${it.code}'),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Required Quantity', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF006837), foregroundColor: Colors.white),
            onPressed: () {
              final q = int.tryParse(ctrl.text.trim());
              if (q != null && q > 0) {
                if (isOrder) {
                  provider.updateOrderItemQty(it.code, q);
                } else {
                  provider.updateItemQty(it.code, q);
                }
              }
              Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _createBillOrOrder(
    BuildContext context,
    CatalogProvider provider,
    double subtotal,
    double discount,
    double grandTotal,
  ) async {
    final items = provider.orderItems.isNotEmpty ? provider.orderItems : provider.billItems;
    if (items.isEmpty) {
      showAppSnackBar(context, 'Cart is empty. Please add products.', isError: true);
      return;
    }

    setState(() => _saving = true);

    try {
      final cust = provider.selectedCustomer;
      if (cust == null) {
        setState(() => _saving = false);
        showAppSnackBar(context, 'Please select a customer first.', isError: true);
        return;
      }
      final custName = cust.name;
      final custPhone = cust.mobile;

      if (_documentMode == 'Order') {
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
          discountAmount: discount,
          taxAmount: 0.0,
          totalAmount: grandTotal,
          status: OrderStatus.pending,
        );

        final ordersProvider = context.read<OrdersProvider>();
        await ordersProvider.addOrder(order);

        if (!mounted || !context.mounted) return;
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

      if (!mounted || !context.mounted) return;
      provider.orderItems.clear();
      provider.billItems.clear();
      provider.clearBill();
      setState(() => _saving = false);
      showAppSnackBar(context, 'Bill #${bill.billNumber} created successfully!');
      AppNavigation.openBillDetails(context, bill: bill);
    } catch (e) {
      if (!mounted || !context.mounted) return;
      setState(() => _saving = false);
      showAppSnackBar(context, 'Failed to create $_documentMode: $e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CatalogProvider>();
    final isOrder = _documentMode == 'Order';
    final items = isOrder
        ? (provider.orderItems.isNotEmpty ? provider.orderItems : provider.billItems)
        : (provider.billItems.isNotEmpty ? provider.billItems : provider.orderItems);

    // Real customer from DB
    final customer = provider.selectedCustomer;
    final customerName = customer?.name.isNotEmpty == true ? customer!.name : 'Select Customer';
    final customerMobile = customer?.mobile.isNotEmpty == true ? customer!.mobile : 'No customer selected';
    final customerAddress = customer?.address.isNotEmpty == true
        ? customer!.address
        : 'Tap "Select Customer" to choose from directory';

    // Financial calculations dynamically from real cart
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
                      const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 24),
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
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                      Text(
                        '${items.length} ${items.length == 1 ? "Item" : "Items"}',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.white70),
                      ),
                    ],
                  ),
                  const Spacer(),

                  // Mode Switcher Popover Menu (Bill ▾ / Order)
                  PopupMenuButton<String>(
                    onSelected: (val) => setState(() => _documentMode = val),
                    color: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    offset: const Offset(0, 36),
                    itemBuilder: (ctx) => [
                      PopupMenuItem(
                        value: 'Bill',
                        child: Row(
                          children: [
                            const Icon(Icons.description_outlined, size: 16, color: Color(0xFF0F172A)),
                            const SizedBox(width: 8),
                            const Text('Bill', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                            const Spacer(),
                            if (_documentMode == 'Bill')
                              const Icon(Icons.check, size: 18, color: Color(0xFF16A34A)),
                          ],
                        ),
                      ),
                      PopupMenuItem(
                        value: 'Order',
                        child: Row(
                          children: [
                            const Icon(Icons.shopping_cart_outlined, size: 16, color: Color(0xFF0F172A)),
                            const SizedBox(width: 8),
                            const Text('Order', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                            const Spacer(),
                            if (_documentMode == 'Order')
                              const Icon(Icons.check, size: 18, color: Color(0xFF16A34A)),
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
                            _documentMode == 'Bill' ? Icons.description_outlined : Icons.shopping_cart_outlined,
                            size: 15,
                            color: const Color(0xFF0F172A),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            _documentMode,
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.keyboard_arrow_down, size: 16, color: Color(0xFF0F172A)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Header Trash Can Icon
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.white, size: 22),
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
            // ── 1. Customer Card matching screenshot ──
            _buildCustomerCard(context, provider, customerName, customerMobile, customerAddress),
            const SizedBox(height: 10),

            // ── 2. Items Spreadsheet Table matching screenshot ──
            _buildSpreadsheetTable(context, provider, items, isOrder),
            const SizedBox(height: 10),

            // ── 3. Add Product & Search Bar matching screenshot ──
            _buildAddProductAndSearchRow(context, provider),
            const SizedBox(height: 14),

            // ── 4. Terms & Conditions (Left) & Financial Summary (Right) side-by-side ──
            _buildTermsAndTotalsSection(subtotal, discountAmount, taxAmount, grandTotal),
            const SizedBox(height: 12),

            // ── 5. Payment Note (Optional) ──
            _buildPaymentNoteCard(),
          ],
        ),
      ),
      bottomSheet: _buildStickyActionFooter(provider, subtotal, discountAmount, grandTotal),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CUSTOMER CARD matching Reference Image
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildCustomerCard(
    BuildContext context,
    CatalogProvider provider,
    String name,
    String mobile,
    String address,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // User Icon inside rounded box
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Icon(Icons.person_outline, color: Color(0xFF64748B), size: 22),
          ),
          const SizedBox(width: 10),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Customer',
                  style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 1),
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Mobile: $mobile  |  $address',
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),

          // Select Customer > Pill Button
          InkWell(
            onTap: () => _selectCustomer(context, provider),
            borderRadius: BorderRadius.circular(8),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Row(
                children: [
                  Text(
                    'Select Customer',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF006837),
                    ),
                  ),
                  SizedBox(width: 2),
                  Icon(Icons.chevron_right, size: 14, color: Color(0xFF006837)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ITEMS CART LIST - Clean, Modern Representation (Icon & Name Only)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildSpreadsheetTable(BuildContext context, CatalogProvider provider, List<BillItem> items, bool isOrder) {
    if (items.isEmpty) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        padding: const EdgeInsets.symmetric(vertical: 36),
        child: const Center(
          child: Column(
            children: [
              Icon(Icons.shopping_cart_outlined, size: 36, color: Color(0xFF94A3B8)),
              SizedBox(height: 8),
              Text('Cart is empty. Tap "+ Add Product" below.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (ctx, i) {
        final it = items[i];

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
                name: it.desc,
                category: it.category,
                sku: it.code,
                size: 48,
              ),
              const SizedBox(width: 14),

              // 2. Product Name (clear, readable, fully visible)
              Expanded(
                child: Text(
                  it.desc.trim(),
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

              // 3. Compact Quantity Stepper [-] [qty] [+]
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    InkWell(
                      onTap: () {
                        if (isOrder) {
                          provider.changeOrderQty(it.code, -1);
                        } else {
                          provider.changeQty(it.code, -1);
                        }
                      },
                      borderRadius: const BorderRadius.horizontal(left: Radius.circular(7)),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        child: Icon(Icons.remove, size: 14, color: Color(0xFF334155)),
                      ),
                    ),
                    InkWell(
                      onTap: () => _editQtyDialog(context, it, isOrder, provider),
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 28),
                        child: Center(
                          child: Text(
                            '${it.qty}',
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: () {
                        if (isOrder) {
                          provider.changeOrderQty(it.code, 1);
                        } else {
                          provider.changeQty(it.code, 1);
                        }
                      },
                      borderRadius: const BorderRadius.horizontal(right: Radius.circular(7)),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        child: Icon(Icons.add, size: 14, color: Color(0xFF334155)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),

              // 4. Delete Trash Button
              IconButton(
                icon: const Icon(Icons.delete_outline, size: 20, color: Color(0xFFEF4444)),
                onPressed: () {
                  if (isOrder) {
                    provider.removeOrderItem(it.code);
                  } else {
                    provider.removeItem(it.code);
                  }
                },
                tooltip: 'Remove',
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                padding: EdgeInsets.zero,
              ),
            ],
          ),
        );
      },
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ADD PRODUCT & SEARCH ROW matching Reference Image
  // ──────────────────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TERMS & CONDITIONS (Left) & TOTALS (Right) Side-by-Side
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildTermsAndTotalsSection(
    double subtotal,
    double discount,
    double tax,
    double grandTotal,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left Card: Terms & Conditions
        Expanded(
          flex: 5,
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.description_outlined, size: 15, color: Color(0xFF0F172A)),
                    SizedBox(width: 5),
                    Text(
                      'Terms & Conditions',
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
                SizedBox(height: 8),
                Text('1. Warranty as per product company rule.', style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B), height: 1.3)),
                SizedBox(height: 3),
                Text('2. Payment must be cleared within maximum 21 days.', style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B), height: 1.3)),
                SizedBox(height: 3),
                Text('3. 5% charges add per week after due date.', style: TextStyle(fontSize: 9.5, color: Color(0xFF64748B), height: 1.3)),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),

        // Right Card: Financial Calculations
        Expanded(
          flex: 5,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            padding: const EdgeInsets.all(10),
            child: Column(
              children: [
                _calcRow('Sub Total', '₹${_money.format(subtotal)}'),
                const SizedBox(height: 6),

                // Discount Row with Toggle (₹ | %)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Text('Discount', style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: Text(
                            _isDiscountPercent ? '%' : '₹',
                            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Input box
                        Container(
                          width: 44,
                          height: 22,
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: TextField(
                            controller: _discountValCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold),
                            decoration: const InputDecoration(border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero),
                            onChanged: (v) {
                              setState(() {
                                _discountValue = double.tryParse(v) ?? 0.0;
                              });
                            },
                          ),
                        ),
                        const SizedBox(width: 4),

                        // Toggle Buttons [ ₹ | % ]
                        Container(
                          height: 22,
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFF006837)),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Row(
                            children: [
                              InkWell(
                                onTap: () => setState(() => _isDiscountPercent = false),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5),
                                  color: !_isDiscountPercent ? const Color(0xFF006837) : Colors.white,
                                  child: Center(
                                    child: Text(
                                      '₹',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: !_isDiscountPercent ? Colors.white : const Color(0xFF006837),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              InkWell(
                                onTap: () => setState(() => _isDiscountPercent = true),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5),
                                  color: _isDiscountPercent ? const Color(0xFF006837) : Colors.white,
                                  child: Center(
                                    child: Text(
                                      '%',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: _isDiscountPercent ? Colors.white : const Color(0xFF006837),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '₹${_money.format(discount)}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 6),

                _calcRow('Tax (GST)', '₹${_money.format(tax)}'),
                const SizedBox(height: 8),

                // Grand Total Green Banner matching screenshot
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF006837),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Grand Total', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
                      Text('₹${_money.format(grandTotal)}', style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Colors.white)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _calcRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
        ),
        Text(value, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
      ],
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. PAYMENT NOTE CARD matching Reference Image
  // ──────────────────────────────────────────────────────────────────────────
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
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
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
              enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Color(0xFFE2E8F0))),
              isDense: true,
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. STICKY BOTTOM ACTION FOOTER matching Reference Image
  // [Save as Draft] [Print] [Share] [Send on WhatsApp] [Create Bill >]
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildStickyActionFooter(
    CatalogProvider provider,
    double subtotal,
    double discount,
    double grandTotal,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Save as Draft
            _buildFooterIconBtn(Icons.save_outlined, 'Save as Draft', () {
              showAppSnackBar(context, 'Cart saved as draft');
            }),

            // Print
            _buildFooterIconBtn(Icons.print_outlined, 'Print', () {
              showAppSnackBar(context, 'Opening print layout...');
            }),

            // Share
            _buildFooterIconBtn(Icons.share_outlined, 'Share', () {
              Share.share('Cart Summary: Grand Total ₹${_money.format(grandTotal)}');
            }),

            // Send on WhatsApp Button (Mint pill)
            InkWell(
              onTap: () {
                final phone = provider.selectedCustomer?.mobile ?? '';
                if (phone.isEmpty) {
                  showAppSnackBar(context, 'Please select a customer with a valid mobile number');
                  return;
                }
                final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
                launchUrl(
                  Uri.parse('https://wa.me/$digits?text=Hello,%20your%20bill%20total%20is%20%E2%82%B9${_money.format(grandTotal)}'),
                  mode: LaunchMode.externalApplication,
                );
              },
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.phone, size: 14, color: Color(0xFF006837)),
                    SizedBox(width: 4),
                    Text(
                      'Send on WhatsApp',
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF006837)),
                    ),
                  ],
                ),
              ),
            ),

            // Create Bill > / Create Order > Button
            ElevatedButton(
              onPressed: _saving ? null : () => _createBillOrOrder(context, provider, subtotal, discount, grandTotal),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006837),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                elevation: 0,
              ),
              child: _saving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Row(
                      children: [
                        const Icon(Icons.description_outlined, size: 15, color: Colors.white),
                        const SizedBox(width: 4),
                        Text(
                          'Create $_documentMode >',
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooterIconBtn(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: const Color(0xFF0F172A)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 9, color: Color(0xFF0F172A), fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
