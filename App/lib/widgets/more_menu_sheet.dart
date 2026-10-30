import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../screens/business_info_screen.dart';
import '../screens/collect_payment_screen.dart';
import '../screens/help_support_screen.dart';
import '../screens/inventory_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/visibility_settings_screen.dart';
import '../theme/app_theme.dart';
import 'app_bottom_nav.dart';

/// Modal bottom sheet matching Reference Image ("More Options")
/// Features:
/// - "More Options" header with center drag handle and circular close ✕ button
/// - 3-Column Grid of 9 rounded rectangular cards with soft green circular icons,
///   descriptive labels, and right-pointing chevrons (>)
/// - Integrated bottom navigation bar with active More tab
class MoreMenuSheet extends StatelessWidget {
  final ValueChanged<int> onNavigate;
  final BottomNavMode navMode;

  const MoreMenuSheet({
    super.key,
    required this.onNavigate,
    this.navMode = BottomNavMode.catalog,
  });

  static void show(
    BuildContext context, {
    required ValueChanged<int> onNavigate,
    BottomNavMode navMode = BottomNavMode.catalog,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => MoreMenuSheet(onNavigate: onNavigate, navMode: navMode),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).padding.bottom + 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Header Row: "More Options" + Circular Close (✕) Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'More Options',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
              InkWell(
                onTap: () => Navigator.pop(context),
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: const BoxDecoration(
                    color: Color(0xFFF1F5F9),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close, size: 18, color: Color(0xFF475569)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 3-Column Grid of 9 Cards matching Reference Image
          Column(
            children: [
              // Row 1: Account >, Profile >, Help >
              Row(
                children: [
                  _buildOptionCard(
                    context,
                    icon: Icons.description_outlined,
                    label: 'Account',
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const BusinessInfoScreen()));
                    },
                  ),
                  const SizedBox(width: 10),
                  _buildOptionCard(
                    context,
                    icon: Icons.person_outline_rounded,
                    label: 'Profile',
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => ProfileScreen(onNavigate: onNavigate)));
                    },
                  ),
                  const SizedBox(width: 10),
                  _buildOptionCard(
                    context,
                    icon: Icons.volunteer_activism_outlined,
                    label: 'Help',
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpSupportScreen()));
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Row 2: Settings >, Bill >, Inventory > (Highlighted)
              Row(
                children: [
                  _buildOptionCard(
                    context,
                    icon: Icons.settings_outlined,
                    label: 'Settings',
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const VisibilitySettingsScreen()));
                    },
                  ),
                  const SizedBox(width: 10),
                  _buildOptionCard(
                    context,
                    icon: Icons.receipt_long_outlined,
                    label: 'Bill',
                    onTap: () {
                      Navigator.pop(context);
                      onNavigate(1); // Switch to Bills tab
                    },
                  ),
                  const SizedBox(width: 10),
                  _buildOptionCard(
                    context,
                    icon: Icons.inventory_2_outlined,
                    label: 'Inventory',
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const InventoryScreen()));
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Row 3: Auto Reminder >, Catalog >, Kaccha Khaata >
              Row(
                children: [
                  _buildOptionCard(
                    context,
                    icon: Icons.more_time_rounded,
                    label: 'Auto\nReminder',
                    onTap: () {
                      Navigator.pop(context);
                      _showAutoReminderSheet(context);
                    },
                  ),
                  const SizedBox(width: 10),
                  _buildOptionCard(
                    context,
                    icon: Icons.menu_book_rounded,
                    label: 'Catalog',
                    onTap: () {
                      Navigator.pop(context);
                      onNavigate(2); // Switch to Catalog/Inventory tab
                    },
                  ),
                  const SizedBox(width: 10),
                  _buildOptionCard(
                    context,
                    icon: Icons.edit_note_rounded,
                    label: 'Kaccha\nKhaata',
                    onTap: () {
                      Navigator.pop(context);
                      _showKacchaKhaataSheet(context);
                    },
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Integrated Bottom Navigation Bar with active More pill
          AppBottomNav(
            currentIndex: 3,
            isMoreOpen: false,
            navMode: navMode,
            onTap: (index) {
              Navigator.pop(context);
              if (index != 3) {
                if (navMode == BottomNavMode.ledger) {
                  if (index == 0) {
                    onNavigate(0);
                  } else if (index == 1) {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const CollectPaymentScreen()));
                  } else if (index == 2) {
                    showMyPlanSheet(context);
                  }
                } else {
                  onNavigate(index);
                }
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildOptionCard(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 98,
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: const BoxDecoration(
                  color: Color(0xFFE8F5E9), // Soft light green circle
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Icon(
                    icon,
                    size: 20,
                    color: const Color(0xFF006837), // Forest green icon
                  ),
                ),
              ),
              const Spacer(),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0F172A),
                        height: 1.15,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right,
                    size: 16,
                    color: Color(0xFF94A3B8),
                  ),
                ],
              ),
            ],
          ),
        ),
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
                    const Row(
                      children: [
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
                const Row(
                  children: [
                    Icon(Icons.edit_note_rounded, color: Color(0xFFEA580C)),
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

/// Plan & Subscription modal sheet
void showMyPlanSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).padding.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.stars_rounded, color: Color(0xFFD97706), size: 28),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'NSY Business Pro Plan',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Active Subscription • Auto-Renews 2027',
                      style: TextStyle(fontSize: 12, color: Color(0xFF16A34A), fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(ctx),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF006837), Color(0xFF16A34A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF16A34A).withValues(alpha: 0.25),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Current Tier', style: TextStyle(color: Colors.white70, fontSize: 12)),
                    SizedBox(height: 4),
                    Text('Enterprise Multi-Store', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
                    SizedBox(height: 4),
                    Text('Unlimited Devices & Staff', style: TextStyle(color: Colors.white, fontSize: 11)),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'ACTIVE',
                    style: TextStyle(color: Color(0xFF006837), fontWeight: FontWeight.w800, fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Included In Your Plan',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 10),
          _planFeature(Icons.check_circle, 'Realtime Supabase Cloud Sync across Mobile & Web'),
          _planFeature(Icons.check_circle, 'Full GST / Non-GST Invoicing & Kaccha Khaata Drafts'),
          _planFeature(Icons.check_circle, 'Automated WhatsApp Payment Reminders'),
          _planFeature(Icons.check_circle, 'Product Catalog with Barcode Scanning & Stock Control'),
          _planFeature(Icons.check_circle, 'Multi-Shop Management with Employee Permissions'),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF006837),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Manage Plan & Invoices', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    ),
  );
}

Widget _planFeature(IconData icon, String text) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        Icon(icon, color: const Color(0xFF16A34A), size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Text(text, style: const TextStyle(fontSize: 12.5, color: Color(0xFF334155), fontWeight: FontWeight.w500)),
        ),
      ],
    ),
  );
}
