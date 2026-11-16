import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../features/dashboard/screens/home_screen.dart';
import '../models/customer.dart';
import '../models/saved_bill.dart';
import '../providers/auth_provider.dart';
import '../providers/bills_provider.dart';
import '../providers/customer_provider.dart';
import '../providers/notifications_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bottom_nav.dart';
import 'customer_ledger_detail_screen.dart';
import 'customer_picker_screen.dart';
import 'notifications_screen.dart';

/// Main Ledger Screen matching Reference Image 1
class LedgerScreen extends StatefulWidget {
  final ValueChanged<int> onNavigate;

  const LedgerScreen({super.key, required this.onNavigate});

  @override
  State<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends State<LedgerScreen> {
  final _searchCtrl = TextEditingController();
  String _activeChip = 'Customer'; // Customer, Supplier, Due Today, All
  bool _showSearch = false;
  bool _hideBalance = false;
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final bills = context.read<BillsProvider>();
      final customers = context.read<CustomerProvider>();
      if (!bills.loaded) await bills.load();
      if (!bills.syncing) bills.syncFromSupabase();
      if (!customers.loaded) customers.load();
      if (mounted) context.read<NotificationsProvider>().fetchUnreadCount();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  String _initials(String name) => name.trim().isEmpty
      ? '?'
      : name.trim().split(RegExp(r'\s+')).take(2).map((s) => s[0]).join().toUpperCase();

  DateTime? _lastPaymentDate(BillsProvider bills, String customerName) {
    final list = bills.paymentReceipts.where((p) => p.customerName.toLowerCase() == customerName.toLowerCase()).toList();
    if (list.isEmpty) return null;
    list.sort((a, b) => b.date.compareTo(a.date));
    return list.first.date;
  }

  double _lastPaymentAmount(BillsProvider bills, String customerName) {
    final list = bills.paymentReceipts.where((p) => p.customerName.toLowerCase() == customerName.toLowerCase()).toList();
    if (list.isEmpty) return 0.0;
    list.sort((a, b) => b.date.compareTo(a.date));
    return list.first.amount;
  }

  @override
  Widget build(BuildContext context) {
    final bills = context.watch<BillsProvider>();
    final customers = context.watch<CustomerProvider>();
    final money = NumberFormat('#,##0');

    // Build merged authoritative customer ledger parties from CustomerProvider + BillsProvider
    final Map<String, LedgerParty> mergedMap = {};
    for (final c in customers.customers) {
      if (c.isSupplier) continue;
      final key = c.name.trim().toLowerCase();
      final matchingBills = bills.bills.where((b) => b.customerName.trim().toLowerCase() == key).toList();
      mergedMap[key] = LedgerParty(
        name: c.name,
        totalDue: c.currentBalance,
        billCount: matchingBills.length,
      );
    }
    for (final p in bills.parties) {
      final key = p.name.trim().toLowerCase();
      if (!mergedMap.containsKey(key)) {
        mergedMap[key] = p;
      }
    }

    final mergedParties = mergedMap.values.toList()
      ..sort((a, b) => b.totalDue.compareTo(a.totalDue));

    // Filter parties based on search & chips
    final allParties = mergedParties.where((p) {
      if (_query.isNotEmpty && !p.name.toLowerCase().contains(_query.toLowerCase())) {
        return false;
      }
      if (_activeChip == 'Due Today') {
        return p.totalDue > 0;
      }
      return true;
    }).toList();

    final totalOutstanding = mergedParties.where((p) => p.totalDue > 0).fold(0.0, (s, p) => s + p.totalDue);
    final auth = context.watch<AuthProvider>();
    final businessName = auth.shopName.isNotEmpty ? auth.shopName : 'NSYU';
    final businessPhone = auth.shopPhone.isNotEmpty ? auth.shopPhone : (auth.registeredMobile ?? '');
    final initialLetter = businessName.isNotEmpty ? businessName[0].toUpperCase() : 'N';
    final totalAccountsCount = mergedParties.length;
    final defaultersCount = allParties.where((p) => p.totalDue > 5000).length;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            // Top App Bar — Clean, White & Navy Header
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  // Emerald Monogram Avatar
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFF064E3B), Color(0xFF047857)],
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF047857).withValues(alpha: 0.25),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      initialLetter,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Business Name & Phone Number
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              businessName,
                              style: const TextStyle(
                                fontSize: 16.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                                letterSpacing: -0.3,
                              ),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: Color(0xFF64748B)),
                          ],
                        ),
                        if (businessPhone.isNotEmpty)
                          Text(
                            businessPhone,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF64748B),
                            ),
                          ),
                      ],
                    ),
                  ),

                  // Right Icons: Dashboard, Share, Bell, Search
                  _circleIconButton(
                    icon: Icons.dashboard_outlined,
                    tooltip: 'Dashboard & Sales',
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => HomeScreen(onNavigate: widget.onNavigate)),
                      );
                    },
                  ),
                  const SizedBox(width: 8),
                  _circleIconButton(
                    icon: Icons.share_outlined,
                    tooltip: 'Share Ledger Statement',
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Sharing Business Ledger statement via WhatsApp'),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 8),
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      _circleIconButton(
                        icon: Icons.notifications_none_rounded,
                        tooltip: 'Notifications',
                        onTap: () {
                          final notifs = context.read<NotificationsProvider>();
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                          ).then((_) => notifs.fetchUnreadCount());
                        },
                      ),
                      Builder(builder: (ctx) {
                        final unreadNotifs = ctx.watch<NotificationsProvider>().unreadCount;
                        final totalBadge = unreadNotifs > 0 ? unreadNotifs : defaultersCount;
                        if (totalBadge <= 0) return const SizedBox.shrink();
                        return Positioned(
                          top: -2,
                          right: -2,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Color(0xFFDC2626),
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '$totalBadge',
                              style: const TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w800),
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                  const SizedBox(width: 8),
                  _circleIconButton(
                    icon: Icons.search_rounded,
                    tooltip: 'Search Accounts',
                    onTap: () => setState(() => _showSearch = !_showSearch),
                  ),
                ],
              ),
            ),

            // Collapsible search input
            if (_showSearch)
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: TextField(
                  controller: _searchCtrl,
                  autofocus: true,
                  onChanged: (v) => setState(() => _query = v.trim()),
                  decoration: InputDecoration(
                    hintText: 'Search customer accounts...',
                    prefixIcon: const Icon(Icons.search, size: 18),
                    suffixIcon: _query.isNotEmpty
                        ? IconButton(icon: const Icon(Icons.clear, size: 16), onPressed: () => setState(() { _searchCtrl.clear(); _query = ''; }))
                        : null,
                    isDense: true,
                    filled: true,
                    fillColor: const Color(0xFFF1F5F9),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                  ),
                ),
              ),

            // Horizontal Filter Chips — Clean Navy & Subtle Blue Theme
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: ['Customer', 'Due Today', 'All'].map((chip) {
                          final isSelected = _activeChip == chip;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: InkWell(
                              onTap: () => setState(() => _activeChip = chip),
                              borderRadius: BorderRadius.circular(20),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFFECFDF5) : const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isSelected ? const Color(0xFF047857) : const Color(0xFFE2E8F0),
                                    width: 1.2,
                                  ),
                                ),
                                child: Text(
                                  chip,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                                    color: isSelected ? const Color(0xFF047857) : const Color(0xFF64748B),
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),

                  // Add Customer button on right
                  InkWell(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const CustomerPickerScreen()),
                    ),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.navy900,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.add, size: 15, color: Colors.white),
                          SizedBox(width: 4),
                          Text(
                            'Customer',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // Main Scrollable Area
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => Future.wait([
                  bills.syncFromSupabase(),
                  customers.syncFromSupabase(),
                ]),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
                  children: [
                    // Net Balance Card matching Image 1
                    _buildNetBalanceCard(money, totalOutstanding, totalAccountsCount),
                    const SizedBox(height: 14),

                    // Remind Defaulters (Pending) Banner
                    if (defaultersCount > 0) ...[
                      _buildRemindDefaultersBanner(defaultersCount),
                      const SizedBox(height: 14),
                    ],

                    // Customer Accounts List
                    if (!customers.loaded || !bills.loaded)
                      SkeletonLoader.list(count: 4)
                    else if (allParties.isEmpty)
                      _buildEmptyState()
                    else
                      for (int i = 0; i < allParties.length; i++)
                        _buildCustomerAccountTile(context, allParties[i], customers, bills, money, i),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: 0,
        navMode: BottomNavMode.ledger,
        onTap: widget.onNavigate,
      ),
    );
  }

  Widget _circleIconButton({required IconData icon, required VoidCallback onTap, String? tooltip}) {
    final btn = InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 36,
        height: 36,
        decoration: const BoxDecoration(
          color: Color(0xFFF1F5F9),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 19, color: const Color(0xFF334155)),
      ),
    );
    if (tooltip != null) {
      return Tooltip(message: tooltip, child: btn);
    }
    return btn;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. NET BALANCE CARD matching Image 1
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildNetBalanceCard(NumberFormat money, double totalOutstanding, int accountsCount) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Left: Net Balance + Accounts Count
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Net Balance',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.group_outlined, size: 14, color: Color(0xFF64748B)),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        '$accountsCount Accounts',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF64748B),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),

          // Right: Eye toggle + Amount in Red + You Get + Filter with red badge 1
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      InkWell(
                        onTap: () => setState(() => _hideBalance = !_hideBalance),
                        child: Icon(
                          _hideBalance ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                          size: 18,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(width: 6),
                      if (_hideBalance)
                        const Text(
                          '••••••',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: AppColors.danger,
                          ),
                        )
                      else
                        AmountText(
                          amount: totalOutstanding,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: AppColors.danger,
                        ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'You Get',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 12),

              // Filter Icon
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      color: Color(0xFFECFDF5),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.tune_rounded, size: 18, color: Color(0xFF047857)),
                  ),
                  if (_activeChip != 'Customer')
                    Positioned(
                      top: -2,
                      right: -2,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: const BoxDecoration(
                          color: Color(0xFFEF4444),
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: const Text(
                          '1',
                          style: TextStyle(color: Colors.white, fontSize: 8.5, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. REMIND DEFAULTERS BANNER matching Image 1
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildRemindDefaultersBanner(int defaultersCount) {
    return InkWell(
      onTap: () => _showDefaultersAlert(defaultersCount),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2), // pale rose background matching Image 1
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFFECACA)),
        ),
        child: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: const BoxDecoration(
                color: Color(0xFFEF4444),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 16),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Remind Defaulters (Pending)',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
            Text(
              '$defaultersCount Defaulters >',
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFFDC2626),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showDefaultersAlert(int count) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626), size: 24),
                const SizedBox(width: 10),
                Text('$count Defaulters Pending', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'Automated reminders can be sent to all overdue parties via WhatsApp and SMS.',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              icon: const Icon(Icons.send_rounded, size: 18),
              label: const Text('Send WhatsApp Reminders to All'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('WhatsApp reminders initiated for all defaulters!'),
                    backgroundColor: Color(0xFF16A34A),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CUSTOMER ACCOUNT TILE matching Image 1
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildCustomerAccountTile(
    BuildContext context,
    LedgerParty party,
    CustomerProvider customers,
    BillsProvider bills,
    NumberFormat money,
    int index,
  ) {
    Customer? match;
    for (final c in customers.customers) {
      if (c.name.trim().toLowerCase() == party.name.trim().toLowerCase()) {
        match = c;
        break;
      }
    }

    final dueAmount = party.totalDue;
    final lastPayment = _lastPaymentDate(bills, party.name);
    final lastPaymentAmt = _lastPaymentAmount(bills, party.name);

    String subtitleText;
    bool hasGreenCheck = false;
    bool hasRedCalendar = false;

    if (lastPayment != null && lastPaymentAmt > 0) {
      hasGreenCheck = true;
      subtitleText = '₹${money.format(lastPaymentAmt)} Payment Added on ${DateFormat('dd MMM yyyy').format(lastPayment)}';
    } else if (dueAmount > 0) {
      hasRedCalendar = true;
      subtitleText = '${party.billCount} ${party.billCount == 1 ? 'Bill' : 'Bills'} • Pending Collection';
    } else if (dueAmount < 0) {
      hasGreenCheck = true;
      subtitleText = 'Advance Balance • ${party.billCount} ${party.billCount == 1 ? 'Bill' : 'Bills'}';
    } else {
      hasGreenCheck = true;
      subtitleText = party.billCount > 0 ? '${party.billCount} ${party.billCount == 1 ? 'Bill' : 'Bills'} • Settled' : 'Account Settled';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.015),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => CustomerLedgerDetailScreen(
                partyName: party.name,
                customer: match,
              ),
            ),
          ).then((_) {
            bills.syncFromSupabase();
            customers.syncFromSupabase();
          });
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              // Unified Signature Navy Squircle Monogram
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.navy900, AppColors.blue600],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x140B1F4B),
                      blurRadius: 6,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: Text(
                  _initials(party.name),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ),
              const SizedBox(width: 14),

              // Title and Subtitle with 2-line flexible wrapping
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      party.name,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                        letterSpacing: -0.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        if (hasGreenCheck) ...[
                          const Icon(Icons.check, size: 13, color: AppColors.success),
                          const SizedBox(width: 4),
                        ] else if (hasRedCalendar) ...[
                          const Icon(Icons.calendar_today_outlined, size: 12, color: AppColors.danger),
                          const SizedBox(width: 4),
                        ],
                        Expanded(
                          child: Text(
                            subtitleText,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w500,
                              color: hasRedCalendar ? AppColors.danger : AppColors.textSecondary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 10),

              // Trailing Amount with StatusChip
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  AmountText(
                    amount: dueAmount.abs(),
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: dueAmount > 0
                        ? AppColors.danger
                        : dueAmount < 0
                            ? AppColors.success
                            : AppColors.textPrimary,
                  ),
                  const SizedBox(height: 3),
                  StatusChip(
                    label: dueAmount > 0 ? 'Due' : dueAmount < 0 ? 'Advance' : 'Settled',
                    variant: dueAmount > 0
                        ? StatusChipVariant.danger
                        : dueAmount < 0
                            ? StatusChipVariant.success
                            : StatusChipVariant.neutral,
                    fontSize: 10,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return EmptyState(
      icon: Icons.people_outline_rounded,
      title: 'No Customers Found',
      subtitle: _query.isNotEmpty
          ? 'No accounts matching "$_query".'
          : 'Customer accounts appear here automatically as bills and payments are recorded.',
      buttonLabel: _query.isEmpty ? 'Add First Customer' : null,
      onButtonPressed: _query.isEmpty
          ? () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CustomerPickerScreen()),
              )
          : null,
    );
  }
}
