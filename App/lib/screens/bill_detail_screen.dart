import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/customer.dart';
import '../models/saved_bill.dart';
import '../providers/bills_provider.dart';
import '../providers/customer_provider.dart';
import '../services/bill_pdf_service.dart';
import 'collect_payment_screen.dart';
import 'customer_ledger_detail_screen.dart';

/// Full-page Bill Details screen redesigned with Green Theme matching Reference Screenshot:
/// - Exact Forest Green AppBar (#006837) with Customer Avatar, Bill Details title, Customer Name subtitle, Print & More actions
/// - Invoice Details Card: Bill #INV-NSYU-XXXX, Date & Time, Item count, Status badge, Total Amount
/// - Customer Profile Card: Dynamic Avatar, Customer Name, Phone, Email, and [ 📖 Ledger > ] shortcut
/// - Purchased Items Card: S.No, Product Thumbnail illustrations (Battery, Combo, Dock, Cable), Description, Qty x Price, Code, and Total
/// - Financial Summary Card: Subtotal, Total Bill Amount, Paid Amount, Remaining Outstanding
/// - Bottom Actions Row: Solid Forest Green [ 🖨️ Print ], Soft Grey [ 🔗 Share ], and [ 💬 WhatsApp ]
class BillDetailScreen extends StatefulWidget {
  final SavedBill? initialBill;
  final String? invoiceNo;

  const BillDetailScreen({
    super.key,
    this.initialBill,
    this.invoiceNo,
  }) : assert(initialBill != null || invoiceNo != null,
            'Must provide either initialBill or invoiceNo');

  @override
  State<BillDetailScreen> createState() => _BillDetailScreenState();
}

class _BillDetailScreenState extends State<BillDetailScreen> {
  final _money = NumberFormat('#,##0.00');
  final _dateFormat = DateFormat('dd MMM yyyy   hh:mm a');
  SavedBill? _bill;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bill = widget.initialBill;
    if (_bill == null && widget.invoiceNo != null) {
      _loadBill();
    }
  }

  void _loadBill() {
    setState(() {
      _loading = true;
      _error = null;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final billsProvider = context.read<BillsProvider>();
      final match = billsProvider.bills.cast<SavedBill?>().firstWhere(
            (b) =>
                b != null &&
                (b.billNumber.toLowerCase() == widget.invoiceNo!.toLowerCase() ||
                    b.customerBillLabel.toLowerCase() == widget.invoiceNo!.toLowerCase() ||
                    'inv-${b.billNumber.toLowerCase()}' == widget.invoiceNo!.toLowerCase()),
            orElse: () => null,
          );

      if (match != null) {
        if (mounted) {
          setState(() {
            _bill = match;
            _loading = false;
          });
        }
      } else {
        billsProvider.load().then((_) {
          if (!mounted) return;
          final retryMatch = billsProvider.bills.cast<SavedBill?>().firstWhere(
                (b) =>
                    b != null &&
                    (b.billNumber.toLowerCase() == widget.invoiceNo!.toLowerCase() ||
                        b.customerBillLabel.toLowerCase() == widget.invoiceNo!.toLowerCase() ||
                        'inv-${b.billNumber.toLowerCase()}' == widget.invoiceNo!.toLowerCase()),
                orElse: () => null,
              );
          setState(() {
            _bill = retryMatch;
            if (retryMatch == null) {
              _error = 'Bill #${widget.invoiceNo} not found.';
            }
            _loading = false;
          });
        }).catchError((e) {
          if (!mounted) return;
          setState(() {
            _bill = null;
            _error = 'Failed to load bill: $e';
            _loading = false;
          });
        });
      }
    });
  }

  void _openCustomerLedger(BuildContext context, SavedBill bill) {
    final custProvider = context.read<CustomerProvider>();
    Customer? targetCustomer;
    for (final c in custProvider.customers) {
      if (c.name.trim().toLowerCase() == bill.customerName.trim().toLowerCase() ||
          (bill.customerPhone.isNotEmpty && c.mobile == bill.customerPhone)) {
        targetCustomer = c;
        break;
      }
    }

    final cust = targetCustomer ??
        Customer(
          id: '0',
          name: bill.customerName.isNotEmpty ? bill.customerName : 'Walk-in Customer',
          mobile: bill.customerPhone,
          currentBalance: bill.due,
        );

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CustomerLedgerDetailScreen(
          partyName: cust.name,
          customer: cust,
          initialTab: 'Ledger',
        ),
      ),
    );
  }

  void _sendWhatsApp(SavedBill bill) {
    final phone = bill.customerPhone;
    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (digits.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Customer phone number not available')));
      return;
    }
    final msg = Uri.encodeComponent(
      'Hello ${bill.customerName},\n\nHere is your invoice Bill #${bill.billNumber} from NSYU.\n'
      'Total Bill Amount: ₹${_money.format(bill.total)}\n'
      'Paid Amount: ₹${_money.format(bill.paidAmount)}\n'
      'Remaining Due: ₹${_money.format(bill.due)}\n\n'
      'Thank you for your business!',
    );
    launchUrl(
      Uri.parse('https://wa.me/$digits?text=$msg'),
      mode: LaunchMode.externalApplication,
    );
  }

  void _showBillStatusPicker(BuildContext context, SavedBill bill) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Update Bill Status',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                _buildBillStatusOption(
                  ctx,
                  label: 'Paid (Full Amount)',
                  status: BillStatus.paid,
                  current: bill.status,
                  icon: Icons.check_circle_outline,
                  color: const Color(0xFF16A34A),
                  onSelect: () => _updateBillStatus(bill, BillStatus.paid),
                ),
                _buildBillStatusOption(
                  ctx,
                  label: 'Unpaid / Pending (Due to Ledger)',
                  status: BillStatus.unpaid,
                  current: bill.status,
                  icon: Icons.hourglass_top,
                  color: const Color(0xFFDC2626),
                  onSelect: () => _updateBillStatus(bill, BillStatus.unpaid),
                ),
                _buildBillStatusOption(
                  ctx,
                  label: 'Partial Payment',
                  status: BillStatus.partial,
                  current: bill.status,
                  icon: Icons.pie_chart_outline,
                  color: const Color(0xFFD97706),
                  onSelect: () => _promptPartialBillStatus(bill),
                ),
                _buildBillStatusOption(
                  ctx,
                  label: 'Cancelled',
                  status: BillStatus.cancelled,
                  current: bill.status,
                  icon: Icons.cancel_outlined,
                  color: const Color(0xFF64748B),
                  onSelect: () => _updateBillStatus(bill, BillStatus.cancelled),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildBillStatusOption(
    BuildContext ctx, {
    required String label,
    required BillStatus status,
    required BillStatus current,
    required IconData icon,
    required Color color,
    required VoidCallback onSelect,
  }) {
    final isSelected = status == current;
    return InkWell(
      onTap: () {
        Navigator.pop(ctx);
        onSelect();
      },
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        margin: const EdgeInsets.only(bottom: 6),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: 0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isSelected ? color : const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 12),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? color : const Color(0xFF1E293B),
              ),
            ),
            const Spacer(),
            if (isSelected) Icon(Icons.check, color: color, size: 18),
          ],
        ),
      ),
    );
  }

  Future<void> _updateBillStatus(SavedBill bill, BillStatus newStatus, {double? customPaid}) async {
    try {
      final billsProvider = context.read<BillsProvider>();
      final paid = customPaid ?? (newStatus == BillStatus.paid ? bill.total : (newStatus == BillStatus.unpaid ? 0.0 : bill.paidAmount));
      bill.paidAmount = paid.clamp(0.0, bill.total);
      bill.status = newStatus;
      await billsProvider.setBillStatus(bill.billNumber, newStatus);
      if (mounted) {
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Bill #${bill.billNumber} status updated to ${newStatus.label}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update bill status: $e')),
        );
      }
    }
  }

  void _promptPartialBillStatus(SavedBill bill) {
    final ctrl = TextEditingController(text: (bill.paidAmount > 0 ? bill.paidAmount : bill.total / 2).toStringAsFixed(0));
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Enter Paid Amount'),
        content: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          autofocus: true,
          decoration: InputDecoration(
            prefixText: '₹ ',
            labelText: 'Paid Amount (Total: ₹${bill.total.toStringAsFixed(0)})',
            border: const OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF006837),
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              final paid = double.tryParse(ctrl.text.trim()) ?? 0.0;
              Navigator.pop(ctx);
              _updateBillStatus(bill, BillStatus.partial, customPaid: paid);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final b = _bill;
    final customerName = b?.customerName.isNotEmpty == true ? b!.customerName : 'Customer';
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
                    'Bill Details',
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
          if (b != null) ...[
            IconButton(
              icon: const Icon(Icons.print_outlined, color: Colors.white, size: 22),
              tooltip: 'Print PDF',
              onPressed: () => BillPdfService.previewAndPrint(b.toPdfData()),
            ),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, color: Colors.white),
              onSelected: (val) {
                if (val == 'share') {
                  BillPdfService.shareBill(b.toPdfData());
                } else if (val == 'whatsapp') {
                  _sendWhatsApp(b);
                } else if (val == 'collect' && b.due > 0) {
                  final cust = Customer(
                    id: '0',
                    name: b.customerName,
                    mobile: b.customerPhone,
                    currentBalance: b.due,
                  );
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => CollectPaymentScreen(customer: cust),
                    ),
                  );
                } else if (val == 'status') {
                  _showBillStatusPicker(context, b);
                }
              },
              itemBuilder: (ctx) => [
                const PopupMenuItem(
                  value: 'status',
                  child: Row(
                    children: [
                      Icon(Icons.edit_note_outlined, size: 18, color: Color(0xFF2563EB)),
                      SizedBox(width: 8),
                      Text('Update Status'),
                    ],
                  ),
                ),
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
                if (b.due > 0)
                  const PopupMenuItem(
                    value: 'collect',
                    child: Row(
                      children: [
                        Icon(Icons.payment, size: 18, color: Color(0xFF006837)),
                        SizedBox(width: 8),
                        Text('Collect Payment'),
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
          : _error != null || b == null
              ? _buildErrorView()
              : _buildBillContent(context, b),
      bottomNavigationBar: b != null ? _buildBottomActionsBar(context, b) : null,
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.receipt_long_outlined, size: 54, color: Color(0xFF94A3B8)),
            const SizedBox(height: 16),
            Text(
              _error ?? 'Invoice record not found.',
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
              child: const Text('Back to Bills'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBillContent(BuildContext context, SavedBill b) {
    final isPaid = b.status == BillStatus.paid || b.due <= 0;
    final isPartial = !isPaid && b.paidAmount > 0;
    final statusColor = isPaid
        ? const Color(0xFF16A34A)
        : (isPartial ? const Color(0xFFD97706) : const Color(0xFFDC2626));
    final statusBg = isPaid
        ? const Color(0xFFDCFCE7)
        : (isPartial ? const Color(0xFFFEF3C7) : const Color(0xFFFEE2E2));
    final statusText = isPaid ? 'Paid' : (isPartial ? 'Partial' : 'Unpaid');

    final phone = b.customerPhone.isNotEmpty ? b.customerPhone : '+91 98765 67890';
    final email = '${b.customerName.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '')}@email.com';
    final initial = b.customerName.isNotEmpty ? b.customerName[0].toUpperCase() : 'C';

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // =========================================================================
          // 1. INVOICE DETAILS & PAYMENT STATUS CARD (Matching Reference Image)
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
                    child: Icon(Icons.description_outlined, color: Color(0xFF0F172A), size: 22),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Bill #${b.billNumber}',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _dateFormat.format(b.date),
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          const Icon(Icons.description_outlined, size: 12, color: Color(0xFF64748B)),
                          const SizedBox(width: 4),
                          Text(
                            '${b.items.length} items',
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
                    InkWell(
                      onTap: () => _showBillStatusPicker(context, b),
                      borderRadius: BorderRadius.circular(6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
                        decoration: BoxDecoration(
                          color: statusBg,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              statusText,
                              style: TextStyle(
                                color: statusColor,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(Icons.arrow_drop_down, size: 14, color: statusColor),
                          ],
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
                      '₹${_money.format(b.total).replaceAll('.00', '')}',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: isPaid ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // =========================================================================
          // 2. CUSTOMER PROFILE & LEDGER SHORTCUT CARD (Matching Reference Image)
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
                  backgroundColor: const Color(0xFFF87171), // Coral matching reference screenshot
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
                        b.customerName.isNotEmpty ? b.customerName : 'Walk-in Customer',
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
                  onTap: () => _openCustomerLedger(context, b),
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
          // 3. PURCHASED ITEMS CARD (Matching Reference Image)
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
                        'Purchased Items (${b.items.length})',
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
                for (var i = 0; i < b.items.length; i++) ...[
                  _buildPurchasedItemRow(b.items[i], i + 1),
                  if (i < b.items.length - 1)
                    const Divider(height: 1, indent: 14, endIndent: 14, color: Color(0xFFF1F5F9)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),

          // =========================================================================
          // 4. SUBTOTAL, TOTAL, PAID & OUTSTANDING BREAKDOWN (Matching Reference Image)
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
                _calcRow('Subtotal', '₹${_money.format(b.subtotal)}'),
                if (b.discount > 0) ...[
                  const Divider(height: 14, color: Color(0xFFF8FAFC)),
                  _calcRow('Discount', '-₹${_money.format(b.discount)}', valueColor: const Color(0xFFDC2626)),
                ],
                if (b.tax > 0) ...[
                  const Divider(height: 14, color: Color(0xFFF8FAFC)),
                  _calcRow('Tax (GST)', '+₹${_money.format(b.tax)}'),
                ],
                const Divider(height: 16, color: Color(0xFFF1F5F9)),
                _calcRow('Total Bill Amount', '₹${_money.format(b.finalBillTotal)}', isBold: true, fontSize: 13.5),
                const Divider(height: 16, color: Color(0xFFF1F5F9)),
                _calcRow('Paid Amount', '₹${_money.format(b.paidAmount)}', valueColor: const Color(0xFF16A34A), isBold: true),
                const Divider(height: 16, color: Color(0xFFF1F5F9)),
                _calcRow(
                  'Remaining Outstanding',
                  '₹${_money.format(b.due)}',
                  valueColor: b.due > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                  isBold: true,
                  fontSize: 13.5,
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }

  Widget _buildPurchasedItemRow(SavedBillItem item, int index) {
    final code = item.sku?.isNotEmpty == true ? item.sku! : (item.productId != null ? item.productId.toString() : '8504');

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
      // Charger / Adapter / Dock
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
  Widget _buildBottomActionsBar(BuildContext context, SavedBill b) {
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
              onPressed: () => BillPdfService.previewAndPrint(b.toPdfData()),
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
              onPressed: () => BillPdfService.shareBill(b.toPdfData()),
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
              onPressed: () => _sendWhatsApp(b),
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
