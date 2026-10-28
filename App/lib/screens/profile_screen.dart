import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/app_bottom_nav.dart';
import '../widgets/profile_tile.dart';
import 'about_app_screen.dart';
import 'activity_log_screen.dart';
import 'backup_restore_screen.dart';
import 'business_info_screen.dart';
import 'import_export_screen.dart';
import 'inventory_screen.dart';
import 'help_support_screen.dart';
import 'login_screen.dart';
import 'visibility_settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  final ValueChanged<int> onNavigate;

  const ProfileScreen({super.key, required this.onNavigate});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      auth.refreshProfile();
      final settings = context.read<SettingsProvider>();
      if (!settings.loaded) settings.load();
    });
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: Color(0xFFDC2626)),
            SizedBox(width: 8),
            Text('Logout?'),
          ],
        ),
        content: const Text(
          'Are you sure you want to log out from NSYU Business Management?\n\nYou will need your registered mobile or credentials to log in again.',
          style: TextStyle(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final auth = context.read<AuthProvider>();
              await auth.logout();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final profile = auth.currentProfile;

    return Scaffold(
      backgroundColor: const Color(0xFFF4F6F9),
      appBar: AppBar(
        title: const Text(
          'Profile',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              widget.onNavigate(0);
            }
          },
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          _buildProfileHeaderCard(profile),
          const SizedBox(height: 16),
          _buildMenuCard(context),
          const SizedBox(height: 24),
          _buildLogoutButton(context),
          const SizedBox(height: 12),
        ],
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: 4,
        onTap: widget.onNavigate,
      ),
    );
  }

  Widget _buildProfileHeaderCard(profile) {
    final phoneDisplay = profile.phone.isNotEmpty
        ? (profile.phone.startsWith('+91') ? profile.phone : '+91 ${profile.phone}')
        : 'No mobile registered';

    final emailDisplay = profile.email.isNotEmpty ? profile.email : 'No email set';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          children: [
            // Wave background accent on right matching Image 2
            Positioned(
              right: -20,
              bottom: -20,
              top: -20,
              child: CustomPaint(
                size: const Size(180, 160),
                painter: _HeaderWavePainter(),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
              child: Row(
                children: [
                  // Blue circle avatar with white "NSYU"
                  Container(
                    width: 68,
                    height: 68,
                    decoration: const BoxDecoration(
                      color: Color(0xFF1565C0),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Text(
                        'NSYU',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          profile.businessName,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F172A),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          profile.role,
                          style: const TextStyle(
                            color: Color(0xFF1976D2),
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.phone_outlined, color: Color(0xFF64748B), size: 15),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                phoneDisplay,
                                style: const TextStyle(color: Color(0xFF475569), fontSize: 13),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.email_outlined, color: Color(0xFF64748B), size: 15),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                emailDisplay,
                                style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                                overflow: TextOverflow.ellipsis,
                              ),
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

  Widget _buildMenuCard(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          ProfileTile(
            icon: Icons.storefront_outlined,
            title: 'Business Information',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const BusinessInfoScreen()),
            ),
          ),
          ProfileTile(
            icon: Icons.visibility_outlined,
            title: 'Visibility & Display Settings',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const VisibilitySettingsScreen()),
            ),
          ),
          ProfileTile(
            icon: Icons.inventory_2_outlined,
            title: 'Inventory',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const InventoryScreen()),
            ),
          ),
          ProfileTile(
            icon: Icons.cloud_outlined,
            title: 'Backup & Restore',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const BackupRestoreScreen()),
            ),
          ),
          ProfileTile(
            icon: Icons.swap_vert_rounded,
            title: 'Import / Export',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ImportExportScreen()),
            ),
          ),
          ProfileTile(
            icon: Icons.history_rounded,
            title: 'Activity Log',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ActivityLogScreen()),
            ),
          ),
          ProfileTile(
            icon: Icons.help_outline_rounded,
            title: 'Help & Support',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const HelpSupportScreen()),
            ),
          ),
          ProfileTile(
            icon: Icons.info_outline_rounded,
            title: 'About App',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AboutAppScreen()),
            ),
            hideDivider: true,
          ),
        ],
      ),
    );
  }

  Widget _buildLogoutButton(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: FilledButton(
        onPressed: () => _confirmLogout(context),
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFDC2626),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          elevation: 1,
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.logout_rounded, color: Colors.white, size: 22),
            SizedBox(width: 8),
            Text(
              'Logout',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderWavePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint1 = Paint()
      ..color = const Color(0xFFE2EDFB).withOpacity(0.6)
      ..style = PaintingStyle.fill;

    final paint2 = Paint()
      ..color = const Color(0xFFD4E6FA).withOpacity(0.4)
      ..style = PaintingStyle.fill;

    final path1 = Path();
    path1.moveTo(size.width * 0.4, 0);
    path1.quadraticBezierTo(size.width * 0.2, size.height * 0.5, size.width * 0.5, size.height);
    path1.lineTo(size.width, size.height);
    path1.lineTo(size.width, 0);
    path1.close();
    canvas.drawPath(path1, paint1);

    final path2 = Path();
    path2.moveTo(size.width * 0.6, 0);
    path2.quadraticBezierTo(size.width * 0.4, size.height * 0.6, size.width * 0.7, size.height);
    path2.lineTo(size.width, size.height);
    path2.lineTo(size.width, 0);
    path2.close();
    canvas.drawPath(path2, paint2);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
