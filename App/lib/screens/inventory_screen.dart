import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/catalog_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/app_bottom_nav.dart';

class InventoryScreen extends StatefulWidget {
  final ValueChanged<int>? onNavigate;

  const InventoryScreen({super.key, this.onNavigate});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final _searchCtrl = TextEditingController();
  final _money = NumberFormat('#,##0.00');

  String _selectedCategory = 'All (125)';

  // Image 8 Sample Products Data
  final List<_InventoryTableItem> _seedItems = [
    _InventoryTableItem(sNo: 1, code: 'TC001', name: 'ERD TC-30 USB-A DOCK CHARGER BLK', specs: '5V DC - 500mA (2.5W)', stdPkg: 20, qty: 10, price: 67.0, margin: '10%', slPrice: 77.0, category: 'Chargers'),
    _InventoryTableItem(sNo: 2, code: 'TC-201B', name: 'ERD TC-201 USB-A DOCK CHARGER BLK 5W', specs: '5V DC - 1 Amp (5W)', stdPkg: 20, qty: 5, price: 76.0, margin: '10%', slPrice: 86.0, category: 'Chargers'),
    _InventoryTableItem(sNo: 3, code: 'TC-201', name: 'ERD TC-201 USB-A DOCK CHARGER WHT 5W', specs: '5V DC - 1 Amp (5W)', stdPkg: 60, qty: 3, price: 76.0, margin: '10%', slPrice: 86.0, category: 'Chargers'),
    _InventoryTableItem(sNo: 4, code: 'TC-201M', name: 'ERD TC-201 CHARGER+MICRO USB WHT 5W', specs: '5V DC - 1 Amp (5W)', stdPkg: 60, qty: 2, price: 116.0, margin: '15%', slPrice: 131.0, category: 'Chargers'),
    _InventoryTableItem(sNo: 5, code: 'TC-202B', name: 'ERD TC-202 USB-A DOCK CHARGER BLK 10W', specs: '5V DC - 2 Amp (10W)', stdPkg: 20, qty: 8, price: 92.0, margin: '10%', slPrice: 102.0, category: 'Chargers'),
    _InventoryTableItem(sNo: 6, code: 'TC-202', name: 'ERD TC-202 USB-A DOCK CHARGER WHT 10W', specs: '5V DC - 2 Amp (10W)', stdPkg: 60, qty: 4, price: 92.0, margin: '10%', slPrice: 102.0, category: 'Chargers'),
    _InventoryTableItem(sNo: 7, code: 'TC-203', name: 'ERD TC-203 FAST CHARGER BLK 20W', specs: '5V DC - 3 Amp (20W)', stdPkg: 30, qty: 6, price: 180.0, margin: '12%', slPrice: 202.0, category: 'Chargers'),
    _InventoryTableItem(sNo: 8, code: 'TC-203W', name: 'ERD TC-203 FAST CHARGER WHT 20W', specs: '5V DC - 3 Amp (20W)', stdPkg: 30, qty: 6, price: 180.0, margin: '12%', slPrice: 202.0, category: 'Chargers'),
    _InventoryTableItem(sNo: 9, code: 'CA-001', name: 'USB Type-C Fast Charging Cable', specs: '3A - 1 Meter', stdPkg: 100, qty: 10, price: 120.0, margin: '10%', slPrice: 132.0, category: 'Cables'),
    _InventoryTableItem(sNo: 10, code: 'CA-002', name: 'USB Type-C Fast Charging Cable (2 Meter)', specs: '3A - 2 Meter', stdPkg: 50, qty: 5, price: 180.0, margin: '10%', slPrice: 198.0, category: 'Cables'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<CatalogProvider>();
      if (provider.products.isEmpty) {
        provider.loadProducts();
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _showAddProductDialog() {
    final nameCtrl = TextEditingController();
    final codeCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final stockCtrl = TextEditingController();
    final specCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add New Product'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Product Name *')),
              const SizedBox(height: 8),
              TextField(controller: codeCtrl, decoration: const InputDecoration(labelText: 'SKU / Code *')),
              const SizedBox(height: 8),
              TextField(controller: specCtrl, decoration: const InputDecoration(labelText: 'Voltage / Amp / Type')),
              const SizedBox(height: 8),
              TextField(controller: priceCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Price (₹)')),
              const SizedBox(height: 8),
              TextField(controller: stockCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white),
            onPressed: () {
              final pName = nameCtrl.text.trim();
              if (pName.isEmpty) return;
              final pCode = codeCtrl.text.trim().isNotEmpty ? codeCtrl.text.trim() : 'P-${DateTime.now().millisecondsSinceEpoch}';
              final pPrice = double.tryParse(priceCtrl.text) ?? 100.0;
              final pStock = int.tryParse(stockCtrl.text) ?? 10;
              final pPurchase = pPrice * 0.9;
              final pMargin = pPrice - pPurchase;

              context.read<CatalogProvider>().addProduct(
                code: pCode,
                desc: pName,
                spec: specCtrl.text.trim(),
                purchase: pPurchase,
                marginPrice: pMargin,
                stock: pStock,
                category: 'Mobile Accessories',
              );
              Navigator.pop(ctx);
              showAppSnackBar(context, 'Product added successfully');
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _openEditProductDialog(_InventoryTableItem item) {
    final nameCtrl = TextEditingController(text: item.name);
    final specCtrl = TextEditingController(text: item.specs);
    final qtyCtrl = TextEditingController(text: item.qty.toString());
    final priceCtrl = TextEditingController(text: item.price.toStringAsFixed(2));
    final marginCtrl = TextEditingController(text: item.margin.replaceAll('%', '').trim());

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final p = double.tryParse(priceCtrl.text) ?? item.price;
          final mPercent = double.tryParse(marginCtrl.text) ?? 10.0;
          final mAmt = p * (mPercent / 100.0);
          final calcSlPrice = p + mAmt;

          return AlertDialog(
            title: Text('Edit ${item.code}'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Description')),
                  const SizedBox(height: 8),
                  TextField(controller: specCtrl, decoration: const InputDecoration(labelText: 'Voltage / Amp / Specs')),
                  const SizedBox(height: 8),
                  TextField(
                    controller: qtyCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Quantity (Stock)'),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: priceCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Purchase Price (₹)'),
                    onChanged: (_) => setDialogState(() {}),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: marginCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Margin %'),
                    onChanged: (_) => setDialogState(() {}),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Calculated SLPrice:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        Text('₹${_money.format(calcSlPrice)}',
                            style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF16A34A), fontSize: 14)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF16A34A), foregroundColor: Colors.white),
                onPressed: () {
                  setState(() {
                    item.name = nameCtrl.text.trim();
                    item.specs = specCtrl.text.trim();
                    item.qty = int.tryParse(qtyCtrl.text) ?? item.qty;
                    item.price = double.tryParse(priceCtrl.text) ?? item.price;
                    final m = double.tryParse(marginCtrl.text) ?? 10.0;
                    item.margin = '${m.toInt()}%';
                    item.slPrice = item.price + (item.price * (m / 100.0));
                  });
                  Navigator.pop(ctx);
                  showAppSnackBar(context, 'Product ${item.code} updated successfully');
                },
                child: const Text('Save Changes'),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final categories = [
      'All (125)',
      'Mobile Accessories (42)',
      'Chargers (28)',
      'Cables (18)',
      'Stationery (12)',
      'Computers (15)',
      'Others (8)',
    ];

    // Filter items
    final query = _searchCtrl.text.toLowerCase().trim();
    final filtered = _seedItems.where((item) {
      if (query.isNotEmpty) {
        final matchesQuery = item.name.toLowerCase().contains(query) ||
            item.code.toLowerCase().contains(query) ||
            item.specs.toLowerCase().contains(query);
        if (!matchesQuery) return false;
      }

      if (_selectedCategory == 'Chargers (28)' && item.category != 'Chargers') return false;
      if (_selectedCategory == 'Cables (18)' && item.category != 'Cables') return false;
      if (_selectedCategory == 'Stationery (12)' && item.category != 'Stationery') return false;
      if (_selectedCategory == 'Computers (15)' && item.category != 'Computers') return false;
      return true;
    }).toList();

    final isCompact = MediaQuery.of(context).size.width < 680;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: PreferredSize(
        preferredSize: Size.fromHeight(isCompact ? 116 : 66),
        child: Container(
          color: const Color(0xFF16A34A),
          child: SafeArea(
            bottom: false,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 680;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  child: compact
                      ? Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.arrow_back, color: Colors.white, size: 24),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                                  onPressed: () {
                                    if (widget.onNavigate != null) {
                                      widget.onNavigate!(0);
                                    } else {
                                      Navigator.of(context).maybePop();
                                    }
                                  },
                                ),
                                Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.inventory_2_outlined, color: Colors.white, size: 20),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: const [
                                      Text(
                                        'Inventory',
                                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        'All Products (125)',
                                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.white70),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.filter_list_rounded, color: Colors.white, size: 22),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                                  onPressed: () {},
                                ),
                                const SizedBox(width: 6),
                                InkWell(
                                  onTap: _showAddProductDialog,
                                  borderRadius: BorderRadius.circular(18),
                                  child: Container(
                                    height: 32,
                                    padding: const EdgeInsets.symmetric(horizontal: 10),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(18),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: const [
                                        Icon(Icons.add, size: 16, color: Color(0xFF16A34A)),
                                        SizedBox(width: 4),
                                        Text(
                                          'Add Product',
                                          style: TextStyle(
                                            color: Color(0xFF16A34A),
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Container(
                              height: 38,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: TextField(
                                controller: _searchCtrl,
                                onChanged: (v) => setState(() {}),
                                decoration: const InputDecoration(
                                  hintText: 'Search product name, code or barcode...',
                                  hintStyle: TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                                  prefixIcon: Icon(Icons.search, size: 18, color: Color(0xFF64748B)),
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(vertical: 9),
                                ),
                              ),
                            ),
                          ],
                        )
                      : Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.arrow_back, color: Colors.white, size: 24),
                              onPressed: () {
                                if (widget.onNavigate != null) {
                                  widget.onNavigate!(0);
                                } else {
                                  Navigator.of(context).maybePop();
                                }
                              },
                            ),
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.inventory_2_outlined, color: Colors.white, size: 20),
                            ),
                            const SizedBox(width: 8),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Text(
                                  'Inventory',
                                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white),
                                ),
                                Text(
                                  'All Products (125)',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Colors.white70),
                                ),
                              ],
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Container(
                                height: 38,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: TextField(
                                  controller: _searchCtrl,
                                  onChanged: (v) => setState(() {}),
                                  decoration: const InputDecoration(
                                    hintText: 'Search product name, code or barcode...',
                                    hintStyle: TextStyle(fontSize: 11.5, color: Color(0xFF94A3B8)),
                                    prefixIcon: Icon(Icons.search, size: 18, color: Color(0xFF64748B)),
                                    border: InputBorder.none,
                                    isDense: true,
                                    contentPadding: EdgeInsets.symmetric(vertical: 9),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.filter_list_rounded, color: Colors.white, size: 22),
                              onPressed: () {},
                            ),
                            InkWell(
                              onTap: _showAddProductDialog,
                              borderRadius: BorderRadius.circular(18),
                              child: Container(
                                height: 36,
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(18),
                                ),
                                child: Row(
                                  children: const [
                                    Icon(Icons.add, size: 16, color: Color(0xFF16A34A)),
                                    SizedBox(width: 4),
                                    Text(
                                      'Add Product',
                                      style: TextStyle(
                                        color: Color(0xFF16A34A),
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                );
              },
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          // ── Horizontal Category Chips matching Image 8 ──
          _buildCategoryChips(categories),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // ── Horizontal Scrollable Spreadsheet Table matching Image 8 ──
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.vertical,
              padding: const EdgeInsets.only(bottom: 80),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: 980,
                  child: Column(
                    children: [
                      // Green Spreadsheet Header Row matching Image 8
                      Container(
                        color: const Color(0xFF16A34A),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        child: Row(
                          children: const [
                            SizedBox(width: 36, child: Text('S.No.', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
                            SizedBox(width: 75, child: Text('Code No.', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
                            SizedBox(width: 230, child: Text('Product Description', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
                            SizedBox(width: 140, child: Text('Voltage/Amp/Type', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11))),
                            SizedBox(width: 75, child: Center(child: Text('STD. P\nKG.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10)))),
                            SizedBox(width: 60, child: Center(child: Text('QTY.', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)))),
                            SizedBox(width: 110, child: Center(child: Text('Price\n(Incl. GST)', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 10)))),
                            SizedBox(width: 70, child: Center(child: Text('Margin', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)))),
                            SizedBox(width: 90, child: Center(child: Text('SLPrice', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)))),
                            SizedBox(width: 40, child: Center(child: Icon(Icons.edit_outlined, color: Colors.white, size: 16))),
                          ],
                        ),
                      ),

                      // Rows
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                        itemBuilder: (ctx, i) {
                          final item = filtered[i];
                          return _buildTableRow(item, i);
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: widget.onNavigate != null
          ? AppBottomNav(currentIndex: 2, onTap: widget.onNavigate!)
          : null,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HORIZONTAL CATEGORY CHIPS matching Image 8
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildCategoryChips(List<String> categories) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: categories.map((cat) {
            final isSelected = _selectedCategory == cat;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: InkWell(
                onTap: () => setState(() => _selectedCategory = cat),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFFE8F5E9) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
                      width: isSelected ? 1.4 : 1.0,
                    ),
                  ),
                  child: Text(
                    cat,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? const Color(0xFF16A34A) : const Color(0xFF475569),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TABLE ROW matching Image 8
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildTableRow(_InventoryTableItem item, int index) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // S.No.
          SizedBox(
            width: 36,
            child: Text('${item.sNo}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
          ),

          // Code No.
          SizedBox(
            width: 75,
            child: Text(item.code, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
          ),

          // Product Description with Image Thumbnail
          SizedBox(
            width: 230,
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Center(
                    child: Text('ERD', style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item.name,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5, color: Color(0xFF0F172A)),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),

          // Voltage/Amp/Type
          SizedBox(
            width: 140,
            child: Text(item.specs, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          ),

          // STD. P KG.
          SizedBox(
            width: 75,
            child: Center(
              child: Text('${item.stdPkg}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
            ),
          ),

          // QTY. (Editable Input Box)
          SizedBox(
            width: 60,
            child: Center(
              child: Container(
                width: 44,
                height: 30,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: Center(
                  child: Text(
                    '${item.qty}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                  ),
                ),
              ),
            ),
          ),

          // Price (Incl. GST)
          SizedBox(
            width: 110,
            child: Center(
              child: Text(
                '₹${_money.format(item.price)}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF2563EB)),
              ),
            ),
          ),

          // Margin
          SizedBox(
            width: 70,
            child: Center(
              child: Text(item.margin, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF475569))),
            ),
          ),

          // SLPrice
          SizedBox(
            width: 90,
            child: Center(
              child: Text(
                '₹${_money.format(item.slPrice)}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF16A34A)),
              ),
            ),
          ),

          // ✏️ Edit Action Button
          SizedBox(
            width: 40,
            child: Center(
              child: InkWell(
                onTap: () => _openEditProductDialog(item),
                child: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF16A34A)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InventoryTableItem {
  final int sNo;
  String code;
  String name;
  String specs;
  final int stdPkg;
  int qty;
  double price;
  String margin;
  double slPrice;
  String category;

  _InventoryTableItem({
    required this.sNo,
    required this.code,
    required this.name,
    required this.specs,
    required this.stdPkg,
    required this.qty,
    required this.price,
    required this.margin,
    required this.slPrice,
    required this.category,
  });
}
