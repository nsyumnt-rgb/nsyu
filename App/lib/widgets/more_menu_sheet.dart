import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../features/dashboard/screens/home_screen.dart';
import '../providers/auth_provider.dart';
import '../screens/about_app_screen.dart';
import '../screens/business_info_screen.dart';
import '../screens/customer_picker_screen.dart';
import '../screens/help_support_screen.dart';
import '../screens/inventory_screen.dart';
import '../screens/portal/customer_portal_shell.dart';
import '../screens/profile_screen.dart';
import '../screens/shop_management_screen.dart';
import '../screens/visibility_settings_screen.dart';
import '../theme/app_theme.dart';
import 'app_bottom_nav.dart';

/// Modal bottom sheet for "More Options"
/// Grouped into clean, balanced sections:
/// - Business Operations (Dashboard, Inventory, Suppliers, Customer View, Kaccha Khaata, Auto Reminder)
/// - Account & Shop (Business Info, User Profile, Settings)
/// - Support & System (Subscription Plan, Help, About, Sign Out)
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

  Future<void> _handleLogout(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text(
          'Are you sure you want to sign out of your business account?',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );

    if (confirm == true && context.mounted) {
      await context.read<AuthProvider>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.90,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Color(0x1F0B1F4B),
            blurRadius: 24,
            offset: Offset(0, -6),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(16, 10, 16, MediaQuery.of(context).padding.bottom + 6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 42,
              height: 4.5,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Header Row: Business badge + Title + Close (✕) Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF04261D), Color(0xFF064E3B), Color(0xFF047857)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.apps_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'More Options',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: AppColors.navy900,
                          letterSpacing: -0.2,
                        ),
                      ),
                      Text(
                        'Business Management Tools',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
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
                  child: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF475569)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Scrollable Section Groups
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Section 1: Business Operations (Balanced 3x2 Grid) ──
                  _buildSectionHeader('BUSINESS OPERATIONS'),
                  const SizedBox(height: 8),

                  Row(
                    children: [
                      _buildGridCard(
                        context,
                        icon: Icons.dashboard_rounded,
                        label: 'Dashboard',
                        iconColor: const Color(0xFF047857),
                        bgColor: const Color(0xFFECFDF5),
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => HomeScreen(onNavigate: onNavigate)),
                          );
                        },
                      ),
                      const SizedBox(width: 10),
                      _buildGridCard(
                        context,
                        icon: Icons.inventory_2_rounded,
                        label: 'Inventory',
                        iconColor: const Color(0xFF4F46E5),
                        bgColor: const Color(0xFFEEF2FF),
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const InventoryScreen()),
                          );
                        },
                      ),
                      const SizedBox(width: 10),
                      _buildGridCard(
                        context,
                        icon: Icons.local_shipping_rounded,
                        label: 'Suppliers',
                        iconColor: const Color(0xFF7C3AED),
                        bgColor: const Color(0xFFF5F3FF),
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const CustomerPickerScreen(showSuppliersOnly: true)),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  Row(
                    children: [
                      _buildGridCard(
                        context,
                        icon: Icons.storefront_rounded,
                        label: 'Customer View',
                        iconColor: const Color(0xFF059669),
                        bgColor: const Color(0xFFECFDF5),
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const CustomerPortalShell()),
                          );
                        },
                      ),
                      const SizedBox(width: 10),
                      _buildGridCard(
                        context,
                        icon: Icons.edit_note_rounded,
                        label: 'Kaccha Khaata',
                        iconColor: const Color(0xFFD97706),
                        bgColor: const Color(0xFFFFFBEB),
                        onTap: () {
                          Navigator.pop(context);
                          _showKacchaKhaataSheet(context);
                        },
                      ),
                      const SizedBox(width: 10),
                      _buildGridCard(
                        context,
                        icon: Icons.notifications_active_rounded,
                        label: 'Auto Reminder',
                        iconColor: const Color(0xFFE11D48),
                        bgColor: const Color(0xFFFFF1F2),
                        onTap: () {
                          Navigator.pop(context);
                          _showAutoReminderSheet(context);
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // ── Section 2: Account & Settings (Grouped Card) ──
                  _buildSectionHeader('ACCOUNT & SHOP'),
                  const SizedBox(height: 8),

                  AppCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        _buildListTile(
                          icon: Icons.store_mall_directory_rounded,
                          title: 'Shops & Branches',
                          subtitle: 'Register new shop, switch active branch',
                          iconColor: const Color(0xFF047857),
                          bgColor: const Color(0xFFECFDF5),
                          onTap: () {
                            Navigator.pop(context);
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const ShopManagementScreen()),
                            );
                          },
                        ),
                        const Divider(height: 1, indent: 56, color: AppColors.border),
                        _buildListTile(
                          icon: Icons.storefront_outlined,
                          title: 'Business Profile',
                          subtitle: 'Shop details, address & GSTIN',
                          iconColor: AppColors.navy900,
                          bgColor: AppColors.blue50,
                          onTap: () {
                            Navigator.pop(context);
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const BusinessInfoScreen()),
                            );
                          },
                        ),
                        const Divider(height: 1, indent: 56, color: AppColors.border),
                        _buildListTile(
                          icon: Icons.person_outline_rounded,
                          title: 'My Profile',
                          subtitle: 'Personal details & credentials',
                          iconColor: const Color(0xFF047857),
                          bgColor: const Color(0xFFECFDF5),
                          onTap: () {
                            Navigator.pop(context);
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => ProfileScreen(onNavigate: onNavigate)),
                            );
                          },
                        ),
                        const Divider(height: 1, indent: 56, color: AppColors.border),
                        _buildListTile(
                          icon: Icons.tune_rounded,
                          title: 'Display & Navigation',
                          subtitle: 'Configure tabs & module visibility',
                          iconColor: const Color(0xFF7C3AED),
                          bgColor: const Color(0xFFF5F3FF),
                          onTap: () {
                            Navigator.pop(context);
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const VisibilitySettingsScreen()),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),

                  // ── Section 3: Support & System (Grouped Card) ──
                  _buildSectionHeader('SUPPORT & SYSTEM'),
                  const SizedBox(height: 8),

                  AppCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        _buildListTile(
                          icon: Icons.workspace_premium_outlined,
                          title: 'Subscription & Plan',
                          subtitle: 'NSYU Pro Plan • Active',
                          iconColor: const Color(0xFFD97706),
                          bgColor: const Color(0xFFFEF3C7),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: AppColors.successBg,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'ACTIVE',
                              style: TextStyle(
                                color: AppColors.success,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          onTap: () {
                            Navigator.pop(context);
                            showMyPlanSheet(context);
                          },
                        ),
                        const Divider(height: 1, indent: 56, color: AppColors.border),
                        _buildListTile(
                          icon: Icons.headset_mic_outlined,
                          title: 'Help & Support',
                          subtitle: 'User manuals, guides & contact',
                          iconColor: const Color(0xFF059669),
                          bgColor: const Color(0xFFECFDF5),
                          onTap: () {
                            Navigator.pop(context);
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const HelpSupportScreen()),
                            );
                          },
                        ),
                        const Divider(height: 1, indent: 56, color: AppColors.border),
                        _buildListTile(
                          icon: Icons.info_outline_rounded,
                          title: 'About App',
                          subtitle: 'Version 1.0.9 • Build & terms',
                          iconColor: const Color(0xFF64748B),
                          bgColor: const Color(0xFFF1F5F9),
                          onTap: () {
                            Navigator.pop(context);
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const AboutAppScreen()),
                            );
                          },
                        ),
                        const Divider(height: 1, indent: 56, color: AppColors.border),
                        _buildListTile(
                          icon: Icons.logout_rounded,
                          title: 'Sign Out',
                          subtitle: 'Log out of this device',
                          iconColor: AppColors.danger,
                          bgColor: AppColors.dangerBg,
                          titleColor: AppColors.danger,
                          onTap: () {
                            Navigator.pop(context);
                            _handleLogout(context);
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),

          // Integrated Bottom Navigation Bar with active Close icon
          AppBottomNav(
            currentIndex: 4,
            isMoreOpen: true,
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
    return Padding(
      padding: const EdgeInsets.only(left: 2, bottom: 2),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: AppColors.textSecondary,
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  Widget _buildGridCard(
    BuildContext context, {
    required IconData icon,
    required String label,
    required Color iconColor,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            height: 94,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: bgColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Icon(
                      icon,
                      size: 20,
                      color: iconColor,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.navy900,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildListTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color iconColor,
    required Color bgColor,
    Color? titleColor,
    Widget? trailing,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: bgColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Icon(
                    icon,
                    size: 19,
                    color: iconColor,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                        color: titleColor ?? AppColors.navy900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
              if (trailing != null) ...[
                trailing,
                const SizedBox(width: 6),
              ],
              const Icon(
                Icons.chevron_right_rounded,
                size: 19,
                color: AppColors.textSecondary,
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
                        Icon(Icons.notifications_active_rounded, color: Color(0xFFE11D48)),
                        SizedBox(width: 8),
                        Text('Auto Reminder Settings', style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.bold, color: AppColors.navy900)),
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
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: PrimaryButton(
                    label: 'Save Reminder Schedule',
                    icon: Icons.check_circle_outline,
                    onPressed: () {
                      Navigator.pop(ctx);
                      showAppSnackBar(context, 'Auto reminders updated & scheduled');
                    },
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
                    Icon(Icons.edit_note_rounded, color: Color(0xFFD97706)),
                    SizedBox(width: 8),
                    Text('Kaccha Khaata (Estimates)', style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.navy900)),
                  ],
                ),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const Divider(),
            const Text(
              'Rough/Estimate entries without formal GST invoicing. Tap entry to convert to pukka bill.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
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
                      Text('No estimate entries yet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary)),
                      SizedBox(height: 4),
                      Text('Tap the button below to record your first rough estimate draft.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                    ],
                  ),
                ),
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: PrimaryButton(
                label: 'Add Kaccha / Estimate Entry',
                icon: Icons.add,
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
                      'NSYU Business Pro Plan',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.navy900),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Active Subscription • Auto-Renews 2027',
                      style: TextStyle(fontSize: 12, color: AppColors.success, fontWeight: FontWeight.w600),
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
                colors: [Color(0xFF04261D), Color(0xFF064E3B), Color(0xFF047857)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x1F0B1F4B),
                  blurRadius: 10,
                  offset: Offset(0, 4),
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
                    style: TextStyle(color: AppColors.navy900, fontWeight: FontWeight.w800, fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Included In Your Plan',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.navy900),
          ),
          const SizedBox(height: 10),
          _planFeature(Icons.check_circle_rounded, 'Realtime Supabase Cloud Sync across Mobile & Web'),
          _planFeature(Icons.check_circle_rounded, 'Full GST / Non-GST Invoicing & Kaccha Khaata Drafts'),
          _planFeature(Icons.check_circle_rounded, 'Automated WhatsApp Payment Reminders'),
          _planFeature(Icons.check_circle_rounded, 'Product Catalog with Barcode Scanning & Stock Control'),
          _planFeature(Icons.check_circle_rounded, 'Multi-Shop Management with Employee Permissions'),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: PrimaryButton(
              label: 'Manage Plan & Invoices',
              onPressed: () => Navigator.pop(ctx),
            ),
          ),
        ],
      ),
    ),
  );
}

Widget _planFeature(IconData icon, String text) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      children: [
        Icon(icon, color: AppColors.success, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 12.5,
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    ),
  );
}
