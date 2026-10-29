import 'package:flutter/material.dart';
import '../screens/business_info_screen.dart';
import '../screens/help_support_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/visibility_settings_screen.dart';

/// Modal bottom sheet matching Reference Image 4 ("More" menu)
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

          // 7 Circular Action Buttons matching Image 4
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
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Auto Reminder: Pending payment reminders scheduled via WhatsApp'),
                      behavior: SnackBarBehavior.floating,
                      backgroundColor: Color(0xFF16A34A),
                    ),
                  );
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
                  color: Color(0xFF16A34A),
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
}
