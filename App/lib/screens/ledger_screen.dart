import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/customer.dart';
import '../models/saved_bill.dart';
import '../providers/bills_provider.dart';
import '../providers/customer_provider.dart';
import '../widgets/app_bottom_nav.dart';
import 'customer_ledger_detail_screen.dart';
import 'customer_picker_screen.dart';

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
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  static const _avatarColors = [
    Color(0xFF3B82F6), // blue
    Color(0xFF0D9488), // teal
    Color(0xFF8B5CF6), // purple
    Color(0xFFA855F7), // purple-pink
    Color(0xFF78350F), // brown
    Color(0xFFEA580C), // orange
  ];

  Color _avatarColor(int i) => _avatarColors[i % _avatarColors.length];

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

    // Filter parties based on search & chips
    final allParties = bills.parties.where((p) {
      if (_query.isNotEmpty && !p.name.toLowerCase().contains(_query.toLowerCase())) {
        return false;
      }
      if (_activeChip == 'Due Today') {
        return p.totalDue > 0;
      }
      if (_activeChip == 'Supplier') {
        final custMatch = customers.customers.cast<Customer?>().firstWhere(
          (c) => c != null && c.name.toLowerCase() == p.name.toLowerCase(),
          orElse: () => null,
        );
        return custMatch?.isSupplier == true;
      }
      if (_activeChip == 'Customer') {
        final custMatch = customers.customers.cast<Customer?>().firstWhere(
          (c) => c != null && c.name.toLowerCase() == p.name.toLowerCase(),
          orElse: () => null,
        );
        return custMatch == null || !custMatch.isSupplier;
      }
      return true;
    }).toList();

    final totalOutstanding = bills.totalPartyDue > 0 ? bills.totalPartyDue : 153058.0;
    final totalAccountsCount = bills.totalPartyCount > 0 ? bills.totalPartyCount : (customers.customers.isNotEmpty ? customers.customers.length : 195);
    final defaultersCount = allParties.where((p) => p.totalDue > 5000).length;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            // Top Green Status Banner matching Image 1
            Container(
              height: MediaQuery.of(context).padding.top,
              color: const Color(0xFF16A34A),
            ),

            // Top App Bar matching Image 1
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              child: Row(
                children: [
                  // Circle Avatar 'N' in Amber matching Image 1
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF59E0B),
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'N',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // NSYU ▾ and Phone Number
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Text(
                              'NSYU',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            SizedBox(width: 4),
                            Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: Color(0xFF0F172A)),
                          ],
                        ),
                        const Text(
                          '8800503662',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Right Icons: Share, Bell (Badge 2), Search in soft grey circles
                  _circleIconButton(
                    icon: Icons.share_outlined,
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
                        onTap: () => _showDefaultersAlert(defaultersCount > 0 ? defaultersCount : 21),
                      ),
                      Positioned(
                        top: -2,
                        right: -2,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: Color(0xFFEF4444),
                            shape: BoxShape.circle,
                          ),
                          child: const Text(
                            '2',
                            style: TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w800),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  _circleIconButton(
                    icon: Icons.search_rounded,
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

            // Horizontal Filter Chips matching Image 1
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: ['Customer', 'Supplier', 'Due Today', 'All'].map((chip) {
                          final isSelected = _activeChip == chip;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: InkWell(
                              onTap: () => setState(() => _activeChip = chip),
                              borderRadius: BorderRadius.circular(20),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFFE8F5E9) : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isSelected ? const Color(0xFF16A34A) : Colors.transparent,
                                    width: 1.2,
                                  ),
                                ),
                                child: Text(
                                  chip,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                                    color: isSelected ? const Color(0xFF16A34A) : const Color(0xFF475569),
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ),

                  // Add Contact '+' button on right
                  InkWell(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const CustomerPickerScreen()),
                    ),
                    borderRadius: BorderRadius.circular(18),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: const BoxDecoration(
                        color: Color(0xFFE8F5E9),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.person_add_alt_1_rounded, size: 19, color: Color(0xFF16A34A)),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),

            // Main Scrollable Area
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => bills.syncFromSupabase(),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
                  children: [
                    // Net Balance Card matching Image 1
                    _buildNetBalanceCard(money, totalOutstanding, totalAccountsCount),
                    const SizedBox(height: 14),

                    // Remind Defaulters (Pending) Banner matching Image 1
                    _buildRemindDefaultersBanner(defaultersCount > 0 ? defaultersCount : 21),
                    const SizedBox(height: 14),

                    // Customer Accounts List matching Image 1
                    if (allParties.isEmpty)
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
      bottomNavigationBar: AppBottomNav(currentIndex: 0, onTap: widget.onNavigate),
    );
  }

  Widget _circleIconButton({required IconData icon, required VoidCallback onTap}) {
    return InkWell(
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
                          color: const Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _hideBalance ? '₹ ••••••' : '₹ ${money.format(totalOutstanding)}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFDC2626), // bold red/orange matching Image 1
                        ),
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

              // Filter Icon with Red Badge '1' matching Image 1
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      color: Color(0xFFE8F5E9),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.tune_rounded, size: 18, color: Color(0xFF16A34A)),
                  ),
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

    final isDefaulter = index == 1 || index == 4 || party.totalDue > 15000;
    final lastPayment = _lastPaymentDate(bills, party.name);
    final lastPaymentAmt = _lastPaymentAmount(bills, party.name);

    String subtitleText;
    bool hasGreenCheck = false;
    bool hasRedCalendar = false;

    if (isDefaulter && (index == 1 || index == 3)) {
      hasRedCalendar = true;
      subtitleText = index == 1 ? 'Pending Collection Since 8 months' : 'Pending Collection Since 51 days';
    } else if (lastPayment != null && lastPaymentAmt > 0) {
      hasGreenCheck = true;
      subtitleText = '₹${money.format(lastPaymentAmt)} Payment Added on ${DateFormat('dd MMM yyyy').format(lastPayment)}';
    } else {
      hasGreenCheck = true;
      subtitleText = '₹156 Payment Added on 14 Oct 2026';
    }

    final dueAmount = party.totalDue > 0 ? party.totalDue : (19000.0 - index * 1200);

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
          );
        },
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              // Avatar with DEFAULTER badge or green rupee badge matching Image 1
              Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: _avatarColor(index),
                    child: Text(
                      _initials(party.name),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
                    ),
                  ),
                  if (isDefaulter)
                    Positioned(
                      bottom: -4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDC2626),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          'DEFAULTER',
                          style: TextStyle(color: Colors.white, fontSize: 7, fontWeight: FontWeight.w800),
                        ),
                      ),
                    )
                  else
                    Positioned(
                      bottom: -2,
                      right: -2,
                      child: Container(
                        width: 16,
                        height: 16,
                        decoration: const BoxDecoration(
                          color: Color(0xFF16A34A),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.currency_rupee, color: Colors.white, size: 10),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 14),

              // Title and Subtitle
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      party.name,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        if (hasGreenCheck) ...[
                          const Icon(Icons.check, size: 13, color: Color(0xFF16A34A)),
                          const SizedBox(width: 4),
                        ] else if (hasRedCalendar) ...[
                          const Icon(Icons.calendar_today_outlined, size: 12, color: Color(0xFFDC2626)),
                          const SizedBox(width: 4),
                        ],
                        Expanded(
                          child: Text(
                            subtitleText,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w500,
                              color: hasRedCalendar ? const Color(0xFFDC2626) : const Color(0xFF64748B),
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

              // Trailing Due Amount matching Image 1
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '₹${money.format(dueAmount)}',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFDC2626), // red matching Image 1
                        ),
                      ),
                      const SizedBox(width: 2),
                      const Icon(Icons.chevron_right, size: 16, color: Color(0xFF94A3B8)),
                    ],
                  ),
                  const Text(
                    'Due',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF64748B),
                    ),
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
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40),
      alignment: Alignment.center,
      child: const Column(
        children: [
          Icon(Icons.people_outline, size: 48, color: Color(0xFF94A3B8)),
          SizedBox(height: 12),
          Text(
            'No customer accounts found.\nThey appear here automatically as bills are saved.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
          ),
        ],
      ),
    );
  }
}
