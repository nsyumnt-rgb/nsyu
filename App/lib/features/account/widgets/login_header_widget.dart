import 'package:flutter/material.dart';

class LoginHeaderWidget extends StatelessWidget {
  const LoginHeaderWidget({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Official NSYU App Logo in White Rounded Box
        Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.16),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          padding: const EdgeInsets.all(7),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: Image.asset(
              'assets/nsyu_logo.png',
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(Icons.storefront_rounded, size: 44, color: Color(0xFF1D4ED8)),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),

        // App Title
        const Text(
          'NSYU Business',
          style: TextStyle(
            fontSize: 27,
            fontWeight: FontWeight.w800,
            color: Colors.white,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),

        // Tagline with Dotted / Solid Horizontal Dashes
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(width: 24, height: 1.2, color: Colors.white70),
            const SizedBox(width: 8),
            const Text(
              'Manage Your Business Easily',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 8),
            Container(width: 24, height: 1.2, color: Colors.white70),
          ],
        ),
        const SizedBox(height: 18),

        // 3 Feature Indicators Row (Sales & Billing | Inventory | Customers)
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildFeatureIndicator(
              icon: Icons.bar_chart_rounded,
              label: 'Sales & Billing',
            ),
            Container(
              height: 28,
              width: 1,
              margin: const EdgeInsets.symmetric(horizontal: 14),
              color: Colors.white.withValues(alpha: 0.25),
            ),
            _buildFeatureIndicator(
              icon: Icons.inventory_2_outlined,
              label: 'Inventory',
            ),
            Container(
              height: 28,
              width: 1,
              margin: const EdgeInsets.symmetric(horizontal: 14),
              color: Colors.white.withValues(alpha: 0.25),
            ),
            _buildFeatureIndicator(
              icon: Icons.groups_outlined,
              label: 'Customers',
            ),
          ],
        ),
      ],
    );
  }

  static Widget _buildFeatureIndicator({required IconData icon, required String label}) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withValues(alpha: 0.22),
          ),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: Colors.white,
          ),
        ),
      ],
    );
  }
}

// ── Top Decorative Wave Clipper ──
class TopWaveClipper extends CustomClipper<Path> {
  const TopWaveClipper();

  @override
  Path getClip(Size size) {
    final path = Path();
    path.lineTo(0, size.height - 45);
    path.quadraticBezierTo(
      size.width * 0.25,
      size.height,
      size.width * 0.5,
      size.height - 25,
    );
    path.quadraticBezierTo(
      size.width * 0.75,
      size.height - 50,
      size.width,
      size.height - 20,
    );
    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

// ── Bottom Subtle Wave Clipper ──
class BottomWaveClipper extends CustomClipper<Path> {
  const BottomWaveClipper();

  @override
  Path getClip(Size size) {
    final path = Path();
    path.moveTo(0, 35);
    path.quadraticBezierTo(
      size.width * 0.25,
      0,
      size.width * 0.5,
      25,
    );
    path.quadraticBezierTo(
      size.width * 0.75,
      50,
      size.width,
      20,
    );
    path.lineTo(size.width, size.height);
    path.lineTo(0, size.height);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
