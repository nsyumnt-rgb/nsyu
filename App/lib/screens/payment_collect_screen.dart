import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/saved_bill.dart';
import '../models/saved_payment.dart';
import '../providers/bills_provider.dart';
import '../providers/customer_provider.dart';
import '../services/payment_receipt_pdf_service.dart';
import '../theme/app_theme.dart';

/// Steps 3-7 of the Payment Collect flow (party + outstanding are already
/// picked on the Ledger screen before this opens):
///   3. Enter payment details (amount, method, transaction ID, remarks)
///   4. Confirm payment
///   5. Payment success
///   6. Receipt generated automatically
///   7. Share / print receipt
/// Step 8 (ledger updated) happens automatically via BillsProvider.
class PaymentCollectScreen extends StatefulWidget {
  final SavedBill bill;

  const PaymentCollectScreen({super.key, required this.bill});

  @override
  State<PaymentCollectScreen> createState() => _PaymentCollectScreenState();
}

class _PaymentCollectScreenState extends State<PaymentCollectScreen> {
  late final TextEditingController _amountCtrl =
      TextEditingController(text: widget.bill.due.toStringAsFixed(0));
  final _txnCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();
  PaymentMethod _method = PaymentMethod.upi;
  bool _saving = false;

  @override
  void dispose() {
    _amountCtrl.dispose();
    _txnCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  double get _amount => double.tryParse(_amountCtrl.text.trim()) ?? 0;

  @override
  Widget build(BuildContext context) {
    final money = NumberFormat('#,##0');

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('Enter Payment Details')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long_outlined, color: AppColors.steelBlue),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.bill.customerName.isEmpty
                              ? 'Walk-in customer'
                              : widget.bill.customerName,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        Text('Bill #${widget.bill.billNumber}',
                            style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text('₹${money.format(widget.bill.due)}',
                          style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.red)),
                      if (widget.bill.paidAmount > 0)
                        Text('of ₹${money.format(widget.bill.total)}',
                            style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text('Amount', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: _amountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(prefixText: '₹ '),
          ),
          const SizedBox(height: 16),
          const Text('Payment Method', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            children: [
              for (final m in PaymentMethod.values)
                ChoiceChip(
                  label: Text(m.label),
                  selected: _method == m,
                  onSelected: (_) => setState(() => _method = m),
                ),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Transaction ID (optional)', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: _txnCtrl,
            decoration: const InputDecoration(hintText: 'UPI ref / cheque no. / bank ref'),
          ),
          const SizedBox(height: 16),
          const Text('Remarks (optional)', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: _remarksCtrl,
            decoration: InputDecoration(
              hintText: 'Payment against invoice ${widget.bill.billNumber}',
            ),
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_amount <= 0 || _saving) ? null : _confirmAndCollect,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.billGreen,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
              ),
              child: const Text('Confirm Payment'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmAndCollect() async {
    final money = NumberFormat('#,##0');

    // Step 4: Confirm payment — review details before it's recorded.
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Payment'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _reviewRow('Customer',
                widget.bill.customerName.isEmpty ? 'Walk-in customer' : widget.bill.customerName),
            _reviewRow('Amount', '₹${money.format(_amount)}'),
            _reviewRow('Method', _method.label),
            if (_txnCtrl.text.trim().isNotEmpty)
              _reviewRow('Transaction ID', _txnCtrl.text.trim()),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!mounted) return;

    setState(() => _saving = true);
    try {
      final customers = context.read<CustomerProvider>().customers;
      final matchedCustomer = customers.where((c) => c.name == widget.bill.customerName);
      final customerId = matchedCustomer.isNotEmpty ? matchedCustomer.first.id : '';

      final bills = context.read<BillsProvider>();
      final payment = await bills.receivePayment(
        bill: widget.bill,
        amount: _amount,
        method: _method,
        customerId: customerId,
        transactionId: _txnCtrl.text.trim(),
        remarks: _remarksCtrl.text.trim(),
      );

      if (!mounted) return;

      // Step 5: Payment success.
      await showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle, color: AppColors.billGreen, size: 48),
              const SizedBox(height: 12),
              const Text('Payment recorded!', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text('Receipt ${payment.receiptNumber}', style: const TextStyle(color: AppColors.muted)),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                _shareReceipt(payment);
              },
              child: const Text('View / Share Receipt'),
            ),
          ],
        ),
      );

      final errors = [
        if (bills.lastDriveSyncError != null) 'Ledger/Bills: ${bills.lastDriveSyncError}',
        if (bills.lastPaymentSyncError != null) 'Payments: ${bills.lastPaymentSyncError}',
      ];
      if (mounted) {
        showAppSnackBar(
          context,
          errors.isEmpty
              ? 'Payment synced to Google Sheets.'
              : 'Payment saved locally, but sync failed — ${errors.join(' · ')}',
          isError: errors.isNotEmpty,
          duration: errors.isEmpty ? const Duration(seconds: 3) : const Duration(seconds: 8),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        showAppSnackBar(context, 'Could not record payment: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // Steps 6 & 7: receipt is already generated on demand from the bytes;
  // this opens the native preview/print/share sheet for it.
  Future<void> _shareReceipt(SavedPayment payment) async {
    await PaymentReceiptPdfService.previewAndPrint(payment);
  }

  Widget _reviewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(width: 110, child: Text(label, style: const TextStyle(color: AppColors.muted))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}
