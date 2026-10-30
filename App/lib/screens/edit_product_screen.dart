import 'package:flutter/material.dart';

import '../models/catalog_item.dart';
import '../theme/app_theme.dart';

/// Edit Product & Product Details Screen matching Reference Image 11
/// Features 1:1 layout with:
/// - Exact Forest Green Header (#006837) with back arrow, 3D cube icon, and two-line title
/// - Side-by-side Top Section: Image container with camera button overlay & Active toggle,
///   Image URL with clear button, Product Code *, Product Name *
/// - Short Description & Full Description multi-line inputs
/// - Category, Brand, Unit, HSN/SAC 2x2 dropdown selectors
/// - Stock / Packaging Mint Green Container (#F0FDF4) with Weight Sack & Stacked Cubes icons
/// - Pricing 3-Column Row: Price (Incl. GST) *, Margin (%) *, SLPrice (Incl. GST) * with auto-calculation
/// - Outlined Cancel & Solid Forest Green Save action buttons
class EditProductScreen extends StatefulWidget {
  final CatalogItem? item;
  final bool isNew;

  const EditProductScreen({
    super.key,
    this.item,
    this.isNew = false,
  });

  @override
  State<EditProductScreen> createState() => _EditProductScreenState();
}

class _EditProductScreenState extends State<EditProductScreen> {
  late final TextEditingController _imageUrlCtrl;
  late final TextEditingController _codeCtrl;
  late final TextEditingController _nameCtrl;
  late final TextEditingController _shortDescCtrl;
  late final TextEditingController _fullDescCtrl;
  late final TextEditingController _stdPkgCtrl;
  late final TextEditingController _qtyCtrl;
  late final TextEditingController _priceCtrl;
  late final TextEditingController _marginCtrl;
  late final TextEditingController _slPriceCtrl;

  late bool _isActive;
  late String _category;
  late String _brand;
  late String _unit;
  late String _hsnSac;

  bool _isAutoCalculating = false;

  final List<String> _categories = [
    'Mobile Accessories',
    'Chargers',
    'Cables',
    'Stationery',
    'Earphones',
    'Others',
  ];

  final List<String> _brands = [
    'ERD',
    'Samsung',
    'Apple',
    'Boat',
    'Noise',
    'Realme',
    'Xiaomi',
    'Generic',
  ];

  final List<String> _units = [
    'PCS',
    'BOX',
    'SET',
    'KG',
    'MTR',
  ];

  final List<String> _hsnCodes = [
    '8504',
    '8517',
    '8518',
    '8544',
    '9023',
    '8471',
  ];

  @override
  void initState() {
    super.initState();
    final it = widget.item;

    _imageUrlCtrl = TextEditingController(text: it?.imageUrl.isNotEmpty == true ? it!.imageUrl : 'https://example.com/images/tc001.jpg');
    _codeCtrl = TextEditingController(text: it?.code ?? 'TC001');
    _nameCtrl = TextEditingController(text: it?.name ?? 'ERD TC-30 USB-A DOCK CHARGER BLK');
    _shortDescCtrl = TextEditingController(text: it?.specs ?? '5V DC - 500mA (2.5W)');
    _fullDescCtrl = TextEditingController(
      text: it?.description ??
          'ERD TC-30 USB-A Dock Charger. 5V DC - 500mA (2.5W).\nSuitable for mobile phones and other devices.',
    );
    _stdPkgCtrl = TextEditingController(text: '${it?.stdPkg ?? 20}');
    _qtyCtrl = TextEditingController(text: '${it?.qty ?? 10}');
    _priceCtrl = TextEditingController(text: it != null ? it.price.toStringAsFixed(2) : '67.00');
    _marginCtrl = TextEditingController(text: it != null && it.margin.isNotEmpty ? it.margin : '10.00');
    _slPriceCtrl = TextEditingController(text: it != null ? it.slPrice.toStringAsFixed(2) : '77.00');

    _isActive = it?.isActive ?? true;
    _category = _categories.contains(it?.category) ? it!.category : 'Mobile Accessories';
    _brand = _brands.contains(it?.brand) ? it!.brand : 'ERD';
    _unit = _units.contains(it?.unit) ? it!.unit : 'PCS';
    _hsnSac = _hsnCodes.contains(it?.hsnSac) ? it!.hsnSac : '8504';

    _priceCtrl.addListener(_onPriceOrMarginChanged);
    _marginCtrl.addListener(_onPriceOrMarginChanged);
  }

  @override
  void dispose() {
    _imageUrlCtrl.dispose();
    _codeCtrl.dispose();
    _nameCtrl.dispose();
    _shortDescCtrl.dispose();
    _fullDescCtrl.dispose();
    _stdPkgCtrl.dispose();
    _qtyCtrl.dispose();
    _priceCtrl.dispose();
    _marginCtrl.dispose();
    _slPriceCtrl.dispose();
    super.dispose();
  }

  void _onPriceOrMarginChanged() {
    if (_isAutoCalculating) return;
    _isAutoCalculating = true;

    final p = double.tryParse(_priceCtrl.text.trim()) ?? 0.0;
    final m = double.tryParse(_marginCtrl.text.trim()) ?? 0.0;
    final sl = p + m;

    _slPriceCtrl.text = sl.toStringAsFixed(2);
    _isAutoCalculating = false;
  }

  void _onSave() {
    final code = _codeCtrl.text.trim();
    final name = _nameCtrl.text.trim();

    if (code.isEmpty || name.isEmpty) {
      showAppSnackBar(context, 'Please enter Product Code and Product Name', isError: true);
      return;
    }

    final price = double.tryParse(_priceCtrl.text.trim()) ?? 67.0;
    final margin = _marginCtrl.text.trim().isNotEmpty ? _marginCtrl.text.trim() : '10.00';
    final slPrice = double.tryParse(_slPriceCtrl.text.trim()) ?? (price + (double.tryParse(margin) ?? 10.0));
    final stdPkg = int.tryParse(_stdPkgCtrl.text.trim()) ?? 20;
    final qty = int.tryParse(_qtyCtrl.text.trim()) ?? 10;

    final updated = CatalogItem(
      sNo: widget.item?.sNo ?? 1,
      code: code,
      name: name,
      specs: _shortDescCtrl.text.trim(),
      stdPkg: stdPkg,
      qty: qty,
      price: price,
      margin: margin,
      slPrice: slPrice,
      category: _category,
      brand: _brand,
      unit: _unit,
      hsnSac: _hsnSac,
      description: _fullDescCtrl.text.trim(),
      imageUrl: _imageUrlCtrl.text.trim(),
      isActive: _isActive,
    );

    Navigator.pop(context, updated);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF006837), // Forest green base header
      body: SafeArea(
        child: Column(
          children: [
            // ── Top Header matching Reference Image 11 ──
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              color: const Color(0xFF006837),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white, size: 24),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const SizedBox(width: 4),
                  const _HeaderIsometricCube(size: 26, color: Colors.white),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.isNew ? 'Add Product' : 'Edit Product',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                      const SizedBox(height: 1),
                      const Text(
                        'Product Details',
                        style: TextStyle(
                          color: Color(0xFFD1FAE5),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // ── Main White Form Container matching Reference Image 11 ──
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 1. Top Section: Left Image Box & Right Fields (Image URL, Code, Name)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Left: Product Image with Camera overlay
                          _buildImageBox(),
                          const SizedBox(width: 14),

                          // Right Column: Active toggle, Image URL, Code, Name
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Active toggle row
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    const Text(
                                      'Active',
                                      style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF334155),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    SizedBox(
                                      height: 28,
                                      child: Switch(
                                        value: _isActive,
                                        activeThumbColor: Colors.white,
                                        activeTrackColor: const Color(0xFF006837),
                                        inactiveThumbColor: Colors.white,
                                        inactiveTrackColor: const Color(0xFFCBD5E1),
                                        onChanged: (v) => setState(() => _isActive = v),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),

                                // Image URL Field
                                _buildFieldLabel('Image URL'),
                                const SizedBox(height: 4),
                                SizedBox(
                                  height: 38,
                                  child: TextField(
                                    controller: _imageUrlCtrl,
                                    style: const TextStyle(fontSize: 12.5, color: Color(0xFF0F172A)),
                                    decoration: InputDecoration(
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(8),
                                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(8),
                                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                      ),
                                      focusedBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(8),
                                        borderSide: const BorderSide(color: Color(0xFF006837), width: 1.5),
                                      ),
                                      suffixIcon: GestureDetector(
                                        onTap: () => _imageUrlCtrl.clear(),
                                        child: const Icon(Icons.cancel, color: Color(0xFF94A3B8), size: 17),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                const Text(
                                  'Enter image URL (JPG, PNG)',
                                  style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                ),
                                const SizedBox(height: 10),

                                // Product Code *
                                _buildFieldLabel('Product Code', isRequired: true),
                                const SizedBox(height: 4),
                                SizedBox(
                                  height: 38,
                                  child: TextField(
                                    controller: _codeCtrl,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                                    decoration: _inputDecoration(),
                                  ),
                                ),
                                const SizedBox(height: 10),

                                // Product Name *
                                _buildFieldLabel('Product Name', isRequired: true),
                                const SizedBox(height: 4),
                                SizedBox(
                                  height: 38,
                                  child: TextField(
                                    controller: _nameCtrl,
                                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                                    decoration: _inputDecoration(),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // 2. Short Description
                      _buildFieldLabel('Short Description'),
                      const SizedBox(height: 4),
                      SizedBox(
                        height: 38,
                        child: TextField(
                          controller: _shortDescCtrl,
                          style: const TextStyle(fontSize: 12.5, color: Color(0xFF0F172A)),
                          decoration: _inputDecoration(),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // 3. Full Description
                      _buildFieldLabel('Full Description'),
                      const SizedBox(height: 4),
                      TextField(
                        controller: _fullDescCtrl,
                        maxLines: 3,
                        style: const TextStyle(fontSize: 12.5, color: Color(0xFF0F172A), height: 1.35),
                        decoration: InputDecoration(
                          contentPadding: const EdgeInsets.all(10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: Color(0xFF006837), width: 1.5),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // 4. Dropdowns 2x2 Grid: Category & Brand, Unit & HSN/SAC
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel('Category', isRequired: true),
                                const SizedBox(height: 4),
                                _buildDropdown<String>(
                                  value: _category,
                                  items: _categories,
                                  onChanged: (v) {
                                    if (v != null) setState(() => _category = v);
                                  },
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel('Brand', isRequired: true),
                                const SizedBox(height: 4),
                                _buildDropdown<String>(
                                  value: _brand,
                                  items: _brands,
                                  onChanged: (v) {
                                    if (v != null) setState(() => _brand = v);
                                  },
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel('Unit', isRequired: true),
                                const SizedBox(height: 4),
                                _buildDropdown<String>(
                                  value: _unit,
                                  items: _units,
                                  onChanged: (v) {
                                    if (v != null) setState(() => _unit = v);
                                  },
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel('HSN/SAC', isRequired: true),
                                const SizedBox(height: 4),
                                _buildDropdown<String>(
                                  value: _hsnSac,
                                  items: _hsnCodes,
                                  onChanged: (v) {
                                    if (v != null) setState(() => _hsnSac = v);
                                  },
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // 5. Stock / Packaging Mint Green Container (#F0FDF4)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFDCFCE7)),
                        ),
                        child: Row(
                          children: [
                            // Left: STD. P KG.
                            Expanded(
                              child: Row(
                                children: [
                                  const _WeightSackIcon(size: 32, color: Color(0xFF334155)),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'STD. P KG.',
                                          style: TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF475569),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        SizedBox(
                                          height: 34,
                                          child: TextField(
                                            controller: _stdPkgCtrl,
                                            keyboardType: TextInputType.number,
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                            decoration: InputDecoration(
                                              filled: true,
                                              fillColor: Colors.white,
                                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                              border: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(6),
                                                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                              ),
                                              enabledBorder: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(6),
                                                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                              ),
                                              focusedBorder: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(6),
                                                borderSide: const BorderSide(color: Color(0xFF006837), width: 1.5),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),

                            // Right: QTY.
                            Expanded(
                              child: Row(
                                children: [
                                  const _StackedCubesIcon(size: 32, color: Color(0xFF334155)),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          'QTY.',
                                          style: TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF475569),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        SizedBox(
                                          height: 34,
                                          child: TextField(
                                            controller: _qtyCtrl,
                                            keyboardType: TextInputType.number,
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                            decoration: InputDecoration(
                                              filled: true,
                                              fillColor: Colors.white,
                                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                              border: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(6),
                                                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                              ),
                                              enabledBorder: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(6),
                                                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                              ),
                                              focusedBorder: OutlineInputBorder(
                                                borderRadius: BorderRadius.circular(6),
                                                borderSide: const BorderSide(color: Color(0xFF006837), width: 1.5),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // 6. Pricing 2-Column Row: Price (Incl GST) * & Margin matching Reference Image
                      Row(
                        children: [
                          // Price (Incl GST) *
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel('Price (Incl GST)', isRequired: true),
                                const SizedBox(height: 4),
                                SizedBox(
                                  height: 38,
                                  child: TextField(
                                    controller: _priceCtrl,
                                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                    decoration: _pricingDecoration('₹'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 14),

                          // Margin
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildFieldLabel('Margin', isRequired: false),
                                const SizedBox(height: 4),
                                SizedBox(
                                  height: 38,
                                  child: TextField(
                                    controller: _marginCtrl,
                                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                    decoration: _inputDecoration(),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // 7. Bottom Action Buttons: Cancel (Outline) & Save (Solid Forest Green)
                      Row(
                        children: [
                          Expanded(
                            child: SizedBox(
                              height: 46,
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF006837),
                                  side: const BorderSide(color: Color(0xFF006837), width: 1.6),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onPressed: () => Navigator.pop(context),
                                child: const Text(
                                  'Cancel',
                                  style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: SizedBox(
                              height: 46,
                              child: ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF006837),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onPressed: _onSave,
                                child: const Text(
                                  'Save',
                                  style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HELPER WIDGETS
  // ──────────────────────────────────────────────────────────────────────────

  Widget _buildImageBox() {
    return Container(
      width: 112,
      height: 112,
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          // 3D Charger Preview
          const _ChargerIsometricIllustration(),

          // Circular Camera Action Button
          Positioned(
            right: 4,
            bottom: 4,
            child: InkWell(
              onTap: () {
                showAppSnackBar(context, 'Select camera or gallery to update product image');
              },
              borderRadius: BorderRadius.circular(15),
              child: Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(
                  color: Color(0xFF334155),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.camera_alt_outlined, color: Colors.white, size: 15),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFieldLabel(String text, {bool isRequired = false}) {
    if (!isRequired) {
      return Text(
        text,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
      );
    }
    return RichText(
      text: TextSpan(
        text: text,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
        children: const [
          TextSpan(text: ' *', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  InputDecoration _inputDecoration() {
    return InputDecoration(
      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFF006837), width: 1.5),
      ),
    );
  }

  InputDecoration _pricingDecoration(String prefix) {
    return InputDecoration(
      prefixIcon: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Text(
          prefix,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
        ),
      ),
      prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFF006837), width: 1.5),
      ),
    );
  }

  Widget _buildDropdown<T>({
    required T value,
    required List<T> items,
    required ValueChanged<T?> onChanged,
  }) {
    return Container(
      height: 38,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFCBD5E1)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B), size: 19),
          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
          items: items.map((e) => DropdownMenuItem(value: e, child: Text('$e'))).toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CUSTOM VECTOR PAINTERS MATCHING REFERENCE IMAGE 11
// ────────────────────────────────────────────────────────────────────────────

/// Isometric Cube Header Icon
class _HeaderIsometricCube extends StatelessWidget {
  final double size;
  final Color color;

  const _HeaderIsometricCube({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _IsometricCubePainter(color),
      ),
    );
  }
}

class _IsometricCubePainter extends CustomPainter {
  final Color color;
  _IsometricCubePainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final w = size.width;
    final h = size.height;
    final cx = w / 2;
    final cy = h / 2;
    final r = w * 0.44;

    // Hexagon outline of isometric box
    final top = Path()
      ..moveTo(cx, cy - r)
      ..lineTo(cx + r * 0.86, cy - r * 0.5)
      ..lineTo(cx, cy)
      ..lineTo(cx - r * 0.86, cy - r * 0.5)
      ..close();
    canvas.drawPath(top, stroke);

    final left = Path()
      ..moveTo(cx - r * 0.86, cy - r * 0.5)
      ..lineTo(cx, cy)
      ..lineTo(cx, cy + r)
      ..lineTo(cx - r * 0.86, cy + r * 0.5)
      ..close();
    canvas.drawPath(left, stroke);

    final right = Path()
      ..moveTo(cx, cy)
      ..lineTo(cx + r * 0.86, cy - r * 0.5)
      ..lineTo(cx + r * 0.86, cy + r * 0.5)
      ..lineTo(cx, cy + r)
      ..close();
    canvas.drawPath(right, stroke);
  }

  @override
  bool shouldRepaint(covariant _IsometricCubePainter oldDelegate) => oldDelegate.color != color;
}

/// Weight Sack with Dollar symbol matching Reference Image 11
class _WeightSackIcon extends StatelessWidget {
  final double size;
  final Color color;

  const _WeightSackIcon({this.size = 28, this.color = const Color(0xFF334155)});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _WeightSackPainter(color),
      ),
    );
  }
}

class _WeightSackPainter extends CustomPainter {
  final Color color;
  _WeightSackPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.7
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final w = size.width;
    final h = size.height;

    // Tied sack top loop handle
    canvas.drawArc(
      Rect.fromLTWH(w * 0.35, h * 0.05, w * 0.30, h * 0.22),
      3.14,
      3.14,
      false,
      stroke,
    );

    // Sack bell body
    final path = Path();
    path.moveTo(w * 0.33, h * 0.28);
    path.lineTo(w * 0.67, h * 0.28);
    path.quadraticBezierTo(w * 0.88, h * 0.34, w * 0.88, h * 0.70);
    path.quadraticBezierTo(w * 0.88, h * 0.92, w * 0.50, h * 0.92);
    path.quadraticBezierTo(w * 0.12, h * 0.92, w * 0.12, h * 0.70);
    path.quadraticBezierTo(w * 0.12, h * 0.34, w * 0.33, h * 0.28);
    path.close();

    canvas.drawPath(path, stroke);

    // Dollar symbol in center of sack
    final textPainter = TextPainter(
      text: TextSpan(
        text: '\$',
        style: TextStyle(
          color: color,
          fontSize: size.width * 0.36,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();

    textPainter.paint(
      canvas,
      Offset((w - textPainter.width) / 2, h * 0.44),
    );
  }

  @override
  bool shouldRepaint(covariant _WeightSackPainter oldDelegate) => oldDelegate.color != color;
}

/// 3 Stacked Isometric Cubes matching Reference Image 11
class _StackedCubesIcon extends StatelessWidget {
  final double size;
  final Color color;

  const _StackedCubesIcon({this.size = 28, this.color = const Color(0xFF334155)});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _StackedCubesPainter(color),
      ),
    );
  }
}

class _StackedCubesPainter extends CustomPainter {
  final Color color;
  _StackedCubesPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final w = size.width;
    final h = size.height;

    void drawCube(double cx, double cy, double s) {
      final top = Path()
        ..moveTo(cx, cy - s)
        ..lineTo(cx + s * 0.86, cy - s * 0.5)
        ..lineTo(cx, cy)
        ..lineTo(cx - s * 0.86, cy - s * 0.5)
        ..close();
      canvas.drawPath(top, stroke);

      final left = Path()
        ..moveTo(cx - s * 0.86, cy - s * 0.5)
        ..lineTo(cx, cy)
        ..lineTo(cx, cy + s)
        ..lineTo(cx - s * 0.86, cy + s * 0.5)
        ..close();
      canvas.drawPath(left, stroke);

      final right = Path()
        ..moveTo(cx, cy)
        ..lineTo(cx + s * 0.86, cy - s * 0.5)
        ..lineTo(cx + s * 0.86, cy + s * 0.5)
        ..lineTo(cx, cy + s)
        ..close();
      canvas.drawPath(right, stroke);
    }

    // Three stacked cubes matching screenshot icon
    drawCube(w * 0.32, h * 0.65, w * 0.20);
    drawCube(w * 0.68, h * 0.65, w * 0.20);
    drawCube(w * 0.50, h * 0.32, w * 0.20);
  }

  @override
  bool shouldRepaint(covariant _StackedCubesPainter oldDelegate) => oldDelegate.color != color;
}

/// 3D ERD TC-30 Charger Illustration
class _ChargerIsometricIllustration extends StatelessWidget {
  const _ChargerIsometricIllustration();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 76,
      height: 76,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Metal Prongs
          Positioned(
            top: 6,
            left: 26,
            child: Container(
              width: 5,
              height: 14,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(1.5),
                border: Border.all(color: const Color(0xFF94A3B8), width: 0.8),
              ),
            ),
          ),
          Positioned(
            top: 6,
            left: 44,
            child: Container(
              width: 5,
              height: 14,
              decoration: BoxDecoration(
                color: const Color(0xFFCBD5E1),
                borderRadius: BorderRadius.circular(1.5),
                border: Border.all(color: const Color(0xFF94A3B8), width: 0.8),
              ),
            ),
          ),

          // Charger Body Front Block
          Positioned(
            top: 16,
            child: Container(
              width: 52,
              height: 50,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 6,
                    offset: Offset(0, 3),
                  ),
                ],
              ),
              child: const Center(
                child: Text(
                  'ERD',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.8,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
