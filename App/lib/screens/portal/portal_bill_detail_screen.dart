import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/bill_pdf_data.dart';
import '../../services/bill_pdf_service.dart';
import '../../services/customer_portal_service.dart';

class PortalBillDetailScreen extends StatefulWidget {
  final int billId;
  const PortalBillDetailScreen({super.key, required this.billId});

  @override
  State<PortalBillDetailScreen> createState() => _PortalBillDetailScreenState();
}

class _PortalBillDetailScreenState extends State<PortalBillDetailScreen> {
  final CustomerPortalService _service = CustomerPortalService();
  Map<String, dynamic>? _bill;
  bool _loading = true;
  String? _error;
  bool _generatingPdf = false;

  @override
  void initState() {
    super.initState();
    _fetchBill();
  }

  Future<void> _fetchBill() async {
    setState(() => _loading = true);
    try {
      final b = await _service.getBill(widget.billId);
      if (mounted) setState(() => _bill = b);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  BillPdfData _buildPdfData() {
    final invNum = _bill!['invoice_number']?.toString() ?? 'INV-${widget.billId}';
    final cust = (_bill!['customer'] as Map<String, dynamic>?) ?? {};
    final items = (_bill!['items'] as List<dynamic>?) ?? [];
    final paid = ((_bill!['paid_amount'] ?? 0) as num).toDouble();
    final discount = ((_bill!['discount_amount'] ?? _bill!['discount'] ?? 0) as num).toDouble();
    final tax = ((_bill!['tax_amount'] ?? _bill!['tax'] ?? 0) as num).toDouble();
    final dt = _bill!['createdAt']?.toString() ?? _bill!['date']?.toString();

    return BillPdfData(
      billNumber: invNum,
      date: dt != null ? DateTime.tryParse(dt) ?? DateTime.now() : DateTime.now(),
      customerName: cust['name']?.toString() ?? 'Customer',
      customerPhone: cust['phone']?.toString() ?? '',
      items: items.map((it) {
        return BillPdfLineData(
          desc: it['product_name']?.toString() ?? 'Item',
          qty: ((it['quantity'] ?? 1) as num).toInt(),
          price: ((it['unit_price'] ?? 0) as num).toDouble(),
        );
      }).toList(),
      discount: discount,
      tax: tax,
      paidAmount: paid,
    );
  }

  Future<void> _handlePrintPdf() async {
    if (_bill == null) return;
    setState(() => _generatingPdf = true);
    try {
      final pdfData = _buildPdfData();
      await BillPdfService.previewAndPrint(pdfData);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to generate PDF: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _generatingPdf = false);
    }
  }

  Future<void> _handleSharePdf() async {
    if (_bill == null) return;
    setState(() => _generatingPdf = true);
    try {
      final pdfData = _buildPdfData();
      await BillPdfService.shareBill(pdfData);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to share PDF: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _generatingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(
          backgroundColor: const Color(0xFF1D4ED8),
          title: const Text('Invoice Details', style: TextStyle(color: Colors.white)),
        ),
        body: const Center(child: CircularProgressIndicator(color: Color(0xFF1D4ED8))),
      );
    }

    if (_error != null || _bill == null) {
      return Scaffold(
        appBar: AppBar(
          backgroundColor: const Color(0xFF1D4ED8),
          title: const Text('Invoice Details', style: TextStyle(color: Colors.white)),
        ),
        body: Center(
          child: Text(_error ?? 'Invoice not found', style: const TextStyle(color: Color(0xFF64748B))),
        ),
      );
    }

    final invNum = _bill!['invoice_number']?.toString() ?? 'INV-${widget.billId}';
    final shop = (_bill!['shop'] as Map<String, dynamic>?) ?? {};
    final cust = (_bill!['customer'] as Map<String, dynamic>?) ?? {};
    final items = (_bill!['items'] as List<dynamic>?) ?? [];
    final payments = (_bill!['payments'] as List<dynamic>?) ?? [];
    final total = ((_bill!['total_amount'] ?? 0) as num).toDouble();
    final subtotal = ((_bill!['subtotal'] ?? total) as num).toDouble();
    final discount = ((_bill!['discount_amount'] ?? _bill!['discount'] ?? 0) as num).toDouble();
    final tax = ((_bill!['tax_amount'] ?? _bill!['tax'] ?? 0) as num).toDouble();
    final paid = ((_bill!['paid_amount'] ?? 0) as num).toDouble();
    final balanceDue = total - paid;
    final payStatus = (_bill!['payment_status']?.toString() ?? 'unpaid').toUpperCase();
    final dt = _bill!['createdAt']?.toString() ?? _bill!['date']?.toString();
    final dateStr = dt != null ? DateFormat('dd MMM yyyy, hh:mm a').format(DateTime.parse(dt)) : 'N/A';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1D4ED8),
        elevation: 0,
        title: Text(
          invNum,
          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined, color: Colors.white),
            tooltip: 'Share Invoice PDF',
            onPressed: _generatingPdf ? null : _handleSharePdf,
          ),
          IconButton(
            icon: const Icon(Icons.print_outlined, color: Colors.white),
            tooltip: 'Print / Preview PDF',
            onPressed: _generatingPdf ? null : _handlePrintPdf,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Bill Header Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          shop['name']?.toString() ?? 'NSYU Shop',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                        ),
                      ),
                      _buildStatusBadge(payStatus),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('Invoice Date: $dateStr', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  if (shop['address'] != null)
                    Text(shop['address'].toString(), style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  if (shop['gstin'] != null)
                    Text('GSTIN: ${shop['gstin']}', style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8))),
                  const Divider(height: 24),

                  // Billed To
                  const Text('BILLED TO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8), letterSpacing: 0.5)),
                  const SizedBox(height: 4),
                  Text(
                    cust['name']?.toString() ?? 'Customer',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                  if (cust['phone'] != null)
                    Text('Mobile: +91 ${cust['phone']}', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                  if (cust['address'] != null)
                    Text(cust['address'].toString(), style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Items List
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Purchased Products',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF0F172A)),
                        ),
                        Text(
                          '${items.length} items',
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  ...items.map((it) {
                    final pName = it['product_name']?.toString() ?? 'Item';
                    final q = ((it['quantity'] ?? 1) as num).toInt();
                    final rate = ((it['unit_price'] ?? 0) as num).toDouble();
                    final lineSub = ((it['subtotal'] ?? q * rate) as num).toDouble();
                    final lineGst = ((it['tax_amount'] ?? 0) as num).toDouble();
                    final lineTot = ((it['line_total'] ?? it['total'] ?? q * rate) as num).toDouble();

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: const BoxDecoration(
                        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  pName,
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Qty: $q × ₹${rate.toStringAsFixed(2)}  •  Subtotal: ₹${lineSub.toStringAsFixed(2)}${lineGst > 0 ? " • GST: ₹${lineGst.toStringAsFixed(2)}" : ""}',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '₹${lineTot.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                    );
                  }),

                  // Totals Section
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      children: [
                        _buildSummaryRow('Subtotal', '₹${subtotal.toStringAsFixed(2)}'),
                        if (discount > 0)
                          _buildSummaryRow('Discount', '-₹${discount.toStringAsFixed(2)}', color: const Color(0xFF16A34A)),
                        if (tax > 0)
                          _buildSummaryRow('GST Tax', '₹${tax.toStringAsFixed(2)}'),
                        const Divider(height: 18),
                        _buildSummaryRow('Total Amount', '₹${total.toStringAsFixed(2)}', isBold: true, fontSize: 15),
                        const SizedBox(height: 6),
                        _buildSummaryRow('Paid Amount', '₹${paid.toStringAsFixed(2)}', color: const Color(0xFF16A34A), isBold: true),
                        const SizedBox(height: 6),
                        _buildSummaryRow(
                          'Remaining Due',
                          '₹${balanceDue > 0 ? balanceDue.toStringAsFixed(2) : "0.00"}',
                          color: balanceDue > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                          isBold: true,
                          fontSize: 15,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Payment History Section
            if (payments.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: const [
                    BoxShadow(color: Color(0x06000000), blurRadius: 4, offset: Offset(0, 2)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Payment History',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF0F172A)),
                    ),
                    const Divider(height: 16),
                    ...payments.map((pm) {
                      final pAmt = ((pm['amount'] ?? 0) as num).toDouble();
                      final pMode = (pm['payment_mode'] ?? pm['payment_method'] ?? 'CASH').toString().toUpperCase();
                      final pDt = pm['payment_date']?.toString() ?? pm['createdAt']?.toString();
                      final pDateStr = pDt != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(pDt)) : '';

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.check_circle, size: 16, color: Color(0xFF16A34A)),
                                const SizedBox(width: 8),
                                Text('$pDateStr ($pMode)', style: const TextStyle(fontSize: 12, color: Color(0xFF475569))),
                              ],
                            ),
                            Text(
                              '₹${pAmt.toStringAsFixed(2)}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF16A34A)),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF1D4ED8),
                      side: const BorderSide(color: Color(0xFF1D4ED8)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.print_outlined, size: 18),
                    label: const Text('Print / Preview', style: TextStyle(fontWeight: FontWeight.bold)),
                    onPressed: _generatingPdf ? null : _handlePrintPdf,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1D4ED8),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.share_outlined, size: 18),
                    label: const Text('Share PDF', style: TextStyle(fontWeight: FontWeight.bold)),
                    onPressed: _generatingPdf ? null : _handleSharePdf,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBold = false, Color? color, double fontSize = 12.5}) {
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
              color: const Color(0xFF64748B),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.bold,
              color: color ?? const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = const Color(0xFFFEE2E2);
    Color text = const Color(0xFFDC2626);
    if (status == 'PAID') {
      bg = const Color(0xFFDCFCE7);
      text = const Color(0xFF16A34A);
    } else if (status == 'PARTIAL') {
      bg = const Color(0xFFFEF3C7);
      text = const Color(0xFFB45309);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        status,
        style: TextStyle(color: text, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}
