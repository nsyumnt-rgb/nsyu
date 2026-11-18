// Widget tests for the multi-shop staff picker (no device, network or API).
// Run with: flutter test
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:nsyu_catalog_app/providers/auth_provider.dart';
import 'package:nsyu_catalog_app/providers/visibility_provider.dart';
import 'package:nsyu_catalog_app/screens/staff_shop_picker_screen.dart';

class FakeAuth extends AuthProvider {
  FakeAuth(this._fakeShops, {this.switchError});

  final List<Map<String, dynamic>> _fakeShops;
  final String? switchError;
  final List<int> switched = [];
  int _current = 0;

  @override
  List<Map<String, dynamic>> get shops => _fakeShops;
  @override
  bool get loadingShops => false;
  @override
  String get userName => 'Ravi Kumar';
  @override
  int get shopId => _current;
  @override
  Future<void> loadShops() async {}
  @override
  Future<String?> switchActiveShop(int targetShopId) async {
    switched.add(targetShopId);
    if (switchError == null) _current = targetShopId;
    return switchError;
  }
}

class FakeVisibility extends VisibilityProvider {
  final List<int?> loadedFor = [];
  @override
  Future<void> load({int? shopId}) async => loadedFor.add(shopId);
}

final shops = [
  {'id': 11, 'name': 'Main Road Store', 'code': 'MRS1', 'status': 'active', 'roleName': 'Manager'},
  {'id': 12, 'name': 'Station Branch', 'code': 'STN2', 'status': 'active', 'roleName': 'Billing'},
  {'id': 13, 'name': 'Old Market', 'code': 'OLD3', 'status': 'inactive', 'roleName': 'Sales'},
];

Widget host(FakeAuth auth, FakeVisibility vis, {bool asSwitcher = false}) => MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: auth),
        ChangeNotifierProvider<VisibilityProvider>.value(value: vis),
      ],
      child: MaterialApp(
        home: Builder(
          builder: (context) => asSwitcher
              ? Scaffold(
                  body: Center(
                    child: TextButton(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const StaffShopPickerScreen(asSwitcher: true)),
                      ),
                      child: const Text('open'),
                    ),
                  ),
                )
              : const StaffShopPickerScreen(),
        ),
      ),
    );

void main() {
  testWidgets('lists assigned shops with the role in each shop', (tester) async {
    await tester.pumpWidget(host(FakeAuth(shops), FakeVisibility()));
    await tester.pumpAndSettle();

    expect(find.text('Hi Ravi, choose a shop'), findsOneWidget);
    expect(find.text('Main Road Store'), findsOneWidget);
    expect(find.text('Manager'), findsOneWidget);
    expect(find.text('Station Branch'), findsOneWidget);
    expect(find.text('Billing'), findsOneWidget);
    expect(find.textContaining('inactive'), findsOneWidget);
  });

  testWidgets('tapping a shop switches to it and loads its settings', (tester) async {
    final auth = FakeAuth(shops);
    final vis = FakeVisibility();
    await tester.pumpWidget(host(auth, vis));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Station Branch'));
    await tester.pumpAndSettle();

    expect(auth.switched, [12]);
    expect(vis.loadedFor, [12]);
  });

  testWidgets('inactive shops cannot be chosen', (tester) async {
    final auth = FakeAuth(shops);
    await tester.pumpWidget(host(auth, FakeVisibility()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Old Market'));
    await tester.pumpAndSettle();

    expect(auth.switched, isEmpty);
  });

  testWidgets('a failed switch shows the error and stays on the picker', (tester) async {
    final auth = FakeAuth(shops, switchError: 'Shop is suspended');
    final vis = FakeVisibility();
    await tester.pumpWidget(host(auth, vis));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Main Road Store'));
    await tester.pumpAndSettle();

    expect(find.text('Shop is suspended'), findsOneWidget);
    expect(vis.loadedFor, isEmpty);
  });

  testWidgets('drawer switcher marks the current shop and pops after switching', (tester) async {
    final auth = FakeAuth(shops)..switched.clear();
    await auth.switchActiveShop(11); // currently in shop 11
    auth.switched.clear();

    await tester.pumpWidget(host(auth, FakeVisibility(), asSwitcher: true));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Current'), findsOneWidget);
    await tester.tap(find.text('Main Road Store')); // current shop: no-op
    await tester.pumpAndSettle();
    expect(auth.switched, isEmpty);

    await tester.tap(find.text('Station Branch'));
    await tester.pumpAndSettle();
    expect(auth.switched, [12]);
    expect(find.text('open'), findsOneWidget); // popped back
    expect(find.text('Switched to Station Branch'), findsOneWidget);
  });
}
