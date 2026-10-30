import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/bills_provider.dart';
import '../screens/business_info_screen.dart';
import '../screens/collect_payment_screen.dart';
import '../screens/help_support_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/visibility_settings_screen.dart';
import '../theme/app_theme.dart';
import 'app_bottom_nav.dart';

/// Modal bottom sheet matching Reference Image 10 ("More" menu sheet)
/// Features 4-column circular icon grid with soft blue-gray backgrounds,
/// Kaccha Khaata red notification badge, and integrated bottom nav bar with green close button.
class MoreMenuSheet extends StatelessWidget {
  final ValueChanged<int> onNavigate;
  final BottomNavMode navMode;

  const MoreMenuSheet({
    super.key,
    required this.onNavigate,
    this.navMode = BottomNavMode.ledger,
  });

  static void show(
    BuildContext context, {
    required ValueChanged<int> onNavigate,
    BottomNavMode navMode = BottomNavMode.ledger,
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
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 16,
            offset: Offset(0, -4),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(12, 28, 12, MediaQuery.of(context).padding.bottom + 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 4-Column Action Grid matching Reference Image 10
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Column(
              children: [
                // Row 1: Account, Profile, Help, Settings
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
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
                      iconWidget: const _NamasteIcon(color: Color(0xFF1E293B), size: 24),
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
                  ],
                ),
                const SizedBox(height: 22),

                // Row 2: Bills, Stock Managem..., Multi Device, Auto Reminder
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildMenuItem(
                      context,
                      iconWidget: const _BillsIcon(),
                      label: 'Bills',
                      onTap: () {
                        Navigator.pop(context);
                        onNavigate(1); // switch to Bills tab
                      },
                    ),
                    _buildMenuItem(
                      context,
                      iconWidget: const _StockManagementIcon(),
                      label: 'Stock\nManagem...',
                      onTap: () {
                        Navigator.pop(context);
                        onNavigate(2); // switch to Inventory/Catalog tab
                      },
                    ),
                    _buildMenuItem(
                      context,
                      iconWidget: const _MultiDeviceIcon(),
                      label: 'Multi Device',
                      onTap: () {
                        Navigator.pop(context);
                        _showMultiDeviceSheet(context);
                      },
                    ),
                    _buildMenuItem(
                      context,
                      iconWidget: const _AutoReminderIcon(),
                      label: 'Auto\nReminder',
                      onTap: () {
                        Navigator.pop(context);
                        _showAutoReminderSheet(context);
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 22),

                // Row 3: Kaccha Khaata (with red notification dot badge)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildMenuItem(
                      context,
                      iconWidget: const _KacchaKhaataIcon(),
                      label: 'Kaccha\nKhaata',
                      hasRedBadge: true, // Red dot notification badge matching Reference Image 10!
                      onTap: () {
                        Navigator.pop(context);
                        _showKacchaKhaataSheet(context);
                      },
                    ),
                    const SizedBox(width: 72),
                    const SizedBox(width: 72),
                    const SizedBox(width: 72),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          // Integrated Bottom Navigation Bar with green ✕ close pill matching Reference Image 10
          AppBottomNav(
            currentIndex: 3,
            isMoreOpen: true,
            navMode: navMode,
            onTap: (index) {
              Navigator.pop(context);
              if (index == 3) {
                // Closed via ✕ More button
                return;
              }
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
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMenuItem(
    BuildContext context, {
    IconData? icon,
    Widget? iconWidget,
    required String label,
    bool hasRedBadge = false,
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
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 54,
                  height: 54,
                  decoration: const BoxDecoration(
                    color: Color(0xFFE2EBF0), // Soft cool blue-gray circle matching Reference Image 10
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: iconWidget ??
                        Icon(
                          icon,
                          size: 24,
                          color: const Color(0xFF1E293B), // Charcoal slate icon matching Reference Image 10
                        ),
                  ),
                ),
                if (hasRedBadge)
                  Positioned(
                    top: 1,
                    right: 1,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        color: Color(0xFFEF4444), // Red circular notification dot badge
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
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
                const Row(
                  children: [
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
              child: const Row(
                children: [
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
                  if (context.mounted) {
                    showAppSnackBar(context, 'All records synced successfully with Supabase PostgreSQL');
                  }
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

// ────────────────────────────────────────────────────────────────────────────
// CUSTOM CONST ICON WIDGETS MATCHING REFERENCE IMAGE 10
// ────────────────────────────────────────────────────────────────────────────

class _BillsIcon extends StatelessWidget {
  const _BillsIcon();

  @override
  Widget build(BuildContext context) {
    return const Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        Icon(Icons.receipt_long_outlined, size: 24, color: Color(0xFF1E293B)),
        Positioned(
          top: 6,
          child: Text(
            '₹',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1E293B),
              height: 1.0,
            ),
          ),
        ),
      ],
    );
  }
}

class _StockManagementIcon extends StatelessWidget {
  const _StockManagementIcon();

  @override
  Widget build(BuildContext context) {
    return const Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        Icon(Icons.assignment_outlined, size: 24, color: Color(0xFF1E293B)),
        Positioned(
          right: -2,
          bottom: -2,
          child: Icon(Icons.inventory_2_outlined, size: 12, color: Color(0xFF1E293B)),
        ),
      ],
    );
  }
}

class _MultiDeviceIcon extends StatelessWidget {
  const _MultiDeviceIcon();

  @override
  Widget build(BuildContext context) {
    return const Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        Positioned(
          left: -2,
          top: 1,
          child: Icon(Icons.tablet_android_rounded, size: 18, color: Color(0xFF1E293B)),
        ),
        Positioned(
          right: -1,
          bottom: 1,
          child: Icon(Icons.phone_android_rounded, size: 16, color: Color(0xFF1E293B)),
        ),
      ],
    );
  }
}

class _AutoReminderIcon extends StatelessWidget {
  const _AutoReminderIcon();

  @override
  Widget build(BuildContext context) {
    return const Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        Icon(Icons.chat_bubble_outline_rounded, size: 24, color: Color(0xFF1E293B)),
        Positioned(
          top: 5,
          child: Icon(Icons.access_time_rounded, size: 11, color: Color(0xFF1E293B)),
        ),
      ],
    );
  }
}

class _KacchaKhaataIcon extends StatelessWidget {
  const _KacchaKhaataIcon();

  @override
  Widget build(BuildContext context) {
    return const Icon(Icons.edit_note_rounded, size: 26, color: Color(0xFF1E293B));
  }
}

/// Namaste / Praying Hands vector icon matching Reference Image 10
class _NamasteIcon extends StatelessWidget {
  final Color color;
  final double size;

  const _NamasteIcon({required this.color, this.size = 24});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _NamastePainter(color),
      ),
    );
  }
}

class _NamastePainter extends CustomPainter {
  final Color color;
  _NamastePainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final strokePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final w = size.width;
    final h = size.height;

    // Left hand outline
    final leftPath = Path();
    leftPath.moveTo(w * 0.30, h * 0.88);
    leftPath.lineTo(w * 0.30, h * 0.65);
    leftPath.quadraticBezierTo(w * 0.18, h * 0.52, w * 0.36, h * 0.28);
    leftPath.lineTo(w * 0.49, h * 0.12);
    leftPath.lineTo(w * 0.49, h * 0.88);

    // Right hand outline (mirror)
    final rightPath = Path();
    rightPath.moveTo(w * 0.70, h * 0.88);
    rightPath.lineTo(w * 0.70, h * 0.65);
    rightPath.quadraticBezierTo(w * 0.82, h * 0.52, w * 0.64, h * 0.28);
    rightPath.lineTo(w * 0.51, h * 0.12);
    rightPath.lineTo(w * 0.51, h * 0.88);

    canvas.drawPath(leftPath, strokePaint);
    canvas.drawPath(rightPath, strokePaint);

    // Wrist base line
    canvas.drawLine(Offset(w * 0.25, h * 0.88), Offset(w * 0.75, h * 0.88), strokePaint);
  }

  @override
  bool shouldRepaint(covariant _NamastePainter oldDelegate) => oldDelegate.color != color;
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
