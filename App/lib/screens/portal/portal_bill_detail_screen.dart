import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/bill_pdf_data.dart';
import '../../services/bill_pdf_service.dart';
import '../../services/customer_portal_service.dart';
import '../../theme/app_theme.dart';

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
        showAppSnackBar(context, 'Failed to generate PDF: $e', isError: true);
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
        showAppSnackBar(context, 'Failed to share PDF: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _generatingPdf = false);
    }
  }

  StatusChipVariant _getPaymentStatusVariant(String status) {
    switch (status.toUpperCase()) {
      case 'PAID':
        return StatusChipVariant.success;
      case 'PARTIAL':
        return StatusChipVariant.warning;
      case 'UNPAID':
      default:
        return StatusChipVariant.danger;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          flexibleSpace: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.navy900, AppColors.navy700],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text('Invoice Details', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
        ),
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: SkeletonLoader.list(count: 3),
        ),
      );
    }

    if (_error != null || _bill == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          flexibleSpace: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.navy900, AppColors.navy700],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text('Invoice Details', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
        ),
        body: Center(
          child: EmptyState(
            icon: Icons.error_outline_rounded,
            title: 'Invoice Not Found',
            subtitle: _error ?? 'Unable to find invoice details.',
            buttonLabel: 'Retry',
            onButtonPressed: _fetchBill,
          ),
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
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.navy900, AppColors.navy700],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          invNum,
          style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: _generatingPdf
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.share_outlined, color: Colors.white),
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
            // ── 1. Bill Header & Billed-To Card ──
            AppCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          shop['name']?.toString() ?? 'NSYU Shop',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.navy900),
                        ),
                      ),
                      StatusChip(
                        label: payStatus,
                        variant: _getPaymentStatusVariant(payStatus),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('Invoice Date: $dateStr', style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                  if (shop['address'] != null)
                    Text(shop['address'].toString(), style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                  if (shop['gstin'] != null)
                    Text('GSTIN: ${shop['gstin']}', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
                  const Divider(height: 24, color: AppColors.border),

                  // Billed To
                  const Text(
                    'BILLED TO',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textSecondary, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    cust['name']?.toString() ?? 'Customer',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.navy900),
                  ),
                  if (cust['phone'] != null)
                    Text('Mobile: +91 ${cust['phone']}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  if (cust['address'] != null)
                    Text(cust['address'].toString(), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ── 2. Purchased Items & Financial Breakdown ──
            AppCard(
              padding: EdgeInsets.zero,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Purchased Items',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.navy900),
                        ),
                        Text(
                          '${items.length} ${items.length == 1 ? "item" : "items"}',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1, color: AppColors.border),
                  ...items.map((it) {
                    final pName = it['product_name']?.toString() ?? 'Item';
                    final q = ((it['quantity'] ?? 1) as num).toInt();
                    final rate = ((it['unit_price'] ?? 0) as num).toDouble();
                    final lineSub = ((it['subtotal'] ?? q * rate) as num).toDouble();
                    final lineGst = ((it['tax_amount'] ?? 0) as num).toDouble();
                    final lineTot = ((it['line_total'] ?? it['total'] ?? q * rate) as num).toDouble();

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: const BoxDecoration(
                        border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
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
                                  style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Qty: $q × ₹${rate.toStringAsFixed(2)}  •  Subtotal: ₹${lineSub.toStringAsFixed(2)}${lineGst > 0 ? " • GST: ₹${lineGst.toStringAsFixed(2)}" : ""}',
                                  style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          AmountText(
                            amount: lineTot,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ],
                      ),
                    );
                  }),

                  // Totals Section
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        _buildSummaryLine('Subtotal', subtotal),
                        if (discount > 0)
                          _buildSummaryLine('Discount', -discount, color: AppColors.success),
                        if (tax > 0)
                          _buildSummaryLine('GST Tax', tax),
                        const Divider(height: 20, color: AppColors.border),
                        _buildSummaryLine('Total Amount', total, isBold: true, fontSize: 15),
                        const SizedBox(height: 6),
                        _buildSummaryLine('Paid Amount', paid, color: AppColors.success, isBold: true),
                        const SizedBox(height: 6),
                        _buildSummaryLine(
                          'Remaining Due',
                          balanceDue > 0 ? balanceDue : 0,
                          color: balanceDue > 0 ? AppColors.danger : AppColors.success,
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

            // ── 3. Payment History Section ──
            if (payments.isNotEmpty) ...[
              AppCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Payment History',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.navy900),
                    ),
                    const Divider(height: 20, color: AppColors.border),
                    ...payments.map((pm) {
                      final pAmt = ((pm['amount'] ?? 0) as num).toDouble();
                      final pMode = (pm['payment_mode'] ?? pm['payment_method'] ?? 'CASH').toString().toUpperCase();
                      final pDt = pm['payment_date']?.toString() ?? pm['createdAt']?.toString();
                      final pDateStr = pDt != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(pDt)) : '';

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.check_circle_rounded, size: 18, color: AppColors.success),
                                const SizedBox(width: 8),
                                Text('$pDateStr ($pMode)', style: const TextStyle(fontSize: 12.5, color: AppColors.textSecondary)),
                              ],
                            ),
                            AmountText(
                              amount: pAmt,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: AppColors.success,
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

            // ── 4. Action Buttons ──
            Row(
              children: [
                Expanded(
                  child: SecondaryButton(
                    label: 'Print / Preview',
                    icon: Icons.print_outlined,
                    onPressed: _generatingPdf ? null : _handlePrintPdf,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: PrimaryButton(
                    label: 'Share PDF',
                    icon: Icons.share_outlined,
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

  Widget _buildSummaryLine(String label, double amount, {bool isBold = false, Color? color, double fontSize = 12.5}) {
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
            color: color ?? AppColors.textPrimary,
          ),
        ],
      ),
    );
  }
}
