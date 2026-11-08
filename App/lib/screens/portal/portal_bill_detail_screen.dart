import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
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

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Invoice Details')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null || _bill == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Invoice Details')),
        body: Center(child: Text(_error ?? 'Invoice not found')),
      );
    }

    final invNum = _bill!['invoice_number']?.toString() ?? 'INV-${widget.billId}';
    final shop = (_bill!['shop'] as Map<String, dynamic>?) ?? {};
    final cust = (_bill!['customer'] as Map<String, dynamic>?) ?? {};
    final items = (_bill!['items'] as List<dynamic>?) ?? [];
    final total = ((_bill!['total_amount'] ?? 0) as num).toDouble();
    final paid = ((_bill!['paid_amount'] ?? 0) as num).toDouble();
    final balanceDue = total - paid;
    final dt = _bill!['createdAt']?.toString() ?? _bill!['date']?.toString();
    final dateStr = dt != null ? DateFormat('dd MMM yyyy').format(DateTime.parse(dt)) : '';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF047857),
        elevation: 0,
        title: Text(
          invNum,
          style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
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
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        shop['name']?.toString() ?? 'Shop',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                      ),
                      Text(dateStr, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                    ],
                  ),
                  if (shop['address'] != null)
                    Text(shop['address'].toString(), style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  if (shop['gstin'] != null)
                    Text('GSTIN: ${shop['gstin']}', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                  const Divider(height: 20),

                  // Billed To
                  const Text('BILLED TO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
                  const SizedBox(height: 4),
                  Text(
                    cust['name']?.toString() ?? 'Customer',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                  if (cust['phone'] != null)
                    Text('Phone: +91 ${cust['phone']}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                  if (cust['address'] != null)
                    Text(cust['address'].toString(), style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Items List
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text('Invoice Items', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A))),
                  ),
                  const Divider(height: 1),
                  ...items.map((it) {
                    final pName = it['product_name']?.toString() ?? 'Item';
                    final q = (it['quantity'] as num).toInt();
                    final rate = ((it['unit_price'] ?? 0) as num).toDouble();
                    final lineTot = ((it['line_total'] ?? it['total'] ?? q * rate) as num).toDouble();

                    return ListTile(
                      title: Text(pName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      subtitle: Text('Qty: $q × ₹${rate.toStringAsFixed(2)}', style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                      trailing: Text(
                        '₹${lineTot.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0F172A)),
                      ),
                    );
                  }),
                  const Divider(height: 1),

                  // Totals
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Total Amount', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                            Text('₹${total.toStringAsFixed(2)}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Paid Amount', style: TextStyle(fontSize: 12, color: Color(0xFF047857))),
                            Text('₹${paid.toStringAsFixed(2)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Balance Due', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFE11D48))),
                            Text(
                              '₹${balanceDue > 0 ? balanceDue.toStringAsFixed(2) : "0.00"}',
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFFE11D48)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

