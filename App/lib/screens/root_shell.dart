import 'package:flutter/material.dart';

import '../navigation/app_navigation.dart';
import 'bills_list_screen.dart';
import 'catalog_screen.dart';
import 'ledger_screen.dart';
import 'orders_screen.dart';

/// Root shell hosting the 4 primary persistent tabs:
/// Tab 0: Ledger
/// Tab 1: Bill
/// Tab 2: Order
/// Tab 3: Catalog
/// Tab 4 (More): Handled dynamically by AppBottomNav opening MoreMenuSheet
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
        _index = AppNavigation.currentTabNotifier.value.clamp(0, 3);
      });
    }
  }

  void _goTo(int i) {
    if (i < 0 || i > 3) return;
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
          OrdersScreen(onNavigate: _goTo),
          CatalogScreen(onNavigate: _goTo),
        ],
      ),
    );
  }
}
