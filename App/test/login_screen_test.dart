import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:nsyu_catalog_app/screens/login_screen.dart';
import 'package:nsyu_catalog_app/providers/auth_provider.dart';
import 'package:nsyu_catalog_app/providers/customer_portal_provider.dart';

void main() {
  testWidgets('LoginScreen renders dual-mode switcher and form controls', (WidgetTester tester) async {
    // Provide necessary multi-providers
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
          ChangeNotifierProvider(create: (_) => CustomerPortalProvider()),
        ],
        child: const MaterialApp(
          home: LoginScreen(),
        ),
      ),
    );

    // Initial pump
    await tester.pump();

    // Verify Title and Tagline
    expect(find.text('NSYU Business'), findsOneWidget);
    expect(find.text('Manage Your Business Easily'), findsOneWidget);

    // Verify 3 feature indicators
    expect(find.text('Sales & Billing'), findsOneWidget);
    expect(find.text('Inventory'), findsOneWidget);
    expect(find.text('Customers'), findsOneWidget);

    // Verify dual mode tabs
    expect(find.text('Staff / Owner'), findsOneWidget);
    expect(find.text('Customer Portal'), findsOneWidget);

    // In Staff / Owner mode:
    expect(find.text('Login'), findsOneWidget);
    expect(find.text('Create Account'), findsOneWidget);
    expect(find.text('Remember me'), findsOneWidget);
    expect(find.text('Forgot Password?'), findsOneWidget);

    // Switch to Customer Portal mode
    await tester.tap(find.text('Customer Portal'));
    await tester.pumpAndSettle();

    // Verify customer portal banner
    expect(find.text('Log in to view your bills, payments and ledger details.'), findsOneWidget);
  });
}

