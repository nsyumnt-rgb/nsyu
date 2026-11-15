import 'package:flutter/material.dart';

import '../features/dashboard/screens/home_screen.dart';
import '../screens/about_app_screen.dart';
import '../screens/business_info_screen.dart';
import '../screens/customer_picker_screen.dart';
import '../screens/help_support_screen.dart';
import '../screens/inventory_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/visibility_settings_screen.dart';
import '../theme/app_theme.dart';
import 'app_bottom_nav.dart';

/// Modal bottom sheet matching Specification ("More Options")
/// Grouped into distinct sections:
/// - Business (Dashboard, Inventory, Suppliers, Kaccha Khaata, Auto Reminder)
/// - Account (Account, Profile, Settings)
/// - Support (Help, About)
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
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Color(0x1A0F172A),
            blurRadius: 20,
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
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.2,
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
          const SizedBox(height: 12),

          // Scrollable Section Groups
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Section 1: Business ──
                  _buildSectionHeader('BUSINESS'),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _buildOptionCard(
                        context,
                        icon: Icons.dashboard_outlined,
                        label: 'Dashboard',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(context, MaterialPageRoute(builder: (_) => HomeScreen(onNavigate: onNavigate)));
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
                      const SizedBox(width: 10),
                      _buildOptionCard(
                        context,
                        icon: Icons.local_shipping_outlined,
                        label: 'Suppliers',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const CustomerPickerScreen(showSuppliersOnly: true)));
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _buildOptionCard(
                        context,
                        icon: Icons.edit_note_rounded,
                        label: 'Kaccha\nKhaata',
                        onTap: () {
                          Navigator.pop(context);
                          _showKacchaKhaataSheet(context);
                        },
                      ),
                      const SizedBox(width: 10),
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
                      const Expanded(child: SizedBox()), // spacer for 3-grid balance
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ── Section 2: Account ──
                  _buildSectionHeader('ACCOUNT'),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _buildOptionCard(
                        context,
                        icon: Icons.storefront_outlined,
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
                        icon: Icons.settings_outlined,
                        label: 'Settings',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const VisibilitySettingsScreen()));
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ── Section 3: Support ──
                  _buildSectionHeader('SUPPORT'),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _buildOptionCard(
                        context,
                        icon: Icons.help_outline_rounded,
                        label: 'Help',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const HelpSupportScreen()));
                        },
                      ),
                      const SizedBox(width: 10),
                      _buildOptionCard(
                        context,
                        icon: Icons.info_outline_rounded,
                        label: 'About',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const AboutAppScreen()));
                        },
                      ),
                      const SizedBox(width: 10),
                      const Expanded(child: SizedBox()),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),

          // Integrated Bottom Navigation Bar with active More pill
          AppBottomNav(
            currentIndex: 4,
            isMoreOpen: false,
            navMode: navMode,
            onTap: (index) {
              Navigator.pop(context);
              if (index != 4) {
                onNavigate(index);
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 11.5,
        fontWeight: FontWeight.w700,
        color: AppColors.textSecondary,
        letterSpacing: 0.8,
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
          height: 100,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.03),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF), // Soft subtle blue tint
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFDBEAFE)),
                ),
                child: Center(
                  child: Icon(
                    icon,
                    size: 20,
                    color: const Color(0xFF1D4ED8), // Royal blue icon
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
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                        height: 1.15,
                        letterSpacing: -0.1,
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
            const Expanded(
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.edit_note_rounded, size: 48, color: Color(0xFFCBD5E1)),
                      SizedBox(height: 12),
                      Text('No estimate entries yet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF334155))),
                      SizedBox(height: 4),
                      Text('Tap the button below to record your first rough estimate draft.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                    ],
                  ),
                ),
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
