import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/customer.dart';
import '../models/saved_payment.dart';
import '../providers/customer_provider.dart';
import '../services/payment_receipt_pdf_service.dart';
import 'bill_detail_screen.dart';
import 'customer_ledger_detail_screen.dart';

/// Full-page Payment Details screen supporting direct reference navigation,
/// customer relationship linking, and related invoice reference inspection.
class PaymentDetailScreen extends StatelessWidget {
  final String paymentRef;
  final String customerName;
  final double amount;
  final DateTime date;
  final String mode;
  final String? invoiceNo;
  final String? notes;

  const PaymentDetailScreen({
    super.key,
    required this.paymentRef,
    required this.customerName,
    required this.amount,
    required this.date,
    this.mode = 'Cash',
    this.invoiceNo,
    this.notes,
  });

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat('#,##0.00');

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF16A34A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Payment Details',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
            ),
            Text(
              paymentRef,
              style: const TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share, color: Colors.white),
            tooltip: 'Share Receipt',
            onPressed: () => PaymentReceiptPdfService.shareReceipt(_buildSavedPayment()),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Amount Received Hero Card
            Container(
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check, color: Color(0xFF16A34A), size: 32),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'PAYMENT RECEIVED',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF64748B),
                      letterSpacing: 0.8,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '₹${money.format(amount)}',
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF16A34A),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    DateFormat('dd MMMM yyyy, hh:mm a').format(date),
                    style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Customer Info Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
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
                          'PAYER / CUSTOMER',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.5),
                        ),
                        Text(
                          customerName.isEmpty ? 'Walk-in Customer' : customerName,
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton(
                    onPressed: () {
                      final custProvider = context.read<CustomerProvider>();
                      final cust = custProvider.customers.cast<Customer?>().firstWhere(
                            (c) => c != null && c.name.toLowerCase() == customerName.toLowerCase(),
                            orElse: () => Customer(
                              id: '0',
                              name: customerName,
                              mobile: '',
                              currentBalance: 0.0,
                            ),
                          )!;
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => CustomerLedgerDetailScreen(
                            partyName: cust.name,
                            customer: cust,
                          ),
                        ),
                      );
                    },
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
            ),
            const SizedBox(height: 14),

            // Payment Details Table
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  _row('Reference Number', paymentRef),
                  const Divider(height: 16, color: Color(0xFFF1F5F9)),
                  _row('Payment Mode', mode),
                  const Divider(height: 16, color: Color(0xFFF1F5F9)),
                  if (invoiceNo != null && invoiceNo!.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Related Invoice', style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                          InkWell(
                            onTap: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => BillDetailScreen(invoiceNo: invoiceNo),
                                ),
                              );
                            },
                            child: Row(
                              children: [
                                Text(
                                  invoiceNo!,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF1D4ED8),
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.open_in_new, size: 12, color: Color(0xFF1D4ED8)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Divider(height: 16, color: Color(0xFFF1F5F9)),
                  ],
                  _row('Status', 'Recorded & Verified in Ledger', valueColor: const Color(0xFF16A34A)),
                  if (notes != null && notes!.isNotEmpty) ...[
                    const Divider(height: 16, color: Color(0xFFF1F5F9)),
                    _row('Notes', notes!),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Share Receipt Button
            ElevatedButton.icon(
              onPressed: () => PaymentReceiptPdfService.previewAndPrint(_buildSavedPayment()),
              icon: const Icon(Icons.print, size: 18),
              label: const Text('Print / Share Receipt PDF', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
          Text(
            value,
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: valueColor ?? const Color(0xFF0F172A)),
          ),
        ],
      ),
    );
  }

  SavedPayment _buildSavedPayment() {
    return SavedPayment(
      receiptNumber: paymentRef,
      date: date,
      customerName: customerName,
      billNumber: invoiceNo ?? '',
      amount: amount,
      method: PaymentMethodLabel.fromLabel(mode),
      remarks: notes ?? '',
      outstandingBalanceAfter: 0.0,
    );
  }
}
