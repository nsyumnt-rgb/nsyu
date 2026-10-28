import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../navigation/app_navigation.dart';
import '../providers/visibility_provider.dart';
import 'bills_list_screen.dart';
import 'catalog_screen.dart';
import 'home_screen.dart';
import 'orders_screen.dart';
import 'profile_screen.dart';

/// Root shell hosting the 5 primary destinations in an IndexedStack.
/// Preserves screen states, handles Android Back predictably, and responds
/// to programmatic tab changes.
class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    AppNavigation.currentTabNotifier.addListener(_onExternalTabChange);
  }

  @override
  void dispose() {
    AppNavigation.currentTabNotifier.removeListener(_onExternalTabChange);
    super.dispose();
  }

  void _onExternalTabChange() {
    if (mounted && _index != AppNavigation.currentTabNotifier.value) {
      setState(() {
        _index = AppNavigation.currentTabNotifier.value;
      });
    }
  }

  void _goTo(int i) {
    if (_index == i) return; // Prevent duplicate transitions
    AppNavigation.currentTabNotifier.value = i;
    setState(() => _index = i);
  }

  @override
  Widget build(BuildContext context) {
    final visibility = context.watch<VisibilityProvider>();
    final visibleTabs = visibility.visibleNavDestinations;

    // If currently selected tab is hidden, safely switch to the first visible tab
    if (!visibleTabs.contains(_index)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && visibleTabs.isNotEmpty) {
          _goTo(visibleTabs.first);
        }
      });
    }

    return PopScope(
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        // If Android system Back is pressed on any secondary tab, return to first visible tab
        final firstTab = visibleTabs.isNotEmpty ? visibleTabs.first : 0;
        if (_index != firstTab) {
          _goTo(firstTab);
        }
      },
      child: IndexedStack(
        index: _index,
        children: [
          HomeScreen(onNavigate: _goTo),
          CatalogScreen(onNavigate: _goTo),
          BillsListScreen(onNavigate: _goTo),
          OrdersScreen(onNavigate: _goTo),
          ProfileScreen(onNavigate: _goTo),
        ],
      ),
    );
  }
}
