import 'package:flutter/material.dart';

import '../navigation/app_navigation.dart';
import 'bills_list_screen.dart';
import 'inventory_screen.dart';
import 'ledger_screen.dart';

/// Root shell hosting the 3 primary persistent tabs matching Reference Images 1, 5, 8
/// Tab 0: Ledger (Image 1)
/// Tab 1: Bills (Image 5 & 6)
/// Tab 2: Inventory / Catalog (Image 8)
/// Tab 3 (More): Handled dynamically by AppBottomNav opening MoreMenuSheet (Image 4)
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
        _index = AppNavigation.currentTabNotifier.value.clamp(0, 2);
      });
    }
  }

  void _goTo(int i) {
    if (i < 0 || i > 2) return;
    if (_index == i) return;
    AppNavigation.currentTabNotifier.value = i;
    setState(() => _index = i);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (_index != 0) {
          _goTo(0);
        }
      },
      child: IndexedStack(
        index: _index,
        children: [
          LedgerScreen(onNavigate: _goTo),
          BillsListScreen(onNavigate: _goTo),
          InventoryScreen(onNavigate: _goTo),
        ],
      ),
    );
  }
}
