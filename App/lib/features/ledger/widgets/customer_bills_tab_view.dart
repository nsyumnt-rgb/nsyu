import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../models/customer.dart';
import '../../../models/saved_bill.dart';
import '../../../navigation/app_navigation.dart';
import '../../../providers/bills_provider.dart';
import '../../../providers/catalog_provider.dart';
import '../../../services/bill_pdf_service.dart';
import '../../../theme/app_theme.dart';
import '../../../screens/order_cart_screen.dart';

class CustomerBillsTabView extends StatelessWidget {
  final Customer? customer;
  final String partyName;
  final NumberFormat moneyFormatter;
  final DateFormat dateFormat;
  final DateFormat timeFormat;

  const CustomerBillsTabView({
    super.key,
    required this.customer,
    required this.partyName,
    required this.moneyFormatter,
    required this.dateFormat,
    required this.timeFormat,
  });

  @override
  Widget build(BuildContext context) {
    final billsProvider = context.watch<BillsProvider>();
    final customerBills = billsProvider.bills.where((b) {
      final matchesName = b.customerName.trim().toLowerCase() == partyName.trim().toLowerCase();
      final matchesPhone = customer?.mobile.isNotEmpty == true && b.customerPhone == customer!.mobile;
      return matchesName || matchesPhone;
    }).toList();

    final count = customerBills.length;
    final totalAmt = customerBills.fold(0.0, (s, b) => s + b.total);
    final totalPaid = customerBills.fold(0.0, (s, b) => s + b.paidAmount);
    final dueAmt = customerBills.fold(0.0, (s, b) => s + b.dueAmount);

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
      itemCount: customerBills.isEmpty ? 4 : customerBills.length + 3,
      itemBuilder: (context, index) {
        if (index == 0) {
          // KPI Row
          return Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  title: 'Total Bills',
                  value: '$count',
                  icon: Icons.receipt_long_outlined,
                  iconBg: const Color(0xFFF1F5F9),
                  iconColor: const Color(0xFF475569),
                  valueColor: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildKpiCard(
                  title: 'Total Amount',
                  value: '₹${moneyFormatter.format(totalAmt)}',
                  icon: Icons.currency_rupee,
                  iconBg: const Color(0xFFEFF6FF),
                  iconColor: const Color(0xFF2563EB),
                  valueColor: const Color(0xFF2563EB),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildKpiCard(
                  title: 'Total Paid',
                  value: '₹${moneyFormatter.format(totalPaid)}',
                  icon: Icons.check_circle_outline,
                  iconBg: const Color(0xFFDCFCE7),
                  iconColor: const Color(0xFF16A34A),
                  valueColor: const Color(0xFF16A34A),
                ),
              ),
            ],
          );
        }

        if (index == 1) {
          // Due & New Bill row
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFEE2E2)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(
                            color: Color(0xFFFEE2E2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.error_outline, color: Color(0xFFDC2626), size: 16),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Due Amount',
                              style: TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '₹${moneyFormatter.format(dueAmt)}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFFDC2626),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                InkWell(
                  onTap: () {
                    if (customer != null) {
                      context.read<CatalogProvider>().selectCustomer(customer!);
                    }
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const OrderCartScreen()),
                    );
                  },
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    height: 48,
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add, color: Colors.white, size: 18),
                        SizedBox(width: 4),
                        Text(
                          'New Bill',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        if (index == 2) {
          // Section title
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'Bills ($count)',
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
              ),
            ),
          );
        }

        if (customerBills.isEmpty) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.receipt_outlined, size: 40, color: Color(0xFFCBD5E1)),
                  SizedBox(height: 8),
                  Text(
                    'No bills found for this customer',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF475569)),
                  ),
                ],
              ),
            ),
          );
        }

        final bill = customerBills[index - 3];
        return _buildCustomerBillCard(context, bill);
      },
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required Color valueColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
                child: Icon(icon, color: iconColor, size: 14),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: valueColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildCustomerBillCard(BuildContext context, SavedBill bill) {
    final statusStr = bill.isPaid ? 'Paid' : (bill.paidAmount > 0 ? 'Partial' : 'Unpaid');
    final billNo = bill.billNumber.replaceAll(RegExp(r'^[#B\-]'), '');
    final date = dateFormat.format(bill.date);
    final time = timeFormat.format(bill.date);

    Color badgeBg = const Color(0xFFDCFCE7);
    Color badgeFg = const Color(0xFF16A34A);
    if (statusStr == 'Unpaid') {
      badgeBg = const Color(0xFFFEE2E2);
      badgeFg = const Color(0xFFDC2626);
    } else if (statusStr == 'Partial') {
      badgeBg = const Color(0xFFFEF3C7);
      badgeFg = const Color(0xFFD97706);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {
              AppNavigation.openBillDetails(context, bill: bill, invoiceNo: billNo);
            },
            borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.receipt_long_outlined, size: 20, color: Color(0xFF0F172A)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  'Bill #$billNo',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: badgeBg,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    statusStr,
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w700,
                                      color: badgeFg,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '$date   $time',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            children: [
                              Text(
                                '₹${moneyFormatter.format(bill.total)}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                  color: statusStr == 'Paid' ? const Color(0xFF16A34A) : const Color(0xFFEA580C),
                                ),
                              ),
                              const Icon(Icons.chevron_right, size: 16, color: Color(0xFF94A3B8)),
                            ],
                          ),
                          if (statusStr == 'Partial') ...[
                            const SizedBox(height: 2),
                            Text(
                              'Paid: ₹${moneyFormatter.format(bill.paidAmount)} | Due: ₹${moneyFormatter.format(bill.dueAmount)}',
                              style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.description_outlined, size: 13, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(
                        '${bill.items.length} Items',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildBillAction(Icons.visibility_outlined, 'View', () {
                  AppNavigation.openBillDetails(context, bill: bill, invoiceNo: billNo);
                }),
                _buildBillAction(Icons.print_outlined, 'Print', () async {
                  try {
                    await BillPdfService.previewAndPrint(bill.toPdfData());
                  } catch (_) {
                    if (context.mounted) showAppSnackBar(context, 'Printing Bill #$billNo');
                  }
                }),
                _buildBillAction(Icons.share_outlined, 'Share', () async {
                  try {
                    await BillPdfService.shareBill(bill.toPdfData());
                  } catch (_) {
                    Share.share('Bill #$billNo - Amount: ₹${moneyFormatter.format(bill.total)}');
                  }
                }),
                _buildBillAction(Icons.chat_bubble_outline, 'WhatsApp', () {
                  final phone = customer?.mobile ?? '';
                  final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
                  if (digits.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Customer phone number not available')));
                    return;
                  }
                  launchUrl(Uri.parse('https://wa.me/$digits?text=Hello,%20here%20is%20your%20bill%20%23$billNo%20for%20%E2%82%B9${moneyFormatter.format(bill.total)}'), mode: LaunchMode.externalApplication);
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBillAction(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Row(
          children: [
            Icon(icon, size: 14, color: const Color(0xFF475569)),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF475569),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
