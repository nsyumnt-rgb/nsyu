import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/visibility_provider.dart';
import '../theme/app_theme.dart';

/// Lets a staff member choose which assigned shop to work in.
///
/// Shown full-screen by [AuthGate] when a staff session has no shop yet
/// (assigned to several shops), and pushed from the drawer ("Switch shop")
/// when they want to move to another assigned shop. Each shop row shows the
/// role the staff member has in that shop, since roles differ per shop.
class StaffShopPickerScreen extends StatefulWidget {
  /// true when opened from the drawer: shows a back button and pops on success.
  final bool asSwitcher;

  const StaffShopPickerScreen({super.key, this.asSwitcher = false});

  @override
  State<StaffShopPickerScreen> createState() => _StaffShopPickerScreenState();
}

class _StaffShopPickerScreenState extends State<StaffShopPickerScreen> {
  int? _switchingId;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<AuthProvider>().loadShops());
  }

  Future<void> _select(Map<String, dynamic> shop) async {
    final id = int.tryParse('${shop['id']}');
    if (id == null) return;
    final auth = context.read<AuthProvider>();
    final visibility = context.read<VisibilityProvider>();
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);

    setState(() {
      _switchingId = id;
      _error = null;
    });
    final err = await auth.switchActiveShop(id);
    if (!mounted) return;
    setState(() => _switchingId = null);

    if (err != null) {
      setState(() => _error = err);
      return;
    }
    await visibility.load(shopId: id);
    if (widget.asSwitcher) {
      navigator.pop();
      messenger.showSnackBar(
        SnackBar(content: Text('Switched to ${shop['name'] ?? 'shop'}'), backgroundColor: AppColors.emerald),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final shops = auth.shops;
    final first = auth.userName.trim().split(' ').first;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: widget.asSwitcher
          ? AppBar(title: const Text('Switch shop'))
          : null,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: auth.loadShops,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
            children: [
              if (!widget.asSwitcher) ...[
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.emeraldLight,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(Icons.storefront_rounded, color: AppColors.emerald, size: 28),
                ),
                const SizedBox(height: 18),
                Text(
                  first.isNotEmpty ? 'Hi $first, choose a shop' : 'Choose a shop',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 6),
              ],
              const Text(
                "Pick the shop you're working in. Your role can be different in each shop — you can switch any time from the menu.",
                style: TextStyle(fontSize: 13.5, color: AppColors.textSecondary, height: 1.4),
              ),
              const SizedBox(height: 20),
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 13))),
                    ],
                  ),
                ),
              if (auth.loadingShops && shops.isEmpty)
                ...List.generate(
                  2,
                  (_) => Container(
                    height: 72,
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                  ),
                )
              else if (shops.isEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Text(
                    "You haven't been added to a shop yet. Ask your shop owner to assign you, then pull down to refresh.",
                    style: TextStyle(fontSize: 13.5, color: AppColors.textSecondary),
                  ),
                )
              else
                ...shops.map((shop) => _ShopTile(
                      shop: shop,
                      current: widget.asSwitcher && '${shop['id']}' == '${auth.shopId}',
                      busy: _switchingId != null && '${shop['id']}' == '$_switchingId',
                      disabled: _switchingId != null,
                      onTap: () => _select(shop),
                    )),
              const SizedBox(height: 24),
              if (!widget.asSwitcher)
                Center(
                  child: TextButton.icon(
                    onPressed: _switchingId != null ? null : () => auth.logout(),
                    icon: const Icon(Icons.logout_rounded, size: 18),
                    label: const Text('Log out'),
                    style: TextButton.styleFrom(foregroundColor: AppColors.danger),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ShopTile extends StatelessWidget {
  final Map<String, dynamic> shop;
  final bool current;
  final bool busy;
  final bool disabled;
  final VoidCallback onTap;

  const _ShopTile({
    required this.shop,
    required this.current,
    required this.busy,
    required this.disabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final name = shop['name']?.toString() ?? 'Shop';
    final code = shop['code']?.toString() ?? '';
    final role = shop['roleName']?.toString() ?? 'Assigned';
    final inactive = shop['status'] == 'inactive' || shop['status'] == 'suspended';
    final initials = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: (disabled || current || inactive) ? null : onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: current ? AppColors.emerald : AppColors.border, width: current ? 1.5 : 1),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppColors.navy900, AppColors.emerald]),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(initials.isEmpty ? '?' : initials,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                      const SizedBox(height: 2),
                      Text(
                        inactive ? '$code · ${shop['status']}' : code,
                        style: TextStyle(
                          fontSize: 12,
                          color: inactive ? AppColors.danger : AppColors.textSecondary,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (busy)
                  const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
                else if (current)
                  const _Chip(text: 'Current', fg: Colors.white, bg: AppColors.emerald)
                else
                  _Chip(text: role, fg: AppColors.emerald, bg: AppColors.emeraldLight),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String text;
  final Color fg;
  final Color bg;
  const _Chip({required this.text, required this.fg, required this.bg});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(text, style: TextStyle(color: fg, fontSize: 11.5, fontWeight: FontWeight.w700)),
    );
  }
}
