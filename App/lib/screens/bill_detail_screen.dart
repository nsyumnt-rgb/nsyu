import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/customer.dart';
import '../models/saved_bill.dart';
import '../providers/bills_provider.dart';
import '../providers/customer_provider.dart';
import '../services/bill_pdf_service.dart';
import 'collect_payment_screen.dart';
import 'customer_ledger_detail_screen.dart';
import 'product_detail_screen.dart';

/// Full-page Bill Details screen displaying authoritative database invoice info,
/// customer relationships, line items, payments, and PDF generation.
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
            _loading = false;
            if (retryMatch == null) {
              _error = 'Invoice "${widget.invoiceNo}" not found.';
            }
          });
        }).catchError((e) {
          if (!mounted) return;
          setState(() {
            _loading = false;
            _error = e.toString();
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
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final b = _bill;
    final invLabel = b?.customerBillLabel ?? widget.invoiceNo ?? 'Invoice';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D4ED8),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Bill Details',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
            ),
            Text(
              invLabel,
              style: const TextStyle(color: Colors.white70, fontSize: 11),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          if (b != null)
            IconButton(
              icon: const Icon(Icons.print_outlined, color: Colors.white),
              tooltip: 'Print PDF',
              onPressed: () => BillPdfService.previewAndPrint(b.toPdfData()),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null || b == null
              ? _buildErrorView()
              : _buildBillContent(context, b),
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
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1D4ED8)),
              child: const Text('Back to Bills', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBillContent(BuildContext context, SavedBill b) {
    final isPaid = b.status == BillStatus.paid;
    final statusColor = isPaid ? const Color(0xFF16A34A) : const Color(0xFFDC2626);
    final statusBg = isPaid ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Status Banner
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Bill #${b.billNumber}',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        b.status.label.toUpperCase(),
                        style: TextStyle(
                          color: statusColor,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  b.customerBillLabel,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF475569),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  DateFormat('dd MMMM yyyy, hh:mm a').format(b.date),
                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Customer Profile Card (Clickable to Customer Ledger)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.person, color: Color(0xFF1D4ED8), size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'CUSTOMER',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF64748B),
                              letterSpacing: 0.5,
                            ),
                          ),
                          Text(
                            b.customerName.isEmpty ? 'Walk-in Customer' : b.customerName,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          if (b.customerPhone.isNotEmpty)
                            Text(
                              b.customerPhone,
                              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                            ),
                        ],
                      ),
                    ),
                    OutlinedButton(
                      onPressed: () => _openCustomerLedger(context, b),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFF93C5FD)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('Ledger', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF1D4ED8))),
                          SizedBox(width: 4),
                          Icon(Icons.arrow_forward_ios, size: 10, color: Color(0xFF1D4ED8)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Items Table
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(
                    'Purchased Items (${b.items.length})',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                for (var i = 0; i < b.items.length; i++) ...[
                  InkWell(
                    onTap: () {
                      final itemDesc = b.items[i].desc;
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ProductDetailScreen(
                            productCode: itemDesc.contains('(')
                                ? itemDesc.split('(').last.replaceAll(')', '').trim()
                                : itemDesc,
                          ),
                        ),
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 20,
                            child: Text('${i + 1}', style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  b.items[i].desc,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF1D4ED8)),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${b.items[i].qty} × ₹${_money.format(b.items[i].price)}',
                                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '₹${_money.format(b.items[i].amount)}',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (i < b.items.length - 1)
                    const Divider(height: 1, indent: 14, endIndent: 14, color: Color(0xFFF1F5F9)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Financial Breakdown
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                _calcRow('Subtotal', '₹${_money.format(b.subtotal)}'),
                if (b.discount > 0)
                  _calcRow('Discount', '-₹${_money.format(b.discount)}', valueColor: const Color(0xFFDC2626)),
                if (b.tax > 0)
                  _calcRow('Tax (GST)', '+₹${_money.format(b.tax)}'),
                const Divider(height: 16, color: Color(0xFFE2E8F0)),
                _calcRow('Total Bill Amount', '₹${_money.format(b.finalBillTotal)}', isBold: true, fontSize: 15),
                if (b.previousOutstanding > 0)
                  _calcRow('Previous Balance', '₹${_money.format(b.previousOutstanding)}'),
                if (b.previousOutstanding > 0)
                  _calcRow('Total Amount Payable', '₹${_money.format(b.totalAmountPayable)}', isBold: true),
                const Divider(height: 16, color: Color(0xFFE2E8F0)),
                _calcRow('Paid Amount', '₹${_money.format(b.paidAmount)}', valueColor: const Color(0xFF16A34A), isBold: true),
                _calcRow('Remaining Outstanding', '₹${_money.format(b.due)}',
                    valueColor: b.due > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                    isBold: true,
                    fontSize: 15),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Bottom Action Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => BillPdfService.shareBill(b.toPdfData()),
                  icon: const Icon(Icons.share, size: 16, color: Color(0xFF1D4ED8)),
                  label: const Text('Share PDF', style: TextStyle(color: Color(0xFF1D4ED8), fontWeight: FontWeight.w700)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF93C5FD)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              if (!isPaid) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      final custProvider = context.read<CustomerProvider>();
                      final cust = custProvider.customers.cast<Customer?>().firstWhere(
                            (c) => c != null && c.name.toLowerCase() == b.customerName.toLowerCase(),
                            orElse: () => Customer(
                              id: '0',
                              name: b.customerName,
                              mobile: b.customerPhone,
                              currentBalance: b.due,
                            ),
                          )!;
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => CollectPaymentScreen(customer: cust),
                        ),
                      );
                    },
                    icon: const Icon(Icons.payment, size: 16),
                    label: const Text('Collect Payment', style: TextStyle(fontWeight: FontWeight.w700)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _calcRow(String label, String value, {bool isBold = false, Color? valueColor, double fontSize = 13}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
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
      ),
    );
  }
}
