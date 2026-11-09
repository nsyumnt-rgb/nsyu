import 'package:flutter/material.dart';

import '../../../providers/auth_provider.dart';
import '../../../screens/about_app_screen.dart';
import '../../../screens/activity_log_screen.dart';
import '../../../screens/backup_restore_screen.dart';
import '../../../screens/business_info_screen.dart';
import '../../../screens/customer_picker_screen.dart';
import '../../../screens/employees_screen.dart';
import '../../../screens/help_support_screen.dart';
import '../../../screens/inventory_screen.dart';
import '../../../screens/login_screen.dart';
import '../../../screens/reports_screen.dart';
import '../../../screens/visibility_settings_screen.dart';

class DashboardDrawer extends StatelessWidget {
  final AuthProvider auth;

  const DashboardDrawer({super.key, required this.auth});

  Widget _drawerSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 4),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: Color(0xFF94A3B8),
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  Widget _drawerItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Color? iconColor,
    Color? textColor,
  }) {
    return ListTile(
      leading: Icon(icon, color: iconColor ?? const Color(0xFF1D4ED8), size: 22),
      title: Text(
        title,
        style: TextStyle(
          color: textColor ?? const Color(0xFF0F172A),
          fontWeight: FontWeight.w600,
          fontSize: 14,
        ),
      ),
      onTap: onTap,
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
    );
  }

  @override
  Widget build(BuildContext context) {
    final profile = auth.currentProfile;
    final shopName = auth.shopName.isNotEmpty ? auth.shopName : 'NSYU Main Store';

    return Drawer(
      backgroundColor: Colors.white,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF1D4ED8), Color(0xFF2563EB)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Image.asset(
                          'assets/nsyu_logo.png',
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Center(
                            child: Icon(Icons.storefront_rounded,
                                size: 28, color: Color(0xFF1D4ED8)),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'NSYU Business',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            shopName,
                            style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  'Logged in as: ${profile.ownerName.isNotEmpty ? profile.ownerName : 'Admin'} (${profile.role})',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          _drawerSectionHeader('BUSINESS MANAGEMENT'),
          _drawerItem(
            icon: Icons.people_alt_outlined,
            title: 'Customers',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CustomerPickerScreen()),
              );
            },
          ),
          _drawerItem(
            icon: Icons.menu_book_outlined,
            title: 'Customer Ledger',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CustomerPickerScreen()),
              );
            },
          ),
          _drawerItem(
            icon: Icons.inventory_2_outlined,
            title: 'Inventory & Stock',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const InventoryScreen()),
              );
            },
          ),
          _drawerItem(
            icon: Icons.bar_chart_rounded,
            title: 'Reports & Analytics',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ReportsScreen()),
              );
            },
          ),

          _drawerSectionHeader('MANAGEMENT'),
          _drawerItem(
            icon: Icons.badge_outlined,
            title: 'Employees & Staff',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const EmployeesScreen()),
              );
            },
          ),

          _drawerSectionHeader('ADMIN & SETTINGS'),
          _drawerItem(
            icon: Icons.visibility_outlined,
            title: 'Visibility & Display Settings',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const VisibilitySettingsScreen()),
              );
            },
          ),
          _drawerItem(
            icon: Icons.storefront_outlined,
            title: 'Business Information',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const BusinessInfoScreen()),
              );
            },
          ),
          _drawerItem(
            icon: Icons.cloud_sync_outlined,
            title: 'Backup & Restore',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const BackupRestoreScreen()),
              );
            },
          ),
          _drawerItem(
            icon: Icons.history_rounded,
            title: 'Activity Log',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ActivityLogScreen()),
              );
            },
          ),
          _drawerItem(
            icon: Icons.help_outline_rounded,
            title: 'Help & Support',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const HelpSupportScreen()),
              );
            },
          ),
          _drawerItem(
            icon: Icons.info_outline_rounded,
            title: 'About App',
            onTap: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const AboutAppScreen()),
              );
            },
          ),
          const Divider(height: 16),
          _drawerItem(
            icon: Icons.logout_rounded,
            title: 'Logout',
            textColor: const Color(0xFFDC2626),
            iconColor: const Color(0xFFDC2626),
            onTap: () async {
              Navigator.pop(context);
              await auth.logout();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
          ),
        ],
      ),
    );
  }
}
