import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/bill_item.dart';
import '../models/customer.dart';
import '../models/product.dart';
import '../models/saved_order.dart';
import '../providers/catalog_provider.dart';
import '../providers/orders_provider.dart';
import '../theme/app_theme.dart';
import '../providers/customer_provider.dart';
import '../widgets/editable_qty_input.dart';
import '../navigation/app_navigation.dart';
import 'bill_screen.dart';
import 'customer_picker_screen.dart';

class OrderCartScreen extends StatefulWidget {
  const OrderCartScreen({super.key});

  @override
  State<OrderCartScreen> createState() => _OrderCartScreenState();
}

class _OrderCartScreenState extends State<OrderCartScreen> {
  final _money = NumberFormat('#,##0.00');
  final _dateFormat = DateFormat('dd MMM yyyy');
  final _searchCtrl = TextEditingController();
  final _remarksCtrl =
      TextEditingController(text: 'Customer requested delivery by 31 Oct 2026.');

  DateTime _orderDate = DateTime(2026, 10, 28);
  DateTime _deliveryDate = DateTime(2026, 10, 31);
  String _orderStatus = 'Pending';
  double _orderDiscount = 500.0;
  bool _saving = false;

  final Map<String, int> _itemDiscounts = {}; // code -> discount percent

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<CatalogProvider>();
      // Pre-seed with reference demo products if order cart is empty
      if (provider.orderItems.isEmpty) {
        provider.orderItems.addAll([
          BillItem(
            code: 'CEM-50KG',
            desc: 'Cement (50 Kg)',
            spec: '',
            price: 350.00,
            qty: 10,
            availableStock: 100,
          ),
          BillItem(
            code: 'SR-12MM',
            desc: 'Steel Rod (12mm)',
            spec: '',
            price: 650.00,
            qty: 5,
            availableStock: 50,
          ),
          BillItem(
            code: 'SAND-UNIT',
            desc: 'Sand (Per Unit)',
            spec: '',
            price: 450.00,
            qty: 3,
            availableStock: 200,
          ),
          BillItem(
            code: 'BRICKS-1000',
            desc: 'Bricks (Per 1000)',
            spec: '',
            price: 5000.00,
            qty: 1,
            availableStock: 20,
          ),
        ]);
        if (provider.orderCustomerName.isEmpty) {
          provider.setOrderCustomerName('Mohd Nazim');
        }
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  String _initials(String name) => name.trim().isEmpty
      ? '?'
      : name
          .trim()
          .split(RegExp(r'\s+'))
          .take(2)
          .map((s) => s[0])
          .join()
          .toUpperCase();

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<CatalogProvider>();
    final customer = provider.selectedCustomer;
    final name = customer?.name ??
        (provider.orderCustomerName.isNotEmpty
            ? provider.orderCustomerName
            : 'Mohd Nazim');
    final phone = customer?.mobile ?? '+91 98765 43210';
    final custId = customer != null && customer.id.isNotEmpty
        ? (customer.id.startsWith('CUST')
            ? customer.id
            : 'CUST-${customer.id.padLeft(4, '0')}')
        : 'CUST-0001';
    final address = customer != null && customer.address.isNotEmpty
        ? customer.address
        : 'Near Main Market, Lucknow';
    final outstanding =
        customer?.currentBalance ?? provider.previousOutstanding;

    // Financial calculations
    double subtotal = 0.0;
    double totalItemDiscounts = 0.0;
    for (final item in provider.orderItems) {
      final lineBase = item.price * item.qty;
      final discPercent = _itemDiscounts[item.code] ?? 0;
      final lineDisc = lineBase * (discPercent / 100.0);
      subtotal += lineBase;
      totalItemDiscounts += lineDisc;
    }

    final totalDiscount = totalItemDiscounts + _orderDiscount;
    final taxable = (subtotal - totalDiscount) < 0 ? 0.0 : (subtotal - totalDiscount);
    final tax18 = taxable * 0.18;
    final finalOrderTotal = taxable + tax18;

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D4ED8),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Create Order',
          style: TextStyle(
              color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18),
        ),
        actions: [
          IconButton(
            tooltip: 'Preview Order',
            icon: const Icon(Icons.description_outlined, color: Colors.white),
            onPressed: provider.orderItems.isEmpty
                ? null
                : () => _previewOrder(context, provider, subtotal, totalDiscount,
                    tax18, finalOrderTotal),
          ),
          IconButton(
            tooltip: 'Save Order',
            icon: const Icon(Icons.save_outlined, color: Colors.white),
            onPressed: provider.orderItems.isEmpty || _saving
                ? null
                : () => _saveOrder(context, provider, subtotal, totalDiscount,
                    tax18, finalOrderTotal),
          ),
          IconButton(
            icon: const Icon(Icons.more_vert, color: Colors.white),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 100),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Customer Card ──
            _buildCustomerCard(context, provider, customer, name, custId, phone,
                address, outstanding),
            const SizedBox(height: 12),

            // ── Add Product Section ──
            _buildAddProductSection(context, provider),
            const SizedBox(height: 12),

            // ── Order Items Table ──
            _buildOrderTable(context, provider),
            const SizedBox(height: 12),

            // ── Totals & Delivery Details (Two Column Card) ──
            _buildTotalsAndDeliveryCard(
                context, subtotal, totalDiscount, tax18, finalOrderTotal),
            const SizedBox(height: 12),

            // ── Remarks Card ──
            _buildRemarksCard(),
          ],
        ),
      ),
      bottomSheet: _buildBottomActionBar(
          context, provider, subtotal, totalDiscount, tax18, finalOrderTotal),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. CUSTOMER CARD
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildCustomerCard(
    BuildContext context,
    CatalogProvider provider,
    Customer? customer,
    String name,
    String custId,
    String phone,
    String address,
    double outstanding,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: const Color(0xFFDBEAFE),
            child: Text(
              _initials(name),
              style: const TextStyle(
                color: Color(0xFF1D4ED8),
                fontWeight: FontWeight.w800,
                fontSize: 16,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  custId,
                  style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF64748B),
                      fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    const Icon(Icons.phone, size: 13, color: Color(0xFF64748B)),
                    const SizedBox(width: 4),
                    Text(phone,
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF475569))),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.location_on,
                        size: 13, color: Color(0xFF64748B)),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        address,
                        style: const TextStyle(
                            fontSize: 11.5, color: Color(0xFF64748B)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (customer != null)
                    Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: InkWell(
                        onTap: () => _openInlineEditCustomer(context, provider, customer),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            border: Border.all(color: const Color(0xFF1D4ED8), width: 1.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.edit_outlined, size: 15, color: Color(0xFF1D4ED8)),
                        ),
                      ),
                    ),
                  OutlinedButton(
                    onPressed: () => _editCustomer(context, provider),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF1D4ED8),
                      side:
                          const BorderSide(color: Color(0xFF1D4ED8), width: 1.2),
                      padding:
                          const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      visualDensity: VisualDensity.compact,
                    ),
                    child: const Text('Change Customer',
                        style: TextStyle(
                            fontSize: 11.5, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFDCFCE7)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'Outstanding',
                      style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF15803D),
                          fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '₹${_money.format(outstanding > 0 ? outstanding : 5000.00)}',
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFDC2626)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ADD PRODUCT SECTION
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildAddProductSection(
      BuildContext context, CatalogProvider provider) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.inventory_2, color: Color(0xFF1D4ED8), size: 20),
              SizedBox(width: 8),
              Text(
                'Add Product',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (q) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Search by product name, code or scan barcode',
                hintStyle:
                    const TextStyle(fontSize: 12.5, color: Color(0xFF94A3B8)),
                prefixIcon:
                    const Icon(Icons.search, size: 20, color: Color(0xFF64748B)),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.qr_code_scanner,
                      color: Color(0xFF1D4ED8)),
                  onPressed: () => _showScanBarcodeDialog(context, provider),
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showScanBarcodeDialog(context, provider),
                  icon: const Icon(Icons.qr_code_scanner,
                      size: 16, color: Color(0xFF1D4ED8)),
                  label: const Text('Scan Barcode',
                      style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1D4ED8))),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(
                        color: Color(0xFF1D4ED8), width: 1.2),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () =>
                      _showAddNewProductDialog(context, provider),
                  icon: const Icon(Icons.add,
                      size: 16, color: Color(0xFF1D4ED8)),
                  label: const Text('+ Add New Product',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1D4ED8))),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(
                        color: Color(0xFF1D4ED8), width: 1.2),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () =>
                      _showViewProductsSheet(context, provider),
                  icon: const Icon(Icons.list_alt,
                      size: 16, color: Color(0xFF1D4ED8)),
                  label: const Text('View Products',
                      style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1D4ED8))),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(
                        color: Color(0xFF1D4ED8), width: 1.2),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. ORDER ITEMS TABLE
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildOrderTable(BuildContext context, CatalogProvider provider) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: 600,
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(15)),
                      border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                    ),
                    child: Row(
                      children: const [
                        SizedBox(width: 24, child: Text('#', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Color(0xFF475569)))),
                        SizedBox(width: 135, child: Text('Product', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Color(0xFF475569)))),
                        SizedBox(width: 45, child: Center(child: Text('Stock', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Color(0xFF475569))))),
                        SizedBox(width: 90, child: Center(child: Text('Qty', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Color(0xFF475569))))),
                        SizedBox(width: 75, child: Align(alignment: Alignment.centerRight, child: Text('Rate (₹)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Color(0xFF475569))))),
                        SizedBox(width: 65, child: Center(child: Text('Discount', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Color(0xFF475569))))),
                        SizedBox(width: 90, child: Align(alignment: Alignment.centerRight, child: Text('Amount (₹)', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Color(0xFF475569))))),
                        SizedBox(width: 36, child: Center(child: Text('Action', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: Color(0xFF475569))))),
                      ],
                    ),
                  ),
                  if (provider.orderItems.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 36, horizontal: 20),
                      child: Column(
                        children: [
                          Icon(Icons.shopping_bag_outlined, size: 36, color: Color(0xFFCBD5E1)),
                          SizedBox(height: 8),
                          Text('No products added to order yet', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                          SizedBox(height: 4),
                          Text('Use "+ Add Row" or product search above to add items', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11.5)),
                        ],
                      ),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: provider.orderItems.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                      itemBuilder: (context, i) {
                        final item = provider.orderItems[i];
                        final discPercent = _itemDiscounts[item.code] ?? 0;
                        final lineBase = item.price * item.qty;
                        final lineTotal = lineBase * (1 - discPercent / 100);

                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          child: Row(
                            children: [
                              SizedBox(width: 24, child: Text('${i + 1}', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600))),
                              SizedBox(
                                width: 135,
                                child: InkWell(
                                  onTap: () => AppNavigation.openProductDetails(context, productCode: item.code),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(item.desc, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF0D9488)), maxLines: 2, overflow: TextOverflow.ellipsis),
                                      Text(item.code, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                    ],
                                  ),
                                ),
                              ),
                              // Stock in vibrant green
                              SizedBox(
                                width: 45,
                                child: Center(
                                  child: Text(
                                    '${item.availableStock > 0 ? item.availableStock : 100}',
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF16A34A)),
                                  ),
                                ),
                              ),
                              // Editable Qty [-] [qty input] [+]
                              SizedBox(
                                width: 90,
                                child: Center(
                                  child: EditableQtyInput(
                                    key: ValueKey('order_qty_${item.code}'),
                                    qty: item.qty,
                                    availableStock: item.availableStock,
                                    onQtyChanged: (newQty) {
                                      provider.updateOrderItemQty(item.code, newQty);
                                    },
                                    onIncrement: () {
                                      provider.changeOrderQty(item.code, 1);
                                    },
                                    onDecrement: () {
                                      provider.changeOrderQty(item.code, -1);
                                    },
                                  ),
                                ),
                              ),
                              // Rate (₹)
                              SizedBox(
                                width: 75,
                                child: Align(
                                  alignment: Alignment.centerRight,
                                  child: Text(_money.format(item.price), style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                                ),
                              ),
                              // Discount dropdown
                              SizedBox(
                                width: 65,
                                child: Center(
                                  child: Container(
                                    height: 28,
                                    padding: const EdgeInsets.symmetric(horizontal: 4),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(color: const Color(0xFFCBD5E1)),
                                    ),
                                    child: DropdownButtonHideUnderline(
                                      child: DropdownButton<int>(
                                        value: discPercent,
                                        isDense: true,
                                        icon: const Icon(Icons.arrow_drop_down, size: 14),
                                        items: const [
                                          DropdownMenuItem(value: 0, child: Text('0%', style: TextStyle(fontSize: 11))),
                                          DropdownMenuItem(value: 5, child: Text('5%', style: TextStyle(fontSize: 11))),
                                          DropdownMenuItem(value: 10, child: Text('10%', style: TextStyle(fontSize: 11))),
                                          DropdownMenuItem(value: 15, child: Text('15%', style: TextStyle(fontSize: 11))),
                                          DropdownMenuItem(value: 20, child: Text('20%', style: TextStyle(fontSize: 11))),
                                        ],
                                        onChanged: (val) {
                                          if (val != null) {
                                            setState(() => _itemDiscounts[item.code] = val);
                                          }
                                        },
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              // Amount (₹)
                              SizedBox(
                                width: 90,
                                child: Align(
                                  alignment: Alignment.centerRight,
                                  child: Text(_money.format(lineTotal), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                                ),
                              ),
                              // Action delete
                              SizedBox(
                                width: 36,
                                child: Center(
                                  child: IconButton(
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(),
                                    icon: const Icon(Icons.delete_outline, color: Color(0xFFEF4444), size: 18),
                                    onPressed: () => provider.removeOrderItem(item.code),
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
            ),
          ),

          // Under-table Buttons: [+ Add Row] [Clear All]
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                OutlinedButton.icon(
                  onPressed: () => _showViewProductsSheet(context, provider),
                  icon: const Icon(Icons.add,
                      size: 16, color: Color(0xFF1D4ED8)),
                  label: const Text('+ Add Row',
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1D4ED8))),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(
                        color: Color(0xFF1D4ED8), width: 1.2),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: provider.orderItems.isEmpty
                      ? null
                      : () => setState(() => provider.orderItems.clear()),
                  icon: const Icon(Icons.delete_sweep,
                      size: 16, color: Color(0xFFEF4444)),
                  label: const Text('Clear All',
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFEF4444))),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(
                        color: Color(0xFFEF4444), width: 1.2),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TOTALS & DELIVERY DETAILS (Two-Column Layout)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildTotalsAndDeliveryCard(
    BuildContext context,
    double subtotal,
    double totalDiscount,
    double tax18,
    double finalOrderTotal,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Left Column: Subtotal, Discount, Tax, Order Total ──
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _summaryRow('Subtotal', '₹${_money.format(subtotal)}'),
                const SizedBox(height: 6),
                _summaryRow(
                    'Discount', '(-) ₹${_money.format(totalDiscount)}',
                    color: const Color(0xFFEF4444)),
                const SizedBox(height: 6),
                _summaryRow('Tax (GST 18%)', '₹${_money.format(tax18)}'),
                const Divider(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Order Total',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF1D4ED8))),
                    Text(
                      '₹${_money.format(finalOrderTotal)}',
                      style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1D4ED8)),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(width: 14),

          // ── Right Column: Order Date, Expected Delivery Date, Order Status ──
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: const [
                    Icon(Icons.calendar_today,
                        size: 13, color: Color(0xFF64748B)),
                    SizedBox(width: 4),
                    Text('Order Date',
                        style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 4),
                InkWell(
                  onTap: () => _pickOrderDate(context),
                  child: Container(
                    height: 36,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_dateFormat.format(_orderDate),
                            style: const TextStyle(
                                fontSize: 11.5, fontWeight: FontWeight.w600)),
                        const Icon(Icons.arrow_drop_down,
                            size: 16, color: Color(0xFF64748B)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                Row(
                  children: const [
                    Icon(Icons.event, size: 13, color: Color(0xFF64748B)),
                    SizedBox(width: 4),
                    Text('Expected Delivery Date',
                        style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 4),
                InkWell(
                  onTap: () => _pickDeliveryDate(context),
                  child: Container(
                    height: 36,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_dateFormat.format(_deliveryDate),
                            style: const TextStyle(
                                fontSize: 11.5, fontWeight: FontWeight.w600)),
                        const Icon(Icons.arrow_drop_down,
                            size: 16, color: Color(0xFF64748B)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                Row(
                  children: const [
                    Icon(Icons.assignment_outlined,
                        size: 13, color: Color(0xFF64748B)),
                    SizedBox(width: 4),
                    Text('Order Status',
                        style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 4),
                Container(
                  height: 36,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _orderStatus,
                      isExpanded: true,
                      icon: const Icon(Icons.arrow_drop_down, size: 16),
                      items: const [
                        DropdownMenuItem(
                            value: 'Pending',
                            child: Text('🟡 Pending',
                                style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600))),
                        DropdownMenuItem(
                            value: 'Confirmed',
                            child: Text('🟢 Confirmed',
                                style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600))),
                        DropdownMenuItem(
                            value: 'Delivered',
                            child: Text('🔵 Delivered',
                                style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600))),
                        DropdownMenuItem(
                            value: 'Cancelled',
                            child: Text('⚪ Cancelled',
                                style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600))),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _orderStatus = val);
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryRow(String label, String value, {Color? color}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
        Text(value,
            style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: color ?? const Color(0xFF1E293B))),
      ],
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. REMARKS CARD
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildRemarksCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.chat_bubble_outline,
                  size: 16, color: Color(0xFF1D4ED8)),
              SizedBox(width: 6),
              Text('Remarks',
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A))),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: TextField(
              controller: _remarksCtrl,
              maxLines: 2,
              style: const TextStyle(fontSize: 12.5),
              decoration: const InputDecoration(
                hintText: 'Customer requested delivery by 31 Oct 2026.',
                isDense: true,
                contentPadding: EdgeInsets.all(10),
                border: InputBorder.none,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. BOTTOM ACTION BAR (Preview, Convert to Bill, Save Order)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildBottomActionBar(
    BuildContext context,
    CatalogProvider provider,
    double subtotal,
    double totalDiscount,
    double tax18,
    double finalOrderTotal,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 10,
            offset: Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: provider.orderItems.isEmpty
                    ? null
                    : () => _previewOrder(context, provider, subtotal,
                        totalDiscount, tax18, finalOrderTotal),
                icon: const Icon(Icons.visibility_outlined,
                    size: 16, color: Color(0xFF1D4ED8)),
                label: const Text('Preview Order',
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        color: Color(0xFF1D4ED8))),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(
                      color: Color(0xFF1D4ED8), width: 1.2),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            // Convert to Bill: carries items & customer directly into BillScreen without duplicate stock/ledger impact
            Expanded(
              child: OutlinedButton.icon(
                onPressed: provider.orderItems.isEmpty
                    ? null
                    : () => _convertToBill(context, provider),
                icon: const Icon(Icons.receipt_long_outlined,
                    size: 16, color: Color(0xFF1D4ED8)),
                label: const Text('Convert to Bill',
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        color: Color(0xFF1D4ED8))),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(
                      color: Color(0xFF1D4ED8), width: 1.2),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: provider.orderItems.isEmpty || _saving
                    ? null
                    : () => _saveOrder(context, provider, subtotal,
                        totalDiscount, tax18, finalOrderTotal),
                icon: _saving
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.save_outlined, size: 16),
                label: Text(_saving ? 'Saving...' : 'Save Order',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 12.5)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ACTIONS & DIALOGS
  // ──────────────────────────────────────────────────────────────────────────
  Future<void> _editCustomer(
      BuildContext context, CatalogProvider provider) async {
    final picked = await Navigator.of(context).push(
      MaterialPageRoute(
          builder: (_) => const CustomerPickerScreen(selectMode: true)),
    );
    if (picked != null && picked is Customer) {
      await provider.selectCustomer(picked);
      provider.setOrderCustomerName(picked.name);
    }
  }

  Future<void> _openInlineEditCustomer(BuildContext context, CatalogProvider provider, Customer customer) async {
    final nameCtrl = TextEditingController(text: customer.name);
    final mobileCtrl = TextEditingController(text: customer.mobile);
    final addressCtrl = TextEditingController(text: customer.address);
    bool saving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Container(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.edit, color: Color(0xFF1D4ED8), size: 22),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Edit Customer Info', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                          Text('ID: ${customer.id}', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                        ],
                      ),
                    ],
                  ),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Customer Name *', prefixIcon: Icon(Icons.person_outline), border: OutlineInputBorder(), isDense: true),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: mobileCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Mobile Number', prefixIcon: Icon(Icons.phone_outlined), border: OutlineInputBorder(), isDense: true),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: addressCtrl,
                decoration: const InputDecoration(labelText: 'Address / Location', prefixIcon: Icon(Icons.location_on_outlined), border: OutlineInputBorder(), isDense: true),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: saving
                    ? null
                    : () async {
                        final name = nameCtrl.text.trim();
                        if (name.isEmpty) return;
                        setSheetState(() => saving = true);
                        try {
                          customer.name = name;
                          customer.mobile = mobileCtrl.text.trim();
                          customer.address = addressCtrl.text.trim();
                          final custProv = context.read<CustomerProvider>();
                          await custProv.updateCustomer(customer);
                          provider.updateCustomerInfo(customer);
                          provider.setOrderCustomerName(name);
                          if (!context.mounted) return;
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Customer updated successfully')));
                        } catch (e) {
                          setSheetState(() => saving = false);
                        }
                      },
                child: saving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Save Changes', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickOrderDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _orderDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) setState(() => _orderDate = picked);
  }

  Future<void> _pickDeliveryDate(BuildContext context) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _deliveryDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) setState(() => _deliveryDate = picked);
  }

  void _showScanBarcodeDialog(BuildContext context, CatalogProvider provider) {
    final barcodeCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Scan / Enter Barcode'),
        content: TextField(
          controller: barcodeCtrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'e.g. CEM-50KG'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final code = barcodeCtrl.text.trim();
              Navigator.pop(ctx);
              if (code.isNotEmpty) {
                final match = provider.filteredProducts.firstWhere(
                  (p) => p.code.toLowerCase() == code.toLowerCase(),
                  orElse: () => provider.filteredProducts.isNotEmpty
                      ? provider.filteredProducts.first
                      : Product(
                          sno: 1,
                          code: code,
                          desc: 'Scanned Item $code',
                          spec: '',
                          pkg: 1,
                          category: 'General',
                          purchase: 300,
                          marginPrice: 50,
                          sellingPrice: 350,
                          stock: 100),
                );
                provider.addToOrder(match);
                showAppSnackBar(context, 'Added ${match.desc} to order!');
              }
            },
            child: const Text('Add to Order'),
          ),
        ],
      ),
    );
  }

  void _showAddNewProductDialog(
      BuildContext context, CatalogProvider provider) {
    final nameCtrl = TextEditingController();
    final skuCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final stockCtrl = TextEditingController(text: '50');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
            18, 16, 18, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Add New Product',
                    style:
                        TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const SizedBox(height: 8),
            TextField(
                controller: nameCtrl,
                decoration:
                    const InputDecoration(labelText: 'Product Name *')),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                    child: TextField(
                        controller: skuCtrl,
                        decoration:
                            const InputDecoration(labelText: 'SKU / Code'))),
                const SizedBox(width: 10),
                Expanded(
                    child: TextField(
                        controller: priceCtrl,
                        keyboardType:
                            const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                            labelText: 'Selling Price *', prefixText: '₹ '))),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
                controller: stockCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Opening Stock')),
            const SizedBox(height: 18),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1D4ED8),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 13)),
              onPressed: () async {
                final name = nameCtrl.text.trim();
                final price = double.tryParse(priceCtrl.text.trim()) ?? 0.0;
                final sku = skuCtrl.text.trim().isNotEmpty
                    ? skuCtrl.text.trim()
                    : 'NSYU-${DateTime.now().millisecondsSinceEpoch % 10000}';
                final stock = int.tryParse(stockCtrl.text.trim()) ?? 0;

                if (name.isEmpty || price <= 0) {
                  showAppSnackBar(
                      context, 'Please enter product name and valid price',
                      isError: true);
                  return;
                }
                Navigator.pop(ctx);
                await provider.addProduct(
                    code: sku,
                    desc: name,
                    purchase: price * 0.8,
                    marginPrice: price * 0.2,
                    stock: stock);
                final created = provider.filteredProducts.firstWhere(
                  (p) => p.code == sku,
                  orElse: () => Product(
                      sno: 1,
                      code: sku,
                      desc: name,
                      spec: '',
                      pkg: 1,
                      category: 'General',
                      purchase: price * 0.8,
                      marginPrice: price * 0.2,
                      sellingPrice: price,
                      stock: stock),
                );
                provider.addToOrder(created);
                if (context.mounted) {
                  showAppSnackBar(context,
                      'Product added to catalog and added to order!');
                }
              },
              child: const Text('Save and Add to Order'),
            ),
          ],
        ),
      ),
    );
  }

  void _showViewProductsSheet(BuildContext context, CatalogProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        String q = '';
        return StatefulBuilder(
          builder: (ctx, setMState) {
            final prods = provider.filteredProducts.where((p) {
              return q.isEmpty ||
                  p.desc.toLowerCase().contains(q.toLowerCase()) ||
                  p.code.toLowerCase().contains(q.toLowerCase());
            }).toList();

            return DraggableScrollableSheet(
              initialChildSize: 0.75,
              maxChildSize: 0.95,
              expand: false,
              builder: (ctx, scroll) => Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Select Products for Order',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w700)),
                        IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () => Navigator.pop(ctx)),
                      ],
                    ),
                  ),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: TextField(
                      decoration: const InputDecoration(
                          hintText: 'Search products',
                          prefixIcon: Icon(Icons.search),
                          isDense: true),
                      onChanged: (val) => setMState(() => q = val),
                    ),
                  ),
                  Expanded(
                    child: prods.isEmpty
                        ? const Center(
                            child: Text('No matching products found'))
                        : ListView.separated(
                            controller: scroll,
                            padding: const EdgeInsets.all(12),
                            itemCount: prods.length,
                            separatorBuilder: (_, __) =>
                                const Divider(height: 1),
                            itemBuilder: (context, i) {
                              final p = prods[i];
                              final inOrder = provider.orderItemFor(p.code);
                              return ListTile(
                                title: Text(p.desc,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13.5)),
                                subtitle: Text(
                                    'SKU: ${p.code} · Available Stock: ${p.stock}',
                                    style: const TextStyle(
                                        fontSize: 11.5,
                                        color: Color(0xFF64748B))),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text('₹${_money.format(p.slPrice)}',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF16A34A))),
                                    const SizedBox(width: 8),
                                    ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: inOrder != null
                                            ? const Color(0xFF16A34A)
                                            : const Color(0xFF1D4ED8),
                                        visualDensity: VisualDensity.compact,
                                      ),
                                      onPressed: () {
                                        provider.addToOrder(p);
                                        setMState(() {});
                                      },
                                      child: Text(inOrder != null
                                          ? '+ (${inOrder.qty})'
                                          : 'Add'),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  /// Converts this order directly into a bill, carrying all items and customer
  /// forward into the Bill screen WITHOUT duplicate stock deduction or duplicate ledger debits.
  void _convertToBill(BuildContext context, CatalogProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Convert Order to Bill'),
        content: const Text(
          'This will transfer the order items to the Bill screen for billing and payment collection.\n\n'
          'Stock and customer ledger will only be updated once when the final bill is saved, preventing any duplicate deductions.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1D4ED8),
                foregroundColor: Colors.white),
            onPressed: () {
              Navigator.pop(ctx);
              // Clear bill cart and populate with order items
              provider.billItems.clear();
              for (final oi in provider.orderItems) {
                provider.billItems.add(BillItem(
                  code: oi.code,
                  desc: oi.desc,
                  spec: oi.spec,
                  price: oi.price,
                  qty: oi.qty,
                  availableStock: oi.availableStock,
                ));
              }
              if (provider.orderCustomerName.isNotEmpty) {
                provider.setCustomerName(provider.orderCustomerName);
              }
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const BillScreen()),
              );
            },
            child: const Text('Proceed to Bill'),
          ),
        ],
      ),
    );
  }

  void _previewOrder(
    BuildContext context,
    CatalogProvider provider,
    double subtotal,
    double totalDiscount,
    double tax18,
    double finalOrderTotal,
  ) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Order Preview #${provider.orderNumber}'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                  'Customer: ${provider.orderCustomerName.isNotEmpty ? provider.orderCustomerName : 'Mohd Nazim'}',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              Text('Order Date: ${_dateFormat.format(_orderDate)}'),
              Text(
                  'Expected Delivery: ${_dateFormat.format(_deliveryDate)}'),
              Text('Status: $_orderStatus'),
              if (_remarksCtrl.text.trim().isNotEmpty)
                Text('Remarks: ${_remarksCtrl.text.trim()}',
                    style: const TextStyle(
                        fontStyle: FontStyle.italic, color: Color(0xFF64748B))),
              const Divider(height: 20),
              const Text('Items:',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              for (final i in provider.orderItems)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                          child: Text(
                              '${i.desc} (${i.code})\nQty: ${i.qty} × ₹${_money.format(i.price)}',
                              style: const TextStyle(fontSize: 12))),
                      Text(
                          '₹${_money.format(i.amount * (1 - (_itemDiscounts[i.code] ?? 0) / 100))}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 12)),
                    ],
                  ),
                ),
              const Divider(height: 20),
              _summaryRow('Subtotal', '₹${_money.format(subtotal)}'),
              _summaryRow('Discount', '(-) ₹${_money.format(totalDiscount)}',
                  color: const Color(0xFFEF4444)),
              _summaryRow('Tax (GST 18%)', '₹${_money.format(tax18)}'),
              const Divider(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Order Total',
                      style: TextStyle(fontWeight: FontWeight.w800)),
                  Text('₹${_money.format(finalOrderTotal)}',
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1D4ED8))),
                ],
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Close')),
        ],
      ),
    );
  }

  Future<void> _saveOrder(
    BuildContext context,
    CatalogProvider provider,
    double subtotal,
    double totalDiscount,
    double tax18,
    double finalOrderTotal,
  ) async {
    if (_saving) return; // Prevent duplicate order creation on rapid taps
    setState(() => _saving = true);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final customer = provider.selectedCustomer;
      final orderRecord = SavedOrder(
        orderNumber: provider.orderNumber,
        date: _orderDate,
        expectedDeliveryDate: _deliveryDate,
        customerId: customer?.id ?? '',
        customerName: customer?.name ??
            (provider.orderCustomerName.isNotEmpty
                ? provider.orderCustomerName
                : 'Mohd Nazim'),
        customerPhone: customer?.mobile ?? '+91 98765 43210',
        customerAddress: customer?.address ?? 'Near Main Market, Lucknow',
        items: provider.orderItems
            .map((i) => SavedOrderItem(
                  desc: i.desc,
                  sku: i.code,
                  availableStock: i.availableStock,
                  qty: i.qty,
                  price: i.price,
                  discountPercent:
                      (_itemDiscounts[i.code] ?? 0).toDouble(),
                  amount: i.price *
                      i.qty *
                      (1 - (_itemDiscounts[i.code] ?? 0) / 100),
                ))
            .toList(),
        subtotal: subtotal,
        discountAmount: totalDiscount,
        taxAmount: tax18,
        totalAmount: finalOrderTotal,
        remarks: _remarksCtrl.text.trim(),
        status: OrderStatusLabel.fromLabel(_orderStatus),
      );

      final ordersProvider = context.read<OrdersProvider>();
      await ordersProvider.addOrder(orderRecord);

      provider.startNewOrder();

      if (context.mounted) {
        Navigator.of(context).pop(); // close loader
        Navigator.of(context).pop(); // return to orders list

        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Row(
              children: const [
                Icon(Icons.check_circle, color: Color(0xFF0D9488)),
                SizedBox(width: 8),
                Text('Order Saved Successfully'),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Order #${orderRecord.orderNumber}', style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text('Customer: ${orderRecord.customerName}'),
                Text('Total: ₹${_money.format(orderRecord.total)}'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  AppNavigation.toTab(context, 4); // Return to Orders tab
                },
                child: const Text('Return to Orders'),
              ),
              ElevatedButton.icon(
                icon: const Icon(Icons.shopping_bag_outlined, size: 16),
                label: const Text('View Order'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0D9488),
                  foregroundColor: Colors.white,
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  AppNavigation.openOrderDetails(context, order: orderRecord);
                },
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        Navigator.of(context).pop(); // close loader
        showAppSnackBar(context, 'Could not save order: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
