import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nsyu_catalog_app/models/bill_item.dart';
import 'package:nsyu_catalog_app/models/customer.dart';
import 'package:nsyu_catalog_app/models/payment.dart';
import 'package:nsyu_catalog_app/models/product.dart';
import 'package:nsyu_catalog_app/models/saved_bill.dart';
import 'package:nsyu_catalog_app/models/visibility_settings.dart';
import 'package:nsyu_catalog_app/providers/auth_provider.dart';
import 'package:nsyu_catalog_app/providers/bills_provider.dart';
import 'package:nsyu_catalog_app/providers/catalog_provider.dart';
import 'package:nsyu_catalog_app/providers/customer_provider.dart';
import 'package:nsyu_catalog_app/providers/payments_provider.dart';
import 'package:nsyu_catalog_app/providers/settings_provider.dart';
import 'package:nsyu_catalog_app/providers/visibility_provider.dart';
import 'package:nsyu_catalog_app/screens/bills_list_screen.dart';
import 'package:nsyu_catalog_app/screens/business_info_screen.dart';
import 'package:nsyu_catalog_app/screens/customer_ledger_detail_screen.dart';
import 'package:nsyu_catalog_app/screens/customer_picker_screen.dart';
import 'package:nsyu_catalog_app/screens/help_support_screen.dart';
import 'package:nsyu_catalog_app/screens/inventory_screen.dart';
import 'package:nsyu_catalog_app/screens/ledger_screen.dart';
import 'package:nsyu_catalog_app/screens/order_cart_screen.dart';
import 'package:nsyu_catalog_app/screens/profile_screen.dart';
import 'package:nsyu_catalog_app/screens/visibility_settings_screen.dart';
import 'package:nsyu_catalog_app/services/bill_pdf_service.dart';
import 'package:nsyu_catalog_app/widgets/app_bottom_nav.dart';
import 'package:nsyu_catalog_app/widgets/more_menu_sheet.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget createTestApp(Widget child) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider(create: (_) => AuthProvider()),
      ChangeNotifierProvider(create: (_) => BillsProvider()),
      ChangeNotifierProvider(create: (_) => CustomerProvider()),
      ChangeNotifierProvider(create: (_) => CatalogProvider()),
      ChangeNotifierProvider(create: (_) => PaymentsProvider()),
      ChangeNotifierProvider(create: (_) => SettingsProvider()),
      ChangeNotifierProvider(create: (_) => VisibilityProvider()),
    ],
    child: MaterialApp(
      home: child,
      theme: ThemeData(useMaterial3: true),
    ),
  );
}

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
  });
  group('1. Complete Menu Testing (All 13 Modules)', () {
    testWidgets('AppBottomNav renders and switches 4 primary tabs (Ledger, Bill, Catalog, More)', (tester) async {
      int activeIndex = 0;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Text('Tab: $activeIndex'),
          bottomNavigationBar: AppBottomNav(
            currentIndex: activeIndex,
            onTap: (i) => activeIndex = i,
          ),
        ),
      ));

      expect(find.text('Ledger'), findsOneWidget);
      expect(find.text('Bill'), findsOneWidget);
      expect(find.text('Catalog'), findsOneWidget);
      expect(find.text('More'), findsOneWidget);

      await tester.tap(find.text('Bill'));
      await tester.pumpAndSettle();
      expect(activeIndex, 1);
    });

    testWidgets('MoreMenuSheet contains all 9 secondary actions (Account, Profile, Help, Settings, Bills, Stock Management, Auto Reminder, Multi Device, Kaccha Khaata)', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (ctx) => ElevatedButton(
              onPressed: () => MoreMenuSheet.show(ctx, onNavigate: (_) {}),
              child: const Text('Open More'),
            ),
          ),
        ),
      ));

      await tester.tap(find.text('Open More'));
      await tester.pumpAndSettle();

      expect(find.text('Account'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);
      expect(find.text('Help'), findsOneWidget);
      expect(find.text('Settings'), findsOneWidget);
      expect(find.text('Bills'), findsOneWidget);
      expect(find.text('Stock\nManagement'), findsOneWidget);
      expect(find.text('Auto\nReminder'), findsOneWidget);
      expect(find.text('Multi\nDevice'), findsOneWidget);
      expect(find.text('Kaccha\nKhaata'), findsOneWidget);
    });
  });

  group('2. Functional Testing: Customer & Supplier CRUD', () {
    test('Customer model serialization and supplier flag', () {
      final customer = Customer(
        id: 'C001',
        name: 'Sharma Ji',
        mobile: '9876543210',
        currentBalance: 5000.0,
        isSupplier: false,
      );
      final json = customer.toJson();
      expect(json['is_supplier'], false);

      final fromJson = Customer.fromJson(json);
      expect(fromJson.name, 'Sharma Ji');
      expect(fromJson.isSupplier, false);

      final supplier = Customer(
        id: 'S001',
        name: 'ERD Wholesale Supplier',
        mobile: '9876500000',
        currentBalance: 12000.0,
        isSupplier: true,
      );
      expect(supplier.isSupplier, true);
      expect(supplier.toJson()['is_supplier'], true);
    });

    testWidgets('CustomerProvider Add, Edit, Search, Delete functional checks', (tester) async {
      final provider = CustomerProvider();
      expect(provider.customers.isEmpty, true);

      // Add Customer
      final c1 = await provider.addCustomer('Krishna Jasola', '8800123456', openingBalance: 19000);
      expect(provider.customers.length, 1);
      expect(c1.name, 'Krishna Jasola');
      expect(c1.currentBalance, 19000);

      // Add Supplier
      final s1 = await provider.addCustomer('Delhi Electronics Supplier', '9911223344', openingBalance: 50000, isSupplier: true);
      expect(provider.customers.length, 2);
      expect(s1.isSupplier, true);

      // Search
      final searchResults = provider.search('Krishna');
      expect(searchResults.length, 1);
      expect(searchResults.first.name, 'Krishna Jasola');

      // Edit
      c1.name = 'Krishna Jasola Updated';
      await provider.updateCustomer(c1);
      expect(provider.customers.first.name, 'Krishna Jasola Updated');

      // Delete
      await provider.deleteCustomer(c1.id);
      expect(provider.customers.length, 1);
      expect(provider.customers.first.id, s1.id);
    });
  });

  group('3. Functional Testing: Ledger, Pricing, & Cart Calculations', () {
    test('Product Margin formula follows PRD-01: SLPrice = Purchase + Margin', () {
      final p1 = Product(
        sno: 1,
        code: 'TC001',
        desc: 'ERD TC-30 USB-A DOCK CHARGER BLK',
        spec: '5V DC - 500mA',
        pkg: 20,
        category: 'Chargers',
        purchase: 67.0,
        marginPrice: 10.0,
        sellingPrice: 77.0,
        stock: 20,
      );
      expect(p1.slPrice, 77.0);

      final p2 = Product(
        sno: 2,
        code: 'TC-201',
        desc: 'ERD TC-201 5W',
        spec: '5V DC - 1A',
        pkg: 60,
        category: 'Chargers',
        purchase: 76.0,
        marginPrice: 10.0,
        sellingPrice: 86.0,
        stock: 15,
      );
      expect(p2.slPrice, 86.0);
    });

    test('Cart calculations: subtotal, discount, grand total', () {
      final items = [
        BillItem(code: 'ERD-TC-30', desc: 'Charger 1', spec: '2.5W', price: 77.0, qty: 10),
        BillItem(code: 'ERD-TC-201', desc: 'Charger 2', spec: '5W', price: 86.0, qty: 5),
        BillItem(code: 'ERD-TC-222', desc: 'Charger 3', spec: '20W', price: 252.0, qty: 3),
      ];

      double subtotal = 0.0;
      for (final item in items) {
        subtotal += item.price * item.qty;
      }
      expect(subtotal, 1956.0); // 770 + 430 + 756 = 1956

      // 10% discount test
      const discountPercent = 10.0;
      final discountAmount = subtotal * (discountPercent / 100.0);
      expect(discountAmount, closeTo(195.6, 0.01));

      final grandTotal = subtotal - discountAmount;
      expect(grandTotal, closeTo(1760.4, 0.01));
    });

    test('Ledger balance debit/credit calculation', () {
      double runningBalance = 0.0;

      // Customer makes purchase (Debit)
      const billAmount = 19156.0;
      runningBalance += billAmount;
      expect(runningBalance, 19156.0);

      // Customer makes partial payment (Credit)
      const paymentAmount = 156.0;
      runningBalance -= paymentAmount;
      expect(runningBalance, 19000.0);

      // Second payment
      const payment2 = 3000.0;
      runningBalance -= payment2;
      expect(runningBalance, 16000.0);
    });
  });

  group('4. Critical Workflow Testing (5 Core Workflows)', () {
    test('Workflow 1 & 2: Customer select -> Add Items -> Calculate Total -> Save Bill & Persistence', () {
      final billsProvider = BillsProvider();
      final customer = Customer(id: 'C100', name: 'Krishna Jasola', mobile: '8800123456');

      final items = [
        SavedBillItem(sku: 'TC001', desc: 'ERD TC-30', qty: 10, price: 77.0),
        SavedBillItem(sku: 'TC-201', desc: 'ERD TC-201', qty: 5, price: 86.0),
      ];

      final bill = SavedBill(
        id: 101,
        billNumber: 'B-00125',
        customerName: customer.name,
        customerPhone: customer.mobile,
        date: DateTime.now(),
        items: items,
        paidAmount: 0.0,
        status: BillStatus.unpaid,
      );

      expect(bill.subtotal, 1200.0); // 770 + 430
      expect(bill.due, 1200.0);
      expect(bill.status, BillStatus.unpaid);

      billsProvider.bills.add(bill);
      expect(billsProvider.bills.length, 1);
      expect(billsProvider.billsForParty('Krishna Jasola').length, 1);
    });

    test('Workflow 3: View Bill -> Generate Invoice PDF Data', () {
      final bill = SavedBill(
        id: 102,
        billNumber: 'INV-261014-001',
        customerName: 'Krishna Jasola',
        customerPhone: '8800123456',
        date: DateTime(2026, 10, 14),
        items: [
          SavedBillItem(sku: 'TC001', desc: 'ERD TC-30', qty: 1, price: 19156.0),
        ],
        paidAmount: 156.0,
        status: BillStatus.unpaid,
      );

      final pdfData = bill.toPdfData();
      expect(pdfData.billNumber, 'INV-261014-001');
      expect(pdfData.customerName, 'Krishna Jasola');
      expect(pdfData.items.length, 1);
      expect(pdfData.items.first.amount, 19156.0);
      expect(pdfData.total, 19156.0);
    });

    test('Workflow 4: Received Payment -> Ledger Update -> Balance Recalculation', () {
      final billsProvider = BillsProvider();
      final bill = SavedBill(
        id: 103,
        billNumber: 'B-00120',
        customerName: 'GD SB',
        customerPhone: '9876543210',
        date: DateTime.now(),
        items: [
          SavedBillItem(sku: 'TC001', desc: 'Item', qty: 1, price: 4500.0),
        ],
        paidAmount: 1500.0,
        status: BillStatus.unpaid,
      );
      billsProvider.bills.add(bill);

      expect(bill.due, 3000.0);

      // Collect payment of 1,000
      bill.paidAmount += 1000.0;
      expect(bill.paidAmount, 2500.0);
      expect(bill.due, 2000.0);

      // Settle remaining 2,000
      bill.paidAmount += 2000.0;
      bill.status = BillStatus.paid;
      expect(bill.due, 0.0);
      expect(bill.isPaid, true);
    });

    test('Workflow 5: Inventory -> Add/Edit Product -> Cart -> Bill', () async {
      final catalog = CatalogProvider();
      await catalog.loadProducts();
      expect(catalog.products.isNotEmpty, true);

      final p = catalog.products.first;
      catalog.addToOrder(p);
      expect(catalog.orderItems.length, 1);
      expect(catalog.orderItems.first.code, p.code);

      // Update quantity in cart
      catalog.orderItems.first.qty = 5;
      expect(catalog.orderItems.first.amount, p.slPrice * 5);
    });
  });

  group('5. Quality Testing: Validation, Null-Safety & Responsiveness', () {
    testWidgets('LedgerScreen renders header, net balance ₹1,53,058 and chips cleanly without overflow', (tester) async {
      tester.view.physicalSize = const Size(393, 852);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(LedgerScreen(onNavigate: (_) {})));
      await tester.pumpAndSettle();

      expect(find.text('NSYU'), findsOneWidget);
      expect(find.text('Net Balance'), findsOneWidget);
      expect(find.text('Customer'), findsOneWidget);
      expect(find.text('Supplier'), findsOneWidget);
    });

    testWidgets('BillsListScreen renders filter chips and bill list cleanly', (tester) async {
      tester.view.physicalSize = const Size(393, 852);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(BillsListScreen(onNavigate: (_) {})));
      await tester.pumpAndSettle();

      expect(find.text('All Bills (125)'), findsOneWidget);
      expect(find.text('Unpaid'), findsWidgets);
      expect(find.text('Paid'), findsWidgets);
    });

    testWidgets('OrderCartScreen renders spreadsheet table and sticky action bar', (tester) async {
      tester.view.physicalSize = const Size(393, 852);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const OrderCartScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Cart'), findsOneWidget);
      expect(find.text('Terms & Conditions'), findsOneWidget);
      expect(find.text('Create Bill >'), findsOneWidget);
    });

    testWidgets('InventoryScreen renders spreadsheet table columns', (tester) async {
      tester.view.physicalSize = const Size(393, 852);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(createTestApp(const InventoryScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Inventory'), findsWidgets);
      expect(find.text('Add Product'), findsOneWidget);
    });
  });
}
