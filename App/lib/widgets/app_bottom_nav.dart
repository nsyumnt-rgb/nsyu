import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/visibility_provider.dart';
import '../theme/app_theme.dart';

class AppBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  static const _allDestinations = [
    (0, Icons.home_outlined, Icons.home_rounded, 'Home'),
    (1, Icons.inventory_2_outlined, Icons.inventory_2_rounded, 'Catalog'),
    (2, Icons.receipt_long_outlined, Icons.receipt_long_rounded, 'Billing'),
    (3, Icons.shopping_bag_outlined, Icons.shopping_bag_rounded, 'Orders'),
    (4, Icons.more_horiz_rounded, Icons.menu_rounded, 'More'),
  ];

  @override
  Widget build(BuildContext context) {
    final visibility = context.watch<VisibilityProvider>();
    final visibleIndices = visibility.visibleNavDestinations;

    // Filter to only visible destinations
    final items = _allDestinations
        .where((d) => visibleIndices.contains(d.$1))
        .toList();

    final count = items.length;
    final activePos = items.indexWhere((d) => d.$1 == currentIndex);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: AppColors.navy.withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 62,
          child: Stack(
            children: [
              if (activePos != -1 && count > 1)
                AnimatedAlign(
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.easeOutCubic,
                  alignment: Alignment(-1 + activePos * (2 / (count - 1)), 0),
                  child: FractionallySizedBox(
                    widthFactor: 1 / count,
                    child: Container(
                      margin: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.navy.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
              Row(
                children: [
                  for (final item in items)
                    Expanded(
                      child: _NavItem(
                        icon: item.$2,
                        activeIcon: item.$3,
                        label: item.$4,
                        active: item.$1 == currentIndex,
                        onTap: () => onTap(item.$1),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.navy : AppColors.muted;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedScale(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutBack,
            scale: active ? 1.15 : 1.0,
            child: Icon(active ? activeIcon : icon, color: color, size: 22),
          ),
          const SizedBox(height: 3),
          AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 200),
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            ),
            child: Text(label),
          ),
        ],
      ),
    );
  }
}
