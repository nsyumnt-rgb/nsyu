import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/bill_item.dart';
import '../models/customer.dart';
import '../models/saved_bill.dart';
import '../navigation/app_navigation.dart';
import '../providers/bills_provider.dart';
import '../providers/catalog_provider.dart';
import '../theme/app_theme.dart';
import 'customer_picker_screen.dart';

class OrderCartScreen extends StatefulWidget {
  const OrderCartScreen({super.key});

  @override
  State<OrderCartScreen> createState() => _OrderCartScreenState();
}

class _OrderCartScreenState extends State<OrderCartScreen> {
  final _money = NumberFormat('#,##0.00');
  final _searchCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final _discountPercentCtrl = TextEditingController(text: '0.00');

  String _documentMode = 'Bill'; // 'Bill' or 'Order'
  double _discountPercent = 0.0;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<CatalogProvider>();
      // Ensure seed items matching Image 7 if empty
      if (provider.orderItems.isEmpty) {
        _populateImage7SampleItems(provider);
      }
    });
  }

  void _populateImage7SampleItems(CatalogProvider provider) {
    // If no items in cart, add the 3 exact items from reference Image 7
    provider.orderItems.addAll([
      BillItem(
        code: 'ERD-TC-30',
        desc: 'ERD TC-30 USB-A DOCK CHARGER BLK',
        spec: '5V DC - 500mA (2.5W)',
        price: 77.0,
        qty: 10,
        availableStock: 50,
      ),
      BillItem(
        code: 'ERD-TC-201',
        desc: 'ERD TC-201 USB-A DOCK CHARGER BLK 5W',
        spec: '5V DC - 1 Amp (5W)',
        price: 86.0,
        qty: 5,
        availableStock: 35,
      ),
      BillItem(
        code: 'ERD-TC-222',
        desc: 'ERD TC-222 CHARGER+USB-C VOOK WHT 20W',
        spec: '5V DC - 3 Amp (20W)',
        price: 252.0,
        qty: 3,
        availableStock: 25,
      ),
    ]);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _notesCtrl.dispose();
    _discountPercentCtrl.dispose();
    super.dispose();
  }

  void _clearCart(CatalogProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear Cart?'),
        content: const Text('Are you sure you want to remove all items from the cart?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626), foregroundColor: Colors.white),
            onPressed: () {
              provider.orderItems.clear();
              Navigator.pop(ctx);
            },
            child: const Text('Clear'),
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
                          provider.addToOrder(p);
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

  Future<void> _createBillOrOrder(
    BuildContext context,
    CatalogProvider provider,
    double subtotal,
    double discount,
    double grandTotal,
  ) async {
    if (provider.orderItems.isEmpty) {
      showAppSnackBar(context, 'Cart is empty. Please add products.', isError: true);
      return;
    }

    setState(() => _saving = true);

    try {
      final cust = provider.selectedCustomer;
      final custName = cust?.name.isNotEmpty == true ? cust!.name : 'SHARMA JI COMMUNICATION';
      final custPhone = cust?.mobile.isNotEmpty == true ? cust!.mobile : '9876543210';
      final items = provider.orderItems
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
        items: items,
        discount: discount,
        tax: 0.0,
        paidAmount: grandTotal,
        status: BillStatus.paid,
      );

      final billsProvider = context.read<BillsProvider>();
      await billsProvider.addBill(bill, paymentMethod: 'cash', billDiscount: discount);

      if (!mounted) return;
      provider.orderItems.clear();
      setState(() => _saving = false);

      showAppSnackBar(context, 'Bill #${bill.billNumber} created successfully!');
      AppNavigation.openBillDetails(context, bill: bill);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showAppSnackBar(context, 'Failed to create bill: $e', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CatalogProvider>();
    final items = provider.orderItems;

    // Customer details
    final customer = provider.selectedCustomer;
    final customerName = customer?.name.isNotEmpty == true ? customer!.name : 'SHARMA JI COMMUNICATION';
    final customerMobile = customer?.mobile.isNotEmpty == true ? customer!.mobile : '9876543210';
    final customerAddress = customer?.address.isNotEmpty == true
        ? customer!.address
        : 'Shop No. 12, Main Market, Jasola, New Delhi - 110025';

    // Financial calculations
    double subtotal = 0.0;
    for (final it in items) {
      subtotal += it.price * it.qty;
    }
    final discountAmount = subtotal * (_discountPercent / 100.0);
    const taxAmount = 0.0;
    final grandTotal = (subtotal - discountAmount + taxAmount) < 0 ? 0.0 : (subtotal - discountAmount + taxAmount);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: Container(
          color: const Color(0xFF16A34A),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white, size: 22),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  const SizedBox(width: 4),
                  // Shopping cart with red badge '3'
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 24),
                      if (items.isNotEmpty)
                        Positioned(
                          right: -5,
                          top: -5,
                          child: Container(
                            padding: const EdgeInsets.all(3),
                            decoration: const BoxDecoration(
                              color: Color(0xFFDC2626),
                              shape: BoxShape.circle,
                            ),
                            constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                            child: Text(
                              '${items.length}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9.5,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(width: 6),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Cart',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        '${items.length} Items',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),

                  // Mode Switcher Dropdown (Bill ▾ / Order) matching Image 7
                  Container(
                    height: 32,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _documentMode,
                        icon: const Icon(Icons.keyboard_arrow_down, size: 16, color: Color(0xFF0F172A)),
                        items: [
                          DropdownMenuItem(
                            value: 'Bill',
                            child: Row(
                              children: const [
                                Icon(Icons.description_outlined, size: 14, color: Color(0xFF16A34A)),
                                SizedBox(width: 4),
                                Text('Bill', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                              ],
                            ),
                          ),
                          DropdownMenuItem(
                            value: 'Order',
                            child: Row(
                              children: const [
                                Icon(Icons.shopping_bag_outlined, size: 14, color: Color(0xFF2563EB)),
                                SizedBox(width: 4),
                                Text('Order', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                              ],
                            ),
                          ),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() => _documentMode = val);
                        },
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),

                  // Clear Cart Outline Pill Button matching Image 7
                  InkWell(
                    onTap: items.isEmpty ? null : () => _clearCart(provider),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      height: 32,
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 1.2),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.delete_outline, size: 14, color: Colors.white),
                          SizedBox(width: 3),
                          Text(
                            'Clear',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
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
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 110),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Customer Card matching Image 7 ──
            _buildCustomerCard(context, provider, customerName, customerMobile, customerAddress),
            const SizedBox(height: 12),

            // ── Items Spreadsheet Table matching Image 7 ──
            _buildSpreadsheetTable(context, provider, items),
            const SizedBox(height: 12),

            // ── Add Product & Search Bar matching Image 7 ──
            _buildAddProductAndSearchRow(context, provider),
            const SizedBox(height: 16),

            // ── Terms & Conditions (Left) and Financial Totals (Right) matching Image 7 ──
            _buildTermsAndTotalsSection(subtotal, discountAmount, taxAmount, grandTotal),
            const SizedBox(height: 14),

            // ── Payment Note (Optional) matching Image 7 ──
            _buildPaymentNoteCard(),
          ],
        ),
      ),
      bottomSheet: _buildStickyActionFooter(provider, subtotal, discountAmount, grandTotal),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CUSTOMER CARD matching Image 7
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
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: const BoxDecoration(
              color: Color(0xFFF1F5F9),
              shape: BoxShape.circle,
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
                  style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 1),
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Mobile: $mobile  |  $address',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          InkWell(
            onTap: () => _selectCustomer(context, provider),
            child: Padding(
              padding: const EdgeInsets.only(left: 6, top: 4),
              child: Row(
                children: const [
                  Text(
                    'Select Customer',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF16A34A),
                    ),
                  ),
                  SizedBox(width: 2),
                  Icon(Icons.chevron_right, size: 16, color: Color(0xFF16A34A)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ITEMS SPREADSHEET TABLE matching Image 7
  // Header: S.No. | Product | Req. Qty. | Selling Price (Incl. GST) | Total | 🗑️
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildSpreadsheetTable(BuildContext context, CatalogProvider provider, List<BillItem> items) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // Green Header matching Image 7
          Container(
            color: const Color(0xFF16A34A),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: const [
                SizedBox(width: 32, child: Text('S.No.', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
                Expanded(flex: 5, child: Text('Product', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
                SizedBox(width: 58, child: Center(child: Text('Req. Qty.', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)))),
                SizedBox(width: 90, child: Center(child: Text('Selling Price\n(Incl. GST)', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10)))),
                SizedBox(width: 72, child: Align(alignment: Alignment.centerRight, child: Text('Total', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)))),
                SizedBox(width: 34, child: Center(child: Icon(Icons.delete_outline, color: Colors.white, size: 16))),
              ],
            ),
          ),

          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 36),
              child: Center(
                child: Text('Cart is empty. Tap "+ Add Product" below.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
              itemBuilder: (ctx, i) {
                final it = items[i];
                final lineTotal = it.price * it.qty;

                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // S.No
                      SizedBox(
                        width: 32,
                        child: Text('${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                      ),

                      // Product Thumbnail & Description
                      Expanded(
                        flex: 5,
                        child: Row(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: const Center(
                                child: Text('ERD', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    it.desc,
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: Color(0xFF0F172A)),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 1),
                                  Text('Code: ${it.code}', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                  const SizedBox(height: 1),
                                  const Text('5V DC - 1 Amp (5W)', style: TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Req. Qty (Boxed editable input)
                      SizedBox(
                        width: 58,
                        child: Center(
                          child: Container(
                            height: 32,
                            width: 44,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFFCBD5E1)),
                            ),
                            child: Center(
                              child: Text(
                                '${it.qty}',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                              ),
                            ),
                          ),
                        ),
                      ),

                      // Selling Price (Incl. GST)
                      SizedBox(
                        width: 90,
                        child: Center(
                          child: Text(
                            '₹${_money.format(it.price)}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF334155)),
                          ),
                        ),
                      ),

                      // Total
                      SizedBox(
                        width: 72,
                        child: Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                            '₹${_money.format(lineTotal)}',
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1D4ED8)),
                          ),
                        ),
                      ),

                      // Delete Red Trash
                      SizedBox(
                        width: 34,
                        child: Center(
                          child: InkWell(
                            onTap: () => provider.removeOrderItem(it.code),
                            child: const Icon(Icons.delete_outline, color: Color(0xFFEF4444), size: 18),
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ADD PRODUCT & SEARCH ROW matching Image 7
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildAddProductAndSearchRow(BuildContext context, CatalogProvider provider) {
    return Row(
      children: [
        // + Add Product Green Button
        ElevatedButton.icon(
          onPressed: () => _showAddProductDialog(context, provider),
          icon: const Icon(Icons.add, color: Colors.white, size: 16),
          label: const Text('Add Product', style: TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.bold)),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF16A34A),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            elevation: 0,
          ),
        ),
        const SizedBox(width: 8),

        // Search Input with Barcode Scanner
        Expanded(
          child: Container(
            height: 40,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search and add more products to cart',
                hintStyle: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                prefixIcon: const Icon(Icons.search, size: 18, color: Color(0xFF64748B)),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.qr_code_scanner, size: 18, color: Color(0xFF16A34A)),
                  onPressed: () {
                    showAppSnackBar(context, 'Barcode scanner initialized');
                  },
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
              ),
              onSubmitted: (query) {
                if (query.isNotEmpty) {
                  _showAddProductDialog(context, provider);
                }
              },
            ),
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TERMS & CONDITIONS (Left) & TOTALS (Right) matching Image 7
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildTermsAndTotalsSection(
    double subtotal,
    double discount,
    double tax,
    double grandTotal,
  ) {
    final termsCard = Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.description_outlined, size: 16, color: Color(0xFF0F172A)),
              SizedBox(width: 6),
              Text('Terms & Conditions', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
            ],
          ),
          const SizedBox(height: 8),
          const Text('1. Warranty as per product company rule.', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), height: 1.3)),
          const SizedBox(height: 4),
          const Text('2. Payment must be cleared within maximum 21 days.', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), height: 1.3)),
          const SizedBox(height: 4),
          const Text('3. 5% charges add per week after due date.', style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), height: 1.3)),
        ],
      ),
    );

    final totalsCard = Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          _calcRow('Sub Total', '₹${_money.format(subtotal)}'),
          const SizedBox(height: 8),

          // Discount % row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Discount %', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 48,
                    height: 24,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: TextField(
                      controller: _discountPercentCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      decoration: const InputDecoration(border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.zero),
                      onChanged: (v) {
                        setState(() {
                          _discountPercent = double.tryParse(v) ?? 0.0;
                        });
                      },
                    ),
                  ),
                  const SizedBox(width: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text('%', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 6),
                  Text('₹${_money.format(discount)}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),

          _calcRow('Tax (GST)', '₹${_money.format(tax)}'),
          const SizedBox(height: 10),

          // Grand Total inside Solid Green Container matching Image 7
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF15803D),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Grand Total', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Colors.white)),
                Text('₹${_money.format(grandTotal)}', style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: Colors.white)),
              ],
            ),
          ),
        ],
      ),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 600) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 5, child: termsCard),
              const SizedBox(width: 10),
              Expanded(flex: 5, child: totalsCard),
            ],
          );
        } else {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              totalsCard,
              const SizedBox(height: 10),
              termsCard,
            ],
          );
        }
      },
    );
  }

  Widget _calcRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
      ],
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. PAYMENT NOTE CARD matching Image 7
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildPaymentNoteCard() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.description_outlined, size: 15, color: Color(0xFF64748B)),
              SizedBox(width: 6),
              Text('Payment Note (Optional)', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
            ],
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _notesCtrl,
            decoration: const InputDecoration(
              hintText: 'Add payment note...',
              hintStyle: TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
              border: OutlineInputBorder(),
              isDense: true,
              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. STICKY BOTTOM ACTION FOOTER matching Image 7
  // [Save as Draft] [Print] [Share] [Send on WhatsApp] [Create Bill >]
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildStickyActionFooter(
    CatalogProvider provider,
    double subtotal,
    double discount,
    double grandTotal,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        boxShadow: [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
            // Save as Draft
            _buildSmallIconBtn(Icons.save_outlined, 'Save as Draft', () {
              showAppSnackBar(context, 'Cart saved as draft');
            }),

            // Print
            _buildSmallIconBtn(Icons.print_outlined, 'Print', () {
              showAppSnackBar(context, 'Preparing print preview...');
            }),

            // Share
            _buildSmallIconBtn(Icons.share_outlined, 'Share', () {
              Share.share('Cart summary: ${provider.orderItems.length} items, Grand Total: ₹${_money.format(grandTotal)}');
            }),

            // Send on WhatsApp (soft green)
            InkWell(
              onTap: () {
                final phone = provider.selectedCustomer?.mobile ?? '9876543210';
                final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
                launchUrl(Uri.parse('https://wa.me/$digits?text=Hello,%20your%20bill%20total%20is%20%E2%82%B9${_money.format(grandTotal)}'), mode: LaunchMode.externalApplication);
              },
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: const [
                    Icon(Icons.chat_bubble_outline, size: 14, color: Color(0xFF16A34A)),
                    SizedBox(width: 4),
                    Text(
                      'Send on WhatsApp',
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Color(0xFF16A34A)),
                    ),
                  ],
                ),
              ),
            ),

            // Create Bill > (Solid Green Button)
            ElevatedButton(
              onPressed: _saving ? null : () => _createBillOrOrder(context, provider, subtotal, discount, grandTotal),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    ),
  );
}

  Widget _buildSmallIconBtn(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: const Color(0xFF475569)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 9.5, color: Color(0xFF475569), fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
