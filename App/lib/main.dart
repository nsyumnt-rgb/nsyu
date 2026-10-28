import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'config/supabase_config.dart';
import 'providers/auth_provider.dart';
import 'providers/bills_provider.dart';
import 'providers/catalog_provider.dart';
import 'providers/customer_provider.dart';
import 'providers/orders_provider.dart';
import 'providers/payments_provider.dart';
import 'providers/settings_provider.dart';
import 'providers/visibility_provider.dart';
import 'screens/login_screen.dart';
import 'screens/root_shell.dart';
import 'theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SupabaseConfig.init();
  runApp(const NsyuApp());
}

class NsyuApp extends StatelessWidget {
  const NsyuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => CatalogProvider()),
        ChangeNotifierProvider(create: (_) => BillsProvider()),
        ChangeNotifierProvider(create: (_) => OrdersProvider()),
        ChangeNotifierProvider(create: (_) => CustomerProvider()),
        ChangeNotifierProvider(create: (_) => PaymentsProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()),
        ChangeNotifierProvider(create: (_) => VisibilityProvider()),
      ],
      child: MaterialApp(
        title: 'NSYU Mobile Accessories',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        darkTheme: buildAppDarkTheme(),
        themeMode: ThemeMode.system,
        home: const AuthGate(),
      ),
    );
  }
}

/// Shows the Login screen until the owner is logged in, then the app.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      if (!auth.loaded) auth.load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (!auth.loaded) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (auth.isLoggedIn) {
      final visibility = context.read<VisibilityProvider>();
      if (!visibility.loaded) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && !visibility.loaded) {
            visibility.load(shopId: auth.shopId);
          }
        });
      }
    }

    return auth.isLoggedIn ? const RootShell() : const LoginScreen();
  }
}
