import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/customer_portal_provider.dart';
import 'portal_home_screen.dart';
import 'portal_catalog_screen.dart';
import 'portal_cart_screen.dart';
import 'portal_orders_screen.dart';
import 'portal_more_screen.dart';

class CustomerPortalShell extends StatefulWidget {
  const CustomerPortalShell({super.key});

  @override
  State<CustomerPortalShell> createState() => _CustomerPortalShellState();
}

class _CustomerPortalShellState extends State<CustomerPortalShell> {
  final List<Widget> _pages = const [
    PortalHomeScreen(),
    PortalCatalogScreen(),
    PortalCartScreen(),
    PortalOrdersScreen(),
    PortalMoreScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CustomerPortalProvider>().init();
    });
  }

  @override
  Widget build(BuildContext context) {
    final portal = context.watch<CustomerPortalProvider>();
    final cartCount = portal.cartItemCount;
    final unread = portal.unreadNotifications;
    final currentIndex = portal.selectedTabIndex;

    return Scaffold(
      body: IndexedStack(
        index: currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (index) {
          portal.switchTab(index);
        },
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFDBEAFE),
        elevation: 8,
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: Color(0xFF1D4ED8)),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view, color: Color(0xFF1D4ED8)),
            label: 'Catalog',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: cartCount > 0,
              label: Text(cartCount > 99 ? '99+' : '$cartCount'),
              backgroundColor: const Color(0xFFDC2626),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: cartCount > 0,
              label: Text(cartCount > 99 ? '99+' : '$cartCount'),
              backgroundColor: const Color(0xFFDC2626),
              child: const Icon(Icons.shopping_cart, color: Color(0xFF1D4ED8)),
            ),
            label: 'Cart',
          ),
          const NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long, color: Color(0xFF1D4ED8)),
            label: 'Orders',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text(unread > 99 ? '99+' : '$unread'),
              backgroundColor: const Color(0xFFF59E0B),
              child: const Icon(Icons.person_outline),
            ),
            selectedIcon: Badge(
              isLabelVisible: unread > 0,
              label: Text(unread > 99 ? '99+' : '$unread'),
              backgroundColor: const Color(0xFFF59E0B),
              child: const Icon(Icons.person, color: Color(0xFF1D4ED8)),
            ),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

