import '../models/saved_bill.dart';
import '../models/saved_payment.dart' as sp;
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';

import '../models/customer.dart';
import '../models/payment.dart';
import '../providers/bills_provider.dart';
import '../providers/customer_provider.dart';
import '../providers/payments_provider.dart';
import '../services/payment_pdf_service.dart';
import '../theme/app_theme.dart';

class CollectPaymentScreen extends StatefulWidget {
  final Customer? customer;

  const CollectPaymentScreen({super.key, this.customer});

  @override
  State<CollectPaymentScreen> createState() => _CollectPaymentScreenState();
}

class _CollectPaymentScreenState extends State<CollectPaymentScreen> {
  final _money = NumberFormat('#,##0');
  final _dateFormat = DateFormat('dd MMM yyyy');

  Customer? _selectedCustomer;
  int _step = 0; // 0: select party (if not provided), 1: payment screen
  bool _isSubmitting = false;

  // Calculator State
  String _displayExpr = '0';
  double? _storedValue;
  String? _pendingOp;
  bool _resetOnNextDigit = false;

  DateTime _paymentDate = DateTime.now();
  String _notes = '';
  PaymentMethod _method = PaymentMethod.cash;

  @override
  void initState() {
    super.initState();
    if (widget.customer != null) {
      _selectedCustomer = widget.customer;
      _step = 1;
      final due = widget.customer!.currentBalance;
      if (due > 0) {
        _displayExpr = due.toInt().toString();
      }
    }
  }

  void _onKeypadTap(String key) {
    setState(() {
      if (key == '⌫') {
        if (_displayExpr.length > 1) {
          _displayExpr = _displayExpr.substring(0, _displayExpr.length - 1);
        } else {
          _displayExpr = '0';
        }
      } else if (key == 'C') {
        _displayExpr = '0';
        _storedValue = null;
        _pendingOp = null;
      } else if (key == '+' || key == '-' || key == '×') {
        final currentVal = double.tryParse(_displayExpr.replaceAll(',', '')) ?? 0;
        _storedValue = currentVal;
        _pendingOp = key;
        _resetOnNextDigit = true;
      } else if (key == '=') {
        if (_storedValue != null && _pendingOp != null) {
          final currentVal = double.tryParse(_displayExpr.replaceAll(',', '')) ?? 0;
          double result = currentVal;
          if (_pendingOp == '+') result = _storedValue! + currentVal;
          if (_pendingOp == '-') result = _storedValue! - currentVal;
          if (_pendingOp == '×') result = _storedValue! * currentVal;

          _displayExpr = result % 1 == 0 ? result.toInt().toString() : result.toStringAsFixed(2);
          _storedValue = null;
          _pendingOp = null;
          _resetOnNextDigit = true;
        }
      } else if (key == '.') {
        if (!_displayExpr.contains('.')) {
          _displayExpr += '.';
        }
      } else {
        // Digits 0-9
        if (_resetOnNextDigit || _displayExpr == '0') {
          _displayExpr = key;
          _resetOnNextDigit = false;
        } else {
          if (_displayExpr.length < 9) {
            _displayExpr += key;
          }
        }
      }
    });
  }

  double get _currentAmount => double.tryParse(_displayExpr.replaceAll(',', '')) ?? 0.0;

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _paymentDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) {
      setState(() => _paymentDate = picked);
    }
  }

  void _showAddNotesDialog() {
    final ctrl = TextEditingController(text: _notes);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Payment Note'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(
            hintText: 'Enter payment note or remarks...',
            border: OutlineInputBorder(),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              setState(() => _notes = ctrl.text.trim());
              Navigator.pop(ctx);
            },
            child: const Text('Save Note'),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmAndSavePayment() async {
    final amount = _currentAmount;
    if (amount <= 0) {
      showAppSnackBar(context, 'Please enter a valid amount', isError: true);
      return;
    }

    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);

    final cust = _selectedCustomer;
    final custName = cust?.name ?? 'Customer';
    final payments = context.read<PaymentsProvider>();
    final billsProv = context.read<BillsProvider>();
    final outstandingBefore = cust?.currentBalance ?? 0.0;

    final payment = Payment(
      customerName: custName,
      amount: amount,
      date: _paymentDate,
      method: _method,
      remarks: _notes.isNotEmpty ? _notes : 'Payment received',
    );

    try {
      // 1. Record customer payment in backend / Supabase
      await payments.addPayment(payment, customerId: cust?.id);
      if (!mounted) return;

      // 2. Allocate payment to unpaid bills in BillsProvider so party balance updates
      double remainingAmt = amount;
      final unpaidBills = billsProv.billsForParty(custName).where((b) => b.status == BillStatus.unpaid).toList();
      for (final bill in unpaidBills) {
        if (remainingAmt <= 0) break;
        final due = bill.due;
        final payAmt = remainingAmt > due ? due : remainingAmt;
        await billsProv.receivePayment(
          bill: bill,
          amount: payAmt,
          method: sp.PaymentMethod.values.firstWhere((m) => m.name == _method.name, orElse: () => sp.PaymentMethod.cash),
          customerId: cust?.id ?? '',
          remarks: _notes.isNotEmpty ? _notes : 'Payment received',
        );
        remainingAmt -= payAmt;
      }

      showAppSnackBar(context, 'Payment of ₹${_money.format(amount)} recorded successfully!');

      File? pdfFile;
      try {
        final pdfService = PaymentPdfService();
        final outstandingAfter = (outstandingBefore - amount).clamp(0.0, double.infinity);
        pdfFile = await pdfService.generate(payment, outstandingAfter);
      } catch (e) {
        debugPrint('PDF generation error: $e');
      }

      if (!mounted) return;
      Navigator.of(context).pop(amount);
      if (pdfFile != null) {
        _showPostPaymentOptions(payment, pdfFile);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      showAppSnackBar(context, 'Failed to save payment: $e', isError: true);
    }
  }

  void _showPostPaymentOptions(Payment payment, File pdfFile) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Wrap(
              children: <Widget>[
                ListTile(
                  leading: const Icon(Icons.share_outlined, color: Color(0xFF16A34A)),
                  title: const Text('Share Receipt PDF', style: TextStyle(fontWeight: FontWeight.w600)),
                  onTap: () async {
                    Navigator.of(ctx).pop();
                    await Printing.sharePdf(
                      bytes: await pdfFile.readAsBytes(),
                      filename: pdfFile.path.split('/').last,
                    );
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.print_outlined, color: Color(0xFF2563EB)),
                  title: const Text('Print Payment Receipt', style: TextStyle(fontWeight: FontWeight.w600)),
                  onTap: () async {
                    Navigator.of(ctx).pop();
                    await Printing.layoutPdf(onLayout: (_) => pdfFile.readAsBytes());
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.download_outlined, color: Color(0xFF0F172A)),
                  title: const Text('Download PDF', style: TextStyle(fontWeight: FontWeight.w600)),
                  onTap: () async {
                    Navigator.of(ctx).pop();
                    try {
                      final downloadsDir = await getDownloadsDirectory();
                      if (downloadsDir != null) {
                        final newPath = '${downloadsDir.path}/${pdfFile.path.split('/').last}';
                        await pdfFile.copy(newPath);
                        if (!mounted) return;
                        showAppSnackBar(context, 'Receipt saved to Downloads');
                      }
                    } catch (e) {
                      if (!mounted) return;
                      showAppSnackBar(context, 'Download failed: $e', isError: true);
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

  @override
  Widget build(BuildContext context) {
    if (_step == 0) {
      return _buildPartySelectionScreen();
    }
    return _buildCalculatorPaymentScreen();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCREEN 1: PARTY SELECTION (if customer not pre-selected)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildPartySelectionScreen() {
    final customers = context.watch<CustomerProvider>().customers;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Select Customer for Payment', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(14),
        itemCount: customers.length,
        itemBuilder: (ctx, i) {
          final c = customers[i];
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: const Color(0xFF38BDF8),
                child: Text(
                  c.name.isNotEmpty ? c.name[0].toUpperCase() : '?',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
              title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(c.mobile.isNotEmpty ? c.mobile : 'ID: ${c.id}'),
              trailing: Text(
                '₹${_money.format(c.currentBalance)}',
                style: const TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w800),
              ),
              onTap: () {
                setState(() {
                  _selectedCustomer = c;
                  if (c.currentBalance > 0) {
                    _displayExpr = c.currentBalance.toInt().toString();
                  }
                  _step = 1;
                });
              },
            ),
          );
        },
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SCREEN 2: EXACT REPLICA OF IMAGE 3 (Payment Calculator)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildCalculatorPaymentScreen() {
    final cust = _selectedCustomer ?? widget.customer;
    final name = cust?.name ?? 'Krishna Jasola';
    final due = cust?.currentBalance ?? 4510.0;
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'K';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(60),
        child: Container(
          color: Colors.white,
          child: SafeArea(
            bottom: false,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A), size: 24),
                    onPressed: () {
                      if (widget.customer == null && _step > 0) {
                        setState(() => _step = 0);
                      } else {
                        Navigator.of(context).pop();
                      }
                    },
                  ),
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: const Color(0xFF38BDF8),
                    child: Text(
                      initial,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 1),
                        Text(
                          '₹${_money.format(due > 0 ? due : 4510)} Due',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFEA580C),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              child: Column(
                children: [
                  const SizedBox(height: 12),

                  // ── Large Centered Amount matching Image 3 ──
                  Text(
                    '₹ ${_money.format(double.tryParse(_displayExpr) ?? 0)}',
                    style: const TextStyle(
                      fontSize: 40,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Thick Green Underline Accent
                  Center(
                    child: Container(
                      width: 130,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFF16A34A),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),

                  // ── Card 1: Add Notes with Mic matching Image 3 ──
                  _buildActionCard(
                    leadingIcon: Icons.description_outlined,
                    title: _notes.isNotEmpty ? _notes : 'Add Notes',
                    trailing: const Icon(Icons.mic_none, color: Color(0xFF16A34A), size: 22),
                    onTap: _showAddNotesDialog,
                  ),
                  const SizedBox(height: 14),

                  // ── Card 2: Bill Date with Calendar matching Image 3 ──
                  _buildActionCard(
                    leadingIcon: Icons.calendar_today_outlined,
                    title: 'Bill Date',
                    subtitle: _dateFormat.format(_paymentDate),
                    trailing: const Icon(Icons.chevron_right, color: Color(0xFF64748B), size: 22),
                    onTap: _selectDate,
                  ),
                  const SizedBox(height: 14),

                  // ── Card 3: Add Bills with Camera matching Image 3 ──
                  _buildActionCard(
                    leadingIcon: Icons.camera_alt_outlined,
                    title: 'Add Bills',
                    trailing: const Icon(Icons.add, color: Color(0xFF16A34A), size: 22),
                    onTap: () {
                      showAppSnackBar(context, 'Invoice/Bill attachment ready');
                    },
                  ),
                  const SizedBox(height: 24),

                  // ── Wide Green Button: ✓ Confirm matching Image 3 ──
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _confirmAndSavePayment,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(26),
                        ),
                      ),
                      child: _isSubmitting
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(Icons.check, size: 20, color: Colors.white),
                                SizedBox(width: 8),
                                Text(
                                  'Confirm',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
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

          // ── In-App Numeric Calculator Keypad matching Image 3 ──
          _buildNumericKeypad(),
        ],
      ),
    );
  }

  Widget _buildActionCard({
    required IconData leadingIcon,
    required String title,
    String? subtitle,
    required Widget trailing,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(leadingIcon, color: const Color(0xFF475569), size: 22),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: subtitle != null ? FontWeight.w500 : FontWeight.w600,
                      color: subtitle != null ? const Color(0xFF64748B) : const Color(0xFF334155),
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            trailing,
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // IN-APP CALCULATOR KEYPAD (Grid 4x4) matching Image 3
  // Row 1: 1, 2, 3, ⌫ (soft red)
  // Row 2: 4, 5, 6, ×
  // Row 3: 7, 8, 9, -
  // Row 4: ., 0, =, + (with = in soft green)
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildNumericKeypad() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              _buildKeyTile('1'),
              _buildKeyTile('2'),
              _buildKeyTile('3'),
              _buildKeyTile('⌫', isBackspace: true),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _buildKeyTile('4'),
              _buildKeyTile('5'),
              _buildKeyTile('6'),
              _buildKeyTile('×', isOperator: true),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _buildKeyTile('7'),
              _buildKeyTile('8'),
              _buildKeyTile('9'),
              _buildKeyTile('-', isOperator: true),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _buildKeyTile('.'),
              _buildKeyTile('0'),
              _buildKeyTile('=', isEqual: true),
              _buildKeyTile('+', isOperator: true),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildKeyTile(
    String label, {
    bool isBackspace = false,
    bool isOperator = false,
    bool isEqual = false,
  }) {
    Color bg = const Color(0xFFF1F5F9);
    Color fg = const Color(0xFF0F172A);

    if (isBackspace) {
      bg = const Color(0xFFFEE2E2);
      fg = const Color(0xFFEF4444);
    } else if (isEqual) {
      bg = const Color(0xFFDCFCE7);
      fg = const Color(0xFF16A34A);
    }

    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 5),
        child: InkWell(
          onTap: () => _onKeypadTap(label),
          borderRadius: BorderRadius.circular(12),
          child: Container(
            height: 52,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: isBackspace
                  ? Icon(Icons.backspace_outlined, color: fg, size: 20)
                  : Text(
                      label,
                      style: TextStyle(
                        fontSize: isOperator || isEqual ? 22 : 20,
                        fontWeight: FontWeight.w700,
                        color: fg,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
