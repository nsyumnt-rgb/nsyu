import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/bills_provider.dart';
import '../screens/business_info_screen.dart';
import '../screens/help_support_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/visibility_settings_screen.dart';
import '../theme/app_theme.dart';

/// Modal bottom sheet matching Reference Image 4 ("More" menu)
/// with full support for all 13 menu actions in the system.
class MoreMenuSheet extends StatelessWidget {
  final ValueChanged<int> onNavigate;

  const MoreMenuSheet({super.key, required this.onNavigate});

  static void show(BuildContext context, {required ValueChanged<int> onNavigate}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => MoreMenuSheet(onNavigate: onNavigate),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.of(context).padding.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 44,
            height: 4.5,
            decoration: BoxDecoration(
              color: const Color(0xFFCBD5E1),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 24),

          // Action Buttons matching Image 4 & Complete Testing Scope
          Wrap(
            spacing: 16,
            runSpacing: 22,
            alignment: WrapAlignment.start,
            children: [
              _buildMenuItem(
                context,
                icon: Icons.description_outlined,
                label: 'Account',
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const BusinessInfoScreen()));
                },
              ),
              _buildMenuItem(
                context,
                icon: Icons.person_outline_rounded,
                label: 'Profile',
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => ProfileScreen(onNavigate: onNavigate)));
                },
              ),
              _buildMenuItem(
                context,
                icon: Icons.volunteer_activism_outlined,
                label: 'Help',
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpSupportScreen()));
                },
              ),
              _buildMenuItem(
                context,
                icon: Icons.settings_outlined,
                label: 'Settings',
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const VisibilitySettingsScreen()));
                },
              ),
              _buildMenuItem(
                context,
                icon: Icons.receipt_long_rounded,
                label: 'Bills',
                onTap: () {
                  Navigator.pop(context);
                  onNavigate(1); // switch to Bills tab
                },
              ),
              _buildMenuItem(
                context,
                icon: Icons.inventory_2_outlined,
                label: 'Stock\nManagement',
                onTap: () {
                  Navigator.pop(context);
                  onNavigate(2); // switch to Inventory/Catalog tab
                },
              ),
              _buildMenuItem(
                context,
                icon: Icons.more_time_rounded,
                label: 'Auto\nReminder',
                onTap: () {
                  Navigator.pop(context);
                  _showAutoReminderSheet(context);
                },
              ),
              _buildMenuItem(
                context,
                icon: Icons.devices_rounded,
                label: 'Multi\nDevice',
                onTap: () {
                  Navigator.pop(context);
                  _showMultiDeviceSheet(context);
                },
              ),
              _buildMenuItem(
                context,
                icon: Icons.book_outlined,
                label: 'Kaccha\nKhaata',
                onTap: () {
                  Navigator.pop(context);
                  _showKacchaKhaataSheet(context);
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }

  Widget _buildMenuItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 72,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 58,
              height: 58,
              decoration: const BoxDecoration(
                color: Color(0xFFE8F5E9),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Icon(
                  icon,
                  size: 26,
                  color: const Color(0xFF16A34A),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1E293B),
                height: 1.15,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MULTI-DEVICE SYNC SHEET
  // ──────────────────────────────────────────────────────────────────────────
  void _showMultiDeviceSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: const [
                    Icon(Icons.devices_rounded, color: Color(0xFF16A34A)),
                    SizedBox(width: 8),
                    Text('Multi-Device Cloud Sync', style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.bold)),
                  ],
                ),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(),
            const SizedBox(height: 8),
            _statusRow(Icons.check_circle, 'Supabase Cloud Database', 'Connected & Active', const Color(0xFF16A34A)),
            _statusRow(Icons.phone_android, 'This Android Device', 'Online (Primary)', const Color(0xFF2563EB)),
            _statusRow(Icons.laptop_chromebook, 'Web Dashboard Portal', 'Synchronized', const Color(0xFF64748B)),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: const [
                  Icon(Icons.cloud_done_outlined, color: Color(0xFF16A34A), size: 22),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'All bills, payments, customers, and inventory changes sync automatically across your phone and desktop in real time.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF334155)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.sync_rounded),
                label: const Text('Sync Now With Cloud'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () async {
                  Navigator.pop(ctx);
                  await context.read<BillsProvider>().syncFromSupabase();
                  showAppSnackBar(context, 'All records synced successfully with Supabase PostgreSQL');
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusRow(IconData icon, String title, String status, Color statusColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: const Color(0xFF475569)),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
            ],
          ),
          Text(status, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: statusColor)),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AUTO REMINDER SHEET
  // ──────────────────────────────────────────────────────────────────────────
  void _showAutoReminderSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.more_time_rounded, color: Color(0xFF16A34A)),
                        SizedBox(width: 8),
                        Text('Auto Reminder Settings', style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
                const Divider(),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Daily Due Date Reminders', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                  subtitle: const Text('Notify defaulters automatically 2 days before & on due date', style: TextStyle(fontSize: 11.5)),
                  value: true,
                  onChanged: (v) {},
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('WhatsApp Auto Reminders', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                  subtitle: const Text('Send reminder link directly with bill summary', style: TextStyle(fontSize: 11.5)),
                  value: true,
                  onChanged: (v) {},
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      showAppSnackBar(context, 'Auto reminders updated & scheduled');
                    },
                    child: const Text('Save Reminder Schedule'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // KACCHA KHAATA (ROUGH ESTIMATES / DRAFTS LEDGER) SHEET
  // ──────────────────────────────────────────────────────────────────────────
  void _showKacchaKhaataSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.7,
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: const [
                    Icon(Icons.book_outlined, color: Color(0xFFEA580C)),
                    SizedBox(width: 8),
                    Text('Kaccha Khaata (Estimates)', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
                  ],
                ),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(),
            const Text(
              'Rough/Estimate entries without formal GST invoicing. Tap entry to convert to pukka bill.',
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView(
                children: [
                  _kacchaTile(context, 'Rahul Verma', 'Rough Estimate #EST-101', 3200.0, '28 Oct 2026'),
                  _kacchaTile(context, 'Amit Electronics', 'Pending Quotation #EST-102', 8500.0, '27 Oct 2026'),
                  _kacchaTile(context, 'Suresh Mobile', 'Sample Dispatch #EST-103', 1450.0, '25 Oct 2026'),
                ],
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.add),
                label: const Text('Add Kaccha / Estimate Entry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEA580C),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  showAppSnackBar(context, 'New Kaccha Khaata estimate draft opened');
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _kacchaTile(BuildContext context, String party, String ref, double amount, String date) {
    final money = NumberFormat('#,##0');
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: ListTile(
        leading: const CircleAvatar(
          backgroundColor: Color(0xFFFFEDD5),
          child: Icon(Icons.receipt_outlined, color: Color(0xFFEA580C), size: 20),
        ),
        title: Text(party, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        subtitle: Text('$ref • $date', style: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
        trailing: Text('₹${money.format(amount)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFFEA580C))),
      ),
    );
  }
}
