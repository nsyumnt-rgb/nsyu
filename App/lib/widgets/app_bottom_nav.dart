import 'package:flutter/material.dart';
import 'more_menu_sheet.dart';

enum BottomNavMode {
  ledger,
  catalog,
}

/// 5-Tab Bottom Navigation Bar matching Reference Images & User Specification:
/// 1. Ledger (Index 0)
/// 2. Bill (Index 1)
/// 3. Order (Index 2)
/// 4. Catalog (Index 3)
/// 5. More (Index 4)
class AppBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final bool isMoreOpen;
  final BottomNavMode navMode;

  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.isMoreOpen = false,
    this.navMode = BottomNavMode.catalog,
  });

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 64,
          child: Row(
            children: [
              // Tab 0: Ledger
              Expanded(
                child: _NavItem(
                  label: 'Ledger',
                  active: currentIndex == 0 && !isMoreOpen,
                  iconBuilder: (active, color) => _ledgerIcon(color),
                  onTap: () => onTap(0),
                ),
              ),

              // Tab 1: Bill
              Expanded(
                child: _NavItem(
                  label: 'Bill',
                  active: currentIndex == 1 && !isMoreOpen,
                  iconBuilder: (active, color) => Icon(
                    active ? Icons.description_rounded : Icons.description_outlined,
                    color: color,
                    size: 22,
                  ),
                  onTap: () => onTap(1),
                ),
              ),

              // Tab 2: Order
              Expanded(
                child: _NavItem(
                  label: 'Order',
                  active: currentIndex == 2 && !isMoreOpen,
                  iconBuilder: (active, color) => Icon(
                    active ? Icons.receipt_long_rounded : Icons.receipt_long_outlined,
                    color: color,
                    size: 22,
                  ),
                  onTap: () => onTap(2),
                ),
              ),

              // Tab 3: Catalog
              Expanded(
                child: _NavItem(
                  label: 'Catalog',
                  active: currentIndex == 3 && !isMoreOpen,
                  iconBuilder: (active, color) => Icon(
                    active ? Icons.inventory_2_rounded : Icons.inventory_2_outlined,
                    color: color,
                    size: 22,
                  ),
                  onTap: () => onTap(3),
                ),
              ),

              // Tab 4: More
              Expanded(
                child: _NavItem(
                  label: 'More',
                  active: isMoreOpen || currentIndex == 4,
                  iconBuilder: (active, color) => Icon(
                    isMoreOpen ? Icons.close_rounded : Icons.menu_rounded,
                    color: color,
                    size: isMoreOpen ? 21 : 23,
                  ),
                  onTap: () {
                    if (isMoreOpen) {
                      onTap(4);
                    } else {
                      MoreMenuSheet.show(
                        context,
                        onNavigate: onTap,
                        navMode: navMode,
                      );
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

  static Widget _ledgerIcon(Color color) {
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.center,
      children: [
        Icon(Icons.menu_book_rounded, color: color, size: 23),
        Positioned(
          left: 4,
          top: 4,
          child: Text(
            '₹',
            style: TextStyle(
              fontSize: 8.5,
              fontWeight: FontWeight.w800,
              color: color,
              height: 1.0,
            ),
          ),
        ),
      ],
    );
  }
}

class _NavItem extends StatelessWidget {
  final String label;
  final bool active;
  final Widget Function(bool active, Color color) iconBuilder;
  final VoidCallback onTap;

  const _NavItem({
    required this.label,
    required this.active,
    required this.iconBuilder,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const activeGreen = Color(0xFF16A34A);
    const inactiveSlate = Color(0xFF475569);

    final itemColor = active ? activeGreen : inactiveSlate;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Center(
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: active ? const Color(0xFFE8F5E9) : Colors.transparent,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              iconBuilder(active, itemColor),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: itemColor,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
