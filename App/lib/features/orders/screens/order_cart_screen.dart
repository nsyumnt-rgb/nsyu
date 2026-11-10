import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../models/customer.dart';
import '../../../models/saved_bill.dart';
import '../../../models/saved_order.dart';
import '../../../navigation/app_navigation.dart';
import '../../../providers/bills_provider.dart';
import '../../../providers/catalog_provider.dart';
import '../../../providers/customer_provider.dart';
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
  final TextEditingController _notesCtrl = TextEditingController();
  final TextEditingController _discountValCtrl = TextEditingController(text: '0.00');

  String _documentMode = 'Bill'; // 'Bill' or 'Order'
  bool _isDiscountPercent = false; // true = %, false = ₹
  double _discountValue = 0.0;
  bool _saving = false;

  @override
  void dispose() {
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

    try {
      if (isOrder) {
        setState(() => _saving = true);
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

      double paidAmount = grandTotal;
      String paymentMethod = 'cash';
      BillStatus billStatus = BillStatus.paid;

      // If a real customer is selected, allow choosing Credit (Udhaar), Paid, or Partial
      if (cust != null) {
        final paymentResult = await _showPaymentModeSheet(context, cust, grandTotal);
        if (paymentResult == null) {
          // User dismissed or cancelled
          return;
        }
        paidAmount = paymentResult['paidAmount'] as double;
        paymentMethod = paymentResult['paymentMethod'] as String;
        if (paidAmount <= 0.01) {
          billStatus = BillStatus.unpaid;
        } else if (paidAmount < grandTotal) {
          billStatus = BillStatus.partial;
        } else {
          billStatus = BillStatus.paid;
        }
      }

      setState(() => _saving = true);

      final bill = SavedBill(
        id: DateTime.now().millisecondsSinceEpoch,
        billNumber: 'B-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
        customerName: custName,
        customerPhone: custPhone,
        date: DateTime.now(),
        items: billItemsList,
        discount: discount,
        tax: 0.0,
        paidAmount: paidAmount,
        status: billStatus,
      );

      if (!mounted) return;
      final billsProvider = context.read<BillsProvider>();
      final backendBill = await billsProvider.addBill(
        bill,
        customerId: cust?.id,
        paymentMethod: paymentMethod,
        billDiscount: discount,
      );

      if (!mounted) return;
      provider.orderItems.clear();
      provider.billItems.clear();
      provider.clearBill();
      context.read<CustomerProvider>().syncFromSupabase();
      context.read<BillsProvider>().syncFromSupabase();
      setState(() => _saving = false);

      if (backendBill.due > 0) {
        showAppSnackBar(
          context,
          'Bill #${backendBill.billNumber} saved! ₹${backendBill.due.toStringAsFixed(0)} added to ${cust?.name ?? "Customer"}\'s Ledger.',
        );
      } else {
        showAppSnackBar(context, 'Bill #${backendBill.billNumber} saved and marked Paid!');
      }
      AppNavigation.openBillDetails(context, bill: backendBill);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      showAppSnackBar(context, 'Failed to save $_documentMode: $e', isError: true);
    }
  }

  Future<Map<String, dynamic>?> _showPaymentModeSheet(
    BuildContext context,
    Customer customer,
    double grandTotal,
  ) {
    String selectedMode = 'credit'; // Default to Credit (Udhaar) for ledger recording
    String paymentMethod = 'cash';
    final paidCtrl = TextEditingController(text: '0.00');

    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final enteredPaid = double.tryParse(paidCtrl.text.trim()) ?? 0.0;
            final remainingDue = (grandTotal - enteredPaid).clamp(0.0, double.infinity);

            return Padding(
              padding: EdgeInsets.only(
                left: 18,
                right: 18,
                top: 18,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 18,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.receipt_long, color: Color(0xFF16A34A), size: 20),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Save Bill & Ledger',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                              ),
                              Text(
                                '${customer.name} (${customer.mobile})',
                                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 20),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Bill Grand Total', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
                        Text('₹ ${NumberFormat('#,##0.00').format(grandTotal)}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text('Select Payment Option', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
                  const SizedBox(height: 8),

                  // Option 1: Credit / Unpaid (Udhaar)
                  _buildPaymentOptionTile(
                    title: 'Credit / Unpaid (Udhaar)',
                    subtitle: 'Full amount will be added as Due to Customer Ledger',
                    icon: Icons.account_balance_wallet_outlined,
                    iconColor: const Color(0xFFEA580C),
                    isSelected: selectedMode == 'credit',
                    onTap: () {
                      setModalState(() {
                        selectedMode = 'credit';
                        paymentMethod = 'cash';
                        paidCtrl.text = '0.00';
                      });
                    },
                  ),
                  const SizedBox(height: 8),

                  // Option 2: Full Paid (Cash / UPI)
                  _buildPaymentOptionTile(
                    title: 'Full Paid (Cash / UPI)',
                    subtitle: 'Bill is fully cleared now (No pending due)',
                    icon: Icons.check_circle_outline,
                    iconColor: const Color(0xFF16A34A),
                    isSelected: selectedMode == 'paid',
                    onTap: () {
                      setModalState(() {
                        selectedMode = 'paid';
                        paymentMethod = 'cash';
                        paidCtrl.text = grandTotal.toStringAsFixed(2);
                      });
                    },
                  ),
                  const SizedBox(height: 8),

                  // Option 3: Partial Payment
                  _buildPaymentOptionTile(
                    title: 'Partial Payment',
                    subtitle: 'Pay part now, remainder added to Customer Ledger',
                    icon: Icons.pie_chart_outline,
                    iconColor: const Color(0xFF2563EB),
                    isSelected: selectedMode == 'partial',
                    onTap: () {
                      setModalState(() {
                        selectedMode = 'partial';
                        paidCtrl.text = (grandTotal / 2).toStringAsFixed(0);
                      });
                    },
                  ),

                  // If Partial or Paid: Payment Method selector
                  if (selectedMode != 'credit') ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _buildMethodChip('cash', 'Cash', paymentMethod, (m) => setModalState(() => paymentMethod = m)),
                        const SizedBox(width: 8),
                        _buildMethodChip('upi', 'UPI / QR', paymentMethod, (m) => setModalState(() => paymentMethod = m)),
                        const SizedBox(width: 8),
                        _buildMethodChip('bank_transfer', 'Bank', paymentMethod, (m) => setModalState(() => paymentMethod = m)),
                      ],
                    ),
                  ],

                  // If Partial: Custom Amount Input
                  if (selectedMode == 'partial') ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Text('Amount Paid Now:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Container(
                            height: 38,
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFF006837)),
                            ),
                            child: TextField(
                              controller: paidCtrl,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              decoration: const InputDecoration(
                                prefixText: '₹ ',
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.symmetric(vertical: 8),
                              ),
                              onChanged: (_) => setModalState(() {}),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],

                  const SizedBox(height: 14),
                  // Remaining Due Summary Box
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: remainingDue > 0 ? const Color(0xFFFFF7ED) : const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: remainingDue > 0 ? const Color(0xFFFFEDD5) : const Color(0xFFDCFCE7),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          remainingDue > 0 ? 'Remaining Due in Ledger:' : 'Ledger Impact:',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: remainingDue > 0 ? const Color(0xFFC2410C) : const Color(0xFF15803D),
                          ),
                        ),
                        Text(
                          remainingDue > 0
                              ? '+ ₹ ${NumberFormat('#,##0.00').format(remainingDue)} Due'
                              : '₹ 0.00 (Fully Settled)',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: remainingDue > 0 ? const Color(0xFFC2410C) : const Color(0xFF15803D),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 46,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF006837),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 0,
                      ),
                      onPressed: () {
                        final paid = selectedMode == 'credit'
                            ? 0.0
                            : (selectedMode == 'paid'
                                ? grandTotal
                                : (double.tryParse(paidCtrl.text.trim()) ?? 0.0));
                        Navigator.pop(ctx, {
                          'paidAmount': paid.clamp(0.0, grandTotal),
                          'paymentMethod': paymentMethod,
                        });
                      },
                      child: const Text(
                        'Confirm & Save Bill',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                      ),
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

  Widget _buildPaymentOptionTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFF0FDF4) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: iconColor, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                  Text(subtitle, style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B))),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 18),
          ],
        ),
      ),
    );
  }

  Widget _buildMethodChip(String val, String label, String currentVal, ValueChanged<String> onSelected) {
    final isSelected = val == currentVal;
    return InkWell(
      onTap: () => onSelected(val),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF006837) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: isSelected ? Colors.white : const Color(0xFF475569),
          ),
        ),
      ),
    );
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
                        'Cart is empty. Add products from the Catalog.',
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
            const SizedBox(height: 14),

            // Terms & Conditions & Financial Summary
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
