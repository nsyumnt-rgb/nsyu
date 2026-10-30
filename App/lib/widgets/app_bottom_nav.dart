import 'package:flutter/material.dart';
import 'more_menu_sheet.dart';

/// 4-Tab Bottom Navigation Bar matching Reference Images 1, 4, 5, 8
/// Tabs: Ledger (0), Bill (1), Catalog/Inventory (2), More (3)
class AppBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  static const _destinations = [
    (0, Icons.menu_book_outlined, Icons.menu_book_rounded, 'Ledger'),
    (1, Icons.receipt_long_outlined, Icons.receipt_long_rounded, 'Bill'),
    (2, Icons.inventory_2_outlined, Icons.inventory_2_rounded, 'Catalog'),
    (3, Icons.menu_rounded, Icons.menu_rounded, 'More'),
  ];

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 66,
          child: Row(
            children: [
              for (final d in _destinations)
                Expanded(
                  child: _NavItem(
                    icon: d.$2,
                    activeIcon: d.$3,
                    label: d.$4,
                    active: currentIndex == d.$1,
                    onTap: () {
                      if (d.$1 == 3) {
                        // More tab opens the bottom sheet matching Image 4
                        MoreMenuSheet.show(context, onNavigate: onTap);
                      } else {
                        onTap(d.$1);
                      }
                    },
                  ),
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
    const activeColor = Color(0xFF16A34A); // Vibrant green matching Image 1
    const inactiveColor = Color(0xFF64748B);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Center(
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(
            color: active ? const Color(0xFFE8F5E9) : Colors.transparent, // green capsule pill matching Image 1
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                active ? activeIcon : icon,
                color: active ? activeColor : inactiveColor,
                size: 22,
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? activeColor : inactiveColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
