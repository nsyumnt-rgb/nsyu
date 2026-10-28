import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/supabase_service.dart';
import '../theme/app_theme.dart';

class ActivityLogScreen extends StatefulWidget {
  const ActivityLogScreen({super.key});

  @override
  State<ActivityLogScreen> createState() => _ActivityLogScreenState();
}

class _ActivityLogScreenState extends State<ActivityLogScreen> {
  final _supabase = SupabaseService();
  final List<String> _modules = ['All', 'Shops', 'Products', 'Inventory', 'Sales', 'Payments', 'Settings'];
  String _selectedModule = 'All';

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _logs = [];

  @override
  void initState() {
    super.initState();
    _loadLogs();
  }

  Future<void> _loadLogs() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final logs = await _supabase.fetchActivityLogs(
        module: _selectedModule == 'All' ? null : _selectedModule,
        limit: 100,
      );
      if (!mounted) return;
      setState(() {
        _logs = logs;
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

  IconData _iconForModule(String module) {
    switch (module.toLowerCase()) {
      case 'shops':
        return Icons.storefront_outlined;
      case 'products':
        return Icons.inventory_2_outlined;
      case 'inventory':
        return Icons.swap_horiz_rounded;
      case 'sales':
      case 'billing':
        return Icons.receipt_long_outlined;
      case 'payments':
        return Icons.payment_outlined;
      case 'settings':
        return Icons.settings_outlined;
      case 'employees':
        return Icons.people_outline;
      default:
        return Icons.history_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Activity Log', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadLogs,
            tooltip: 'Refresh Logs',
          ),
        ],
      ),
      body: Column(
        children: [
          _filterChips(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadLogs,
              child: _buildBody(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChips() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: _modules.map((m) {
            final isSelected = _selectedModule == m;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(m),
                selected: isSelected,
                onSelected: (selected) {
                  if (selected) {
                    setState(() => _selectedModule = m);
                    _loadLogs();
                  }
                },
                selectedColor: const Color(0xFF1565C0),
                labelStyle: TextStyle(
                  color: isSelected ? Colors.white : const Color(0xFF475569),
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  fontSize: 13,
                ),
                backgroundColor: const Color(0xFFF1F5F9),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 40),
          const Icon(Icons.error_outline, size: 48, color: AppColors.muted),
          const SizedBox(height: 16),
          Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 16),
          Center(
            child: ElevatedButton(onPressed: _loadLogs, child: const Text('Retry')),
          ),
        ],
      );
    }

    if (_logs.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: const [
          SizedBox(height: 60),
          Icon(Icons.history_toggle_off_rounded, size: 48, color: AppColors.muted),
          SizedBox(height: 16),
          Center(
            child: Text(
              'No activity records found for this module.',
              style: TextStyle(color: AppColors.muted, fontSize: 14),
            ),
          ),
        ],
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _logs.length,
      itemBuilder: (context, index) {
        final log = _logs[index];
        return _buildLogCard(log);
      },
    );
  }

  Widget _buildLogCard(Map<String, dynamic> log) {
    final module = log['module']?.toString() ?? 'system';
    final action = log['action']?.toString() ?? 'action';
    final actorName = log['actorName']?.toString() ?? 'User';
    final actorType = log['actorType']?.toString() ?? 'owner';
    final shopName = log['shopName']?.toString() ?? 'Main Store';
    final entityType = log['entityType']?.toString();
    final entityId = log['entityId'];
    final outcome = log['outcome']?.toString() ?? 'Success';

    DateTime? createdAt;
    if (log['createdAt'] != null) {
      createdAt = DateTime.tryParse(log['createdAt'].toString());
    }

    final formattedDate = createdAt != null
        ? DateFormat('dd MMM yyyy, hh:mm a').format(createdAt.toLocal())
        : 'Just now';

    return Card(
      elevation: 1.5,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(_iconForModule(module), color: const Color(0xFF1E88E5), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${action.replaceAll('_', ' ').toUpperCase()} · ${module.toUpperCase()}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        formattedDate,
                        style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDCFCE7),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    outcome,
                    style: const TextStyle(color: Color(0xFF15803D), fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(Icons.person_outline, size: 15, color: AppColors.muted),
                const SizedBox(width: 6),
                Text(
                  '$actorName (${actorType == 'owner' ? 'Owner' : 'Staff'})',
                  style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                ),
                const Spacer(),
                const Icon(Icons.storefront_outlined, size: 15, color: AppColors.muted),
                const SizedBox(width: 6),
                Text(
                  shopName,
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
            if (entityType != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.link, size: 15, color: Color(0xFF2563EB)),
                  const SizedBox(width: 6),
                  Text(
                    'Reference: $entityType${entityId != null ? ' #$entityId' : ''}',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF2563EB), fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
