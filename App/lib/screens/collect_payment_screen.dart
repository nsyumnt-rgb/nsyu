import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:printing/printing.dart';

import '../models/customer.dart';
import '../models/payment.dart';
import '../models/saved_bill.dart';
import '../providers/bills_provider.dart';
import '../providers/customer_provider.dart';
import '../providers/payments_provider.dart';
import '../services/google_drive_file_service.dart';
import '../services/payment_pdf_service.dart';
import '../theme/app_theme.dart';

class CollectPaymentScreen extends StatefulWidget {
  final Customer? customer;
  const CollectPaymentScreen({super.key, this.customer});

  @override
  State<CollectPaymentScreen> createState() => _CollectPaymentScreenState();
}

class _CollectPaymentScreenState extends State<CollectPaymentScreen> {
  int _step = 0;
  LedgerParty? _selectedParty;
  Customer? _selectedCustomer;

  @override
  void initState() {
    super.initState();
    if (widget.customer != null) {
      _selectedCustomer = widget.customer;
      _selectedParty = LedgerParty(
        name: widget.customer!.name,
        totalDue: widget.customer!.currentBalance,
        billCount: 1,
      );
      _step = 1;
    }
  }

  final _formKey = GlobalKey<FormState>();
  final _amountCtrl = TextEditingController();
  final _transactionIdCtrl = TextEditingController();
  final _remarksCtrl = TextEditingController();
  PaymentMethod _method = PaymentMethod.cash;
  DateTime _paymentDate = DateTime.now();

  final _money = NumberFormat('#,##0');

  @override
  void dispose() {
    _amountCtrl.dispose();
    _transactionIdCtrl.dispose();
    _remarksCtrl.dispose();
    super.dispose();
  }

  void _onPartySelected(LedgerParty party) {
    final customers = context.read<CustomerProvider>().customers;
    setState(() {
      _selectedParty = party;
      _selectedCustomer = customers.firstWhere(
        (c) => c.name == party.name,
        orElse: () => Customer(id: '', name: party.name),
      );
      _step = 1;
    });
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _paymentDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null && picked != _paymentDate) {
      setState(() => _paymentDate = picked);
    }
  }

  void _submitPayment() {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final received = double.tryParse(_amountCtrl.text) ?? 0;
    final outstandingBefore = _selectedParty!.totalDue;
    final outstandingAfter = outstandingBefore - received;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Payment'),
        content: _buildConfirmationDialogContent(
            outstandingBefore, received, outstandingAfter),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
              onPressed: _confirmPayment, child: const Text('Confirm')),
        ],
      ),
    );
  }

  Future<void> _confirmPayment() async {
    final payments = context.read<PaymentsProvider>();
    final outstandingBefore = _selectedParty!.totalDue;
    final payment = Payment(
      customerName: _selectedParty!.name,
      amount: double.tryParse(_amountCtrl.text) ?? 0,
      date: _paymentDate,
      method: _method,
      transactionId: _transactionIdCtrl.text,
      remarks: _remarksCtrl.text,
    );

    final success = await payments.addPayment(payment);
    if (!mounted) return;

    Navigator.of(context).pop(); // Close the confirmation dialog
    if (success) {
      // Also refresh the bills provider to update outstanding balances
      context
          .read<BillsProvider>()
          .syncFromDrive(withPayments: [...payments.payments, payment]);
      Navigator.of(context).pop();
      showAppSnackBar(context,
          'Payment of ₹${_money.format(payment.amount)} recorded successfully!');

      final pdfService = PaymentPdfService();
      final outstandingAfter = outstandingBefore - payment.amount;
      final pdfFile = await pdfService.generate(payment, outstandingAfter);
      _showPostPaymentOptions(payment, pdfFile);
    } else {
      showAppSnackBar(context, 'Error: ${payments.syncError}', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Collect Payment'),
        leading: _step > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() => _step--),
              )
            : null,
      ),
      body: IndexedStack(
        index: _step,
        children: [
          _buildPartySelection(), // index 0
          if (_selectedParty != null) _buildPaymentForm(), // index 1
        ],
      ),
    );
  }

  Widget _buildPartySelection() {
    final parties = context.watch<BillsProvider>().outstandingParties;
    final customers = context.watch<CustomerProvider>().customers;

    if (parties.isEmpty) {
      return const Center(
        child: Text('No parties with outstanding payments.'),
      );
    }

    return ListView.builder(
      itemCount: parties.length,
      itemBuilder: (context, index) {
        final party = parties[index];
        final customer = customers.firstWhere(
          (c) => c.name == party.name,
          orElse: () => Customer(id: '', name: party.name),
        );
        return ListTile(
          title: Text(party.name),
          subtitle: Text(customer.mobile),
          trailing: Text(
            'Due: ₹${_money.format(party.totalDue)}',
            style: const TextStyle(
                color: AppColors.red, fontWeight: FontWeight.w600),
          ),
          onTap: () => _onPartySelected(party),
        );
      },
    );
  }

  Widget _buildPaymentForm() {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(_selectedParty!.name,
              style: Theme.of(context).textTheme.headlineSmall),
          if (_selectedCustomer?.mobile.isNotEmpty ?? false)
            Text(_selectedCustomer!.mobile, style: AppTextStyles.body),
          const SizedBox(height: 8),
          Text(
            'Outstanding: ₹${_money.format(_selectedParty!.totalDue)}',
            style: const TextStyle(
                color: AppColors.red,
                fontSize: 16,
                fontWeight: FontWeight.bold),
          ),
          const Divider(height: 32),
          TextFormField(
            controller: _amountCtrl,
            decoration: const InputDecoration(
                labelText: 'Amount Received', prefixText: '₹'),
            keyboardType: TextInputType.number,
            validator: (v) => (double.tryParse(v ?? '') ?? 0) <= 0
                ? 'Enter a valid amount'
                : null,
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<PaymentMethod>(
            value: _method,
            decoration: const InputDecoration(labelText: 'Payment Method'),
            items: PaymentMethod.values
                .map((m) => DropdownMenuItem(value: m, child: Text(m.label)))
                .toList(),
            onChanged: (v) => setState(() => _method = v!),
          ),
          if (_method != PaymentMethod.cash) ...[
            const SizedBox(height: 16),
            TextFormField(
              controller: _transactionIdCtrl,
              decoration:
                  const InputDecoration(labelText: 'Transaction ID / UTR No.'),
            ),
          ],
          const SizedBox(height: 16),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Payment Date'),
            subtitle: Text(DateFormat.yMMMMd().format(_paymentDate)),
            trailing: const Icon(Icons.calendar_today),
            onTap: _selectDate,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _remarksCtrl,
            decoration: const InputDecoration(labelText: 'Remarks (Optional)'),
            maxLines: 2,
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: _submitPayment,
            child: const Text('Proceed to Confirmation'),
          ),
        ],
      ),
    );
  }

  Widget _confirmRow(String label, String value,
      {Color? valueColor, bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppTextStyles.body),
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConfirmationDialogContent(
      double before, double received, double after) {
    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Please confirm the details for ${_selectedParty!.name}:',
              style: AppTextStyles.subtitle),
          const Divider(height: 24),
          _confirmRow('Outstanding Before:', '₹${_money.format(before)}'),
          _confirmRow(
            'Received Amount:',
            '₹${_money.format(received)}',
            valueColor: AppColors.billGreen,
          ),
          const Divider(height: 16, thickness: 1),
          _confirmRow(
            'Outstanding After:',
            '₹${_money.format(after)}',
            isBold: true,
          ),
          const Divider(height: 24),
          _confirmRow('Payment Method:', _method.label),
          _confirmRow('Date:', DateFormat.yMMMMd().format(_paymentDate)),
        ],
      ),
    );
  }

  void _showPostPaymentOptions(Payment payment, File pdfFile) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(8.0),
            child: Wrap(
              children: <Widget>[
                ListTile(
                  leading: const Icon(Icons.share_outlined),
                  title: const Text('Share PDF'),
                  onTap: () async {
                    Navigator.of(ctx).pop();
                    await Printing.sharePdf(
                        bytes: await pdfFile.readAsBytes(),
                        filename: pdfFile.path.split('/').last);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.print_outlined),
                  title: const Text('Print Receipt'),
                  onTap: () async {
                    Navigator.of(ctx).pop();
                    await Printing.layoutPdf(
                        onLayout: (_) => pdfFile.readAsBytes());
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.download_outlined),
                  title: const Text('Download PDF'),
                  onTap: () async {
                    Navigator.of(ctx).pop();
                    try {
                      final downloadsDir = await getDownloadsDirectory();
                      if (downloadsDir != null) {
                        final newPath =
                            '${downloadsDir.path}/${pdfFile.path.split('/').last}';
                        await pdfFile.copy(newPath);
                        showAppSnackBar(context, 'Receipt saved to Downloads');
                      } else {
                        throw Exception('Could not access Downloads folder.');
                      }
                    } catch (e) {
                      showAppSnackBar(context, 'Download failed: $e',
                          isError: true);
                    }
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.cloud_upload_outlined),
                  title: const Text('Save to Google Drive'),
                  onTap: () async {
                    Navigator.of(ctx).pop();
                    showAppSnackBar(context, 'Uploading to Google Drive...');
                    try {
                      final driveService = GoogleDriveFileService();
                      await driveService.uploadPaymentReceipt(
                        date: payment.date,
                        paymentId: payment.id,
                        pdfFile: pdfFile,
                      );
                      showAppSnackBar(context,
                          'Receipt successfully uploaded to Google Drive.');
                    } catch (e) {
                      showAppSnackBar(context, 'Upload to Drive failed: $e',
                          isError: true);
                    }
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
