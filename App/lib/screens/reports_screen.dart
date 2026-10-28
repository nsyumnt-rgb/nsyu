import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/supabase_service.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final SupabaseService _supabaseService = SupabaseService();
  final NumberFormat _money = NumberFormat('#,##0.00');

  void _openReportViewer(String title, String endpoint, IconData icon, Color color) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ReportModalViewer(
        title: title,
        endpoint: endpoint,
        icon: icon,
        color: color,
        supabaseService: _supabaseService,
        money: _money,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Reports',
          style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700, fontSize: 18),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          // Section 1: Sales Report
          _sectionHeader('Sales Report'),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 2.1,
            children: [
              _reportCard(
                title: 'Daily Sales',
                icon: Icons.bar_chart_rounded,
                iconColor: const Color(0xFF1D4ED8),
                bgColor: const Color(0xFFEFF6FF),
                onTap: () => _openReportViewer('Daily Sales Report', 'sales/daily', Icons.bar_chart_rounded, const Color(0xFF1D4ED8)),
              ),
              _reportCard(
                title: 'Monthly Sales',
                icon: Icons.calendar_month_rounded,
                iconColor: const Color(0xFF0284C7),
                bgColor: const Color(0xFFF0F9FF),
                onTap: () => _openReportViewer('Monthly Sales Report', 'sales/monthly', Icons.calendar_month_rounded, const Color(0xFF0284C7)),
              ),
              _reportCard(
                title: 'Product Wise',
                icon: Icons.inventory_2_rounded,
                iconColor: const Color(0xFF16A34A),
                bgColor: const Color(0xFFF0FDF4),
                onTap: () => _openReportViewer('Product-Wise Sales', 'sales/by-product', Icons.inventory_2_rounded, const Color(0xFF16A34A)),
              ),
              _reportCard(
                title: 'Customer Wise',
                icon: Icons.people_alt_rounded,
                iconColor: const Color(0xFFEA580C),
                bgColor: const Color(0xFFFFF7ED),
                onTap: () => _openReportViewer('Customer-Wise Sales', 'sales/by-customer', Icons.people_alt_rounded, const Color(0xFFEA580C)),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Section 2: Purchase Report
          _sectionHeader('Purchase Report'),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 2.1,
            children: [
              _reportCard(
                title: 'Daily Purchase',
                icon: Icons.insert_chart_outlined_rounded,
                iconColor: const Color(0xFFDC2626),
                bgColor: const Color(0xFFFEF2F2),
                onTap: () => _openReportViewer('Daily Purchase Report', 'purchases/daily', Icons.insert_chart_outlined_rounded, const Color(0xFFDC2626)),
              ),
              _reportCard(
                title: 'Supplier Wise',
                icon: Icons.local_shipping_rounded,
                iconColor: const Color(0xFF2563EB),
                bgColor: const Color(0xFFEFF6FF),
                onTap: () => _openReportViewer('Supplier-Wise Purchases', 'purchases/by-supplier', Icons.local_shipping_rounded, const Color(0xFF2563EB)),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Section 3: Inventory Report
          _sectionHeader('Inventory Report'),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 2.1,
            children: [
              _reportCard(
                title: 'Stock Summary',
                icon: Icons.warehouse_rounded,
                iconColor: const Color(0xFF0284C7),
                bgColor: const Color(0xFFF0F9FF),
                onTap: () => _openReportViewer('Stock Summary Report', 'inventory/stock-summary', Icons.warehouse_rounded, const Color(0xFF0284C7)),
              ),
              _reportCard(
                title: 'Low Stock',
                icon: Icons.warning_amber_rounded,
                iconColor: const Color(0xFFD97706),
                bgColor: const Color(0xFFFFFBEB),
                onTap: () => _openReportViewer('Low Stock Alerts', 'inventory/low-stock', Icons.warning_amber_rounded, const Color(0xFFD97706)),
              ),
              _reportCard(
                title: 'Stock Movement',
                icon: Icons.swap_vert_rounded,
                iconColor: const Color(0xFF059669),
                bgColor: const Color(0xFFECFDF5),
                onTap: () => _openReportViewer('Stock Movement Audit', 'inventory/movement', Icons.swap_vert_rounded, const Color(0xFF059669)),
              ),
              _reportCard(
                title: 'Stock Transfer',
                icon: Icons.move_down_rounded,
                iconColor: const Color(0xFF4F46E5),
                bgColor: const Color(0xFFEEF2FF),
                onTap: () => _openReportViewer('Shop Stock Transfers', 'inventory/transfers', Icons.move_down_rounded, const Color(0xFF4F46E5)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: Color(0xFF0F172A),
      ),
    );
  }

  Widget _reportCard({
    required String title,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      elevation: 0,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1E293B),
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReportModalViewer extends StatefulWidget {
  final String title;
  final String endpoint;
  final IconData icon;
  final Color color;
  final SupabaseService supabaseService;
  final NumberFormat money;

  const _ReportModalViewer({
    required this.title,
    required this.endpoint,
    required this.icon,
    required this.color,
    required this.supabaseService,
    required this.money,
  });

  @override
  State<_ReportModalViewer> createState() => _ReportModalViewerState();
}

class _ReportModalViewerState extends State<_ReportModalViewer> {
  bool _loading = true;
  String? _error;
  dynamic _data;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final res = await widget.supabaseService.fetchReport(widget.endpoint);
      if (!mounted) return;
      setState(() {
        _data = res['data'] ?? res;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFCBD5E1),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Row(
              children: [
                Icon(widget.icon, color: widget.color, size: 24),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    widget.title,
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Color(0xFF64748B)),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF1D4ED8)))
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline, size: 36, color: Colors.red),
                              const SizedBox(height: 10),
                              Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF64748B))),
                              const SizedBox(height: 12),
                              ElevatedButton(onPressed: _fetch, child: const Text('Retry')),
                            ],
                          ),
                        ),
                      )
                    : _buildContent(),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_data == null || (_data is List && (_data as List).isEmpty)) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.assessment_outlined, size: 48, color: Color(0xFF94A3B8)),
            SizedBox(height: 12),
            Text('No records found for this period', style: TextStyle(color: Color(0xFF64748B))),
          ],
        ),
      );
    }

    if (_data is List) {
      final list = _data as List;
      return ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (ctx, i) {
          final item = list[i];
          final title = item['name'] ?? item['title'] ?? item['product_name'] ?? item['customer_name'] ?? item['date'] ?? 'Record #${i + 1}';
          final sub = item['reference_code'] ?? item['sku'] ?? item['phone'] ?? item['count']?.toString() ?? '';
          final total = item['total_sales'] ?? item['total_amount'] ?? item['current_stock'] ?? item['amount'];

          return ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(title.toString(), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
            subtitle: sub.toString().isNotEmpty ? Text(sub.toString(), style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))) : null,
            trailing: total != null
                ? Text(
                    total is num ? '₹${widget.money.format(total)}' : total.toString(),
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: Color(0xFF0F172A)),
                  )
                : null,
          );
        },
      );
    }

    if (_data is Map) {
      final map = _data as Map;
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final entry in map.entries)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(entry.key.toString(), style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                  Text(entry.value.toString(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                ],
              ),
            ),
        ],
      );
    }

    return Center(child: Text(_data.toString()));
  }
}
