import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/bill_item.dart';
import '../models/bill_pdf_data.dart';
import '../models/customer.dart';
import '../models/product.dart';
import '../models/saved_bill.dart';
import '../models/saved_order.dart';
import '../services/supabase_service.dart';
import '../utils/category_icon_helper.dart';

enum LoadStatus { idle, loading, loaded, error }

class CatalogProvider extends ChangeNotifier {
  final SupabaseService _supabaseService = SupabaseService();

  bool savingMargin = false;
  String? marginSaveError;

  bool savingProduct = false;
  String? productSaveError;

  List<Product> _allProducts = [];
  LoadStatus status = LoadStatus.idle;
  String errorMessage = '';

  String searchQuery = '';
  String? categoryFilter;
  bool showPrice = false; // hidden by default — toggle from Settings

  // ---- Bill state ----
  int _billCounter = 1;
  String billNumber = '';
  DateTime billDate = DateTime.now();
  String customerName = '';
  String customerPhone = '';
  Customer? selectedCustomer;
  double previousOutstanding = 0.0;
  bool isFetchingBalance = false;
  double billDiscount = 0.0;
  double billTax = 0.0;
  double paymentReceived = 0.0;
  String paymentMethod = 'cash';
  String paymentReference = '';
  DateTime paymentDate = DateTime.now();
  String paymentRemarks = '';
  final List<BillItem> billItems = [];

  // ---- Order state (built from Catalog exactly like a Bill, but tracked
  // Order -> Delivered instead of generating an invoice) ----
  int _orderCounter = 1;
  String orderNumber = '';
  DateTime orderDate = DateTime.now();
  String orderCustomerName = '';
  final List<BillItem> orderItems = [];

  static const _showPriceKey = 'nsyu_show_purchase_price';

  CatalogProvider() {
    billNumber = _generateBillNumber();
    orderNumber = _generateOrderNumber();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    try {
      await CategoryIconHelper.init();
      final prefs = await SharedPreferences.getInstance();
      showPrice = prefs.getBool(_showPriceKey) ?? false;
      notifyListeners();
    } catch (_) {}
  }

  int get totalProductCount => _allProducts.length;

  List<Product> get products => List.unmodifiable(_allProducts);

  List<String> get categories =>
      _allProducts.map((p) => p.category).toSet().toList();

  List<Product> get filteredProducts {
    return _allProducts.where((p) {
      final matchesQ = p.matchesQuery(searchQuery);
      final matchesCat = categoryFilter == null || categoryFilter == ''
          ? true
          : p.category == categoryFilter;
      return matchesQ && matchesCat;
    }).toList();
  }

  /// Filtered products grouped by category, preserving first-seen order.
  Map<String, List<Product>> get groupedFiltered {
    final grouped = <String, List<Product>>{};
    for (final p in filteredProducts) {
      grouped.putIfAbsent(p.category, () => []).add(p);
    }
    return grouped;
  }

  int get billCount => billItems.fold(0, (s, i) => s + i.qty);

  /// Current bill subtotal: sum of (item.price * item.qty)
  double get billSubtotal => billItems.fold(0, (s, i) => s + i.amount);

  /// Final Bill Total = Subtotal - Discount + Taxes
  double get finalBillTotal => (billSubtotal - billDiscount + billTax) < 0 ? 0 : (billSubtotal - billDiscount + billTax);

  /// Aliased for backward compatibility with existing views
  double get billTotal => finalBillTotal;

  /// Total Amount Payable = Previous Outstanding + Final Bill Total
  double get totalAmountPayable => previousOutstanding + finalBillTotal;

  /// Remaining Outstanding = Total Amount Payable - Payment Received
  double get remainingOutstanding => (totalAmountPayable - paymentReceived) < 0 ? 0 : (totalAmountPayable - paymentReceived);

  int get orderCount => orderItems.fold(0, (s, i) => s + i.qty);

  double get orderTotal => orderItems.fold(0, (s, i) => s + i.amount);

  Future<void> loadProducts() async {
    status = LoadStatus.loading;
    notifyListeners();
    try {
      _allProducts = await _supabaseService.fetchProducts();
      status = LoadStatus.loaded;
    } catch (e) {
      errorMessage = e.toString();
      status = LoadStatus.error;
    }
    notifyListeners();
  }

  /// Updates one product's Margin Price — writes it (and the recomputed
  /// Selling Price) back to the Supabase database, then updates the
  /// in-memory list so the change shows immediately without a full reload.
  /// Returns null on success, or an error message on failure.
  Future<String?> updateProductMarginPrice(Product product, double newMarginPrice) async {
    savingMargin = true;
    marginSaveError = null;
    notifyListeners();
    try {
      final newSelling = await _supabaseService.updateMarginPrice(
        productCode: product.code,
        purchase: product.purchase,
        newMarginPrice: newMarginPrice,
      );
      final idx = _allProducts.indexWhere((p) => p.code == product.code);
      if (idx != -1) {
        _allProducts[idx] = product.copyWith(
          marginPrice: newMarginPrice,
          sellingPrice: newSelling,
        );
      }
      savingMargin = false;
      notifyListeners();
      return null;
    } catch (e) {
      savingMargin = false;
      marginSaveError = e.toString();
      notifyListeners();
      return marginSaveError;
    }
  }

  /// Adds a brand-new item to the catalog: writes it to Supabase PostgreSQL
  /// (via [SupabaseService.addProduct]) and, on success, inserts
  /// it into the in-memory list so it shows up immediately without a full
  /// reload. Returns null on success, or an error message on failure.
  Future<String?> addProduct({
    required String code,
    required String desc,
    String spec = '',
    String category = '',
    int pkg = 1,
    required double purchase,
    double marginPrice = 0,
    int stock = 0,
  }) async {
    savingProduct = true;
    productSaveError = null;
    notifyListeners();
    try {
      final sellingPrice = purchase + marginPrice;
      final sno = await _supabaseService.addProduct(
        code: code,
        desc: desc,
        spec: spec,
        category: category,
        pkg: pkg,
        purchase: purchase,
        marginPrice: marginPrice,
        sellingPrice: sellingPrice,
        stock: stock,
      );
      _allProducts.add(Product(
        sno: sno,
        code: code,
        desc: desc,
        spec: spec,
        pkg: pkg,
        category: category.isEmpty ? 'Other' : category,
        purchase: purchase,
        marginPrice: marginPrice,
        sellingPrice: sellingPrice,
        stock: stock,
      ));
      savingProduct = false;
      notifyListeners();
      return null;
    } catch (e) {
      savingProduct = false;
      productSaveError = e.toString();
      notifyListeners();
      return productSaveError;
    }
  }

  void setSearch(String q) {
    searchQuery = q;
    notifyListeners();
  }

  void setCategory(String? cat) {
    categoryFilter = cat;
    notifyListeners();
  }

  Future<void> toggleShowPrice(bool v) async {
    showPrice = v;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_showPriceKey, v);
    } catch (_) {}
  }

  void refreshCategories() {
    notifyListeners();
  }

  BillItem? billItemFor(String code) {
    for (final i in billItems) {
      if (i.code == code) return i;
    }
    return null;
  }

  void addToBill(Product p) {
    final existing = billItemFor(p.code);
    if (existing != null) {
      existing.qty += 1;
    } else {
      billItems.add(BillItem.fromProduct(p));
    }
    notifyListeners();
  }

  void changeQty(String code, int delta) {
    final item = billItemFor(code);
    if (item == null) return;
    item.qty += delta;
    if (item.qty <= 0) {
      billItems.removeWhere((i) => i.code == code);
    }
    notifyListeners();
  }

  void updateItemPrice(String code, double newPrice) {
    final item = billItemFor(code);
    if (item == null) return;
    item.price = newPrice < 0 ? 0 : newPrice;
    notifyListeners();
  }

  void updateItemQty(String code, int newQty) {
    final item = billItemFor(code);
    if (item == null) return;
    if (newQty <= 0) {
      billItems.removeWhere((i) => i.code == code);
    } else {
      item.qty = newQty;
    }
    notifyListeners();
  }

  void removeItem(String code) {
    billItems.removeWhere((i) => i.code == code);
    notifyListeners();
  }

  void clearBill() {
    billItems.clear();
    paymentReceived = 0.0;
    billDiscount = 0.0;
    billTax = 0.0;
    paymentReference = '';
    paymentRemarks = '';
    notifyListeners();
  }

  BillItem? orderItemFor(String code) {
    for (final i in orderItems) {
      if (i.code == code) return i;
    }
    return null;
  }

  void addToOrder(Product p) {
    final existing = orderItemFor(p.code);
    if (existing != null) {
      existing.qty += 1;
    } else {
      orderItems.add(BillItem.fromProduct(p));
    }
    notifyListeners();
  }

  void changeOrderQty(String code, int delta) {
    final item = orderItemFor(code);
    if (item == null) return;
    item.qty += delta;
    if (item.qty <= 0) {
      orderItems.removeWhere((i) => i.code == code);
    }
    notifyListeners();
  }

  void updateOrderItemQty(String code, int newQty) {
    final item = orderItemFor(code);
    if (item == null) return;
    if (newQty <= 0) {
      orderItems.removeWhere((i) => i.code == code);
    } else {
      item.qty = newQty;
    }
    notifyListeners();
  }

  void removeOrderItem(String code) {
    orderItems.removeWhere((i) => i.code == code);
    notifyListeners();
  }

  void setOrderCustomerName(String name) {
    orderCustomerName = name.trim();
    notifyListeners();
  }

  void setOrderDate(DateTime date) {
    orderDate = date;
    notifyListeners();
  }

  /// Selects a customer and automatically retrieves their current outstanding balance
  /// from the authoritative database ledger.
  Future<void> selectCustomer(Customer c) async {
    selectedCustomer = c;
    customerName = c.name;
    customerPhone = c.mobile;
    previousOutstanding = c.currentBalance;
    isFetchingBalance = true;
    notifyListeners();

    try {
      final balance = await _supabaseService.fetchCustomerOutstanding(c.id);
      previousOutstanding = balance;
      selectedCustomer?.currentBalance = balance;
    } catch (_) {}

    isFetchingBalance = false;
    notifyListeners();
  }

  void updateCustomerInfo(Customer c) {
    if (selectedCustomer != null && selectedCustomer!.id == c.id) {
      selectedCustomer = c;
      customerName = c.name;
      customerPhone = c.mobile;
      notifyListeners();
    }
  }

  void setCustomerName(String name) {
    customerName = name.trim();
    if (selectedCustomer != null && selectedCustomer!.name != customerName) {
      selectedCustomer = null;
      previousOutstanding = 0.0;
    }
    notifyListeners();
  }

  void setBillDiscount(double discount) {
    billDiscount = discount < 0 ? 0 : discount;
    notifyListeners();
  }

  void setBillTax(double tax) {
    billTax = tax < 0 ? 0 : tax;
    notifyListeners();
  }

  void setPaymentReceived(double amount) {
    paymentReceived = amount < 0 ? 0 : amount;
    notifyListeners();
  }

  void setPaymentMethod(String method) {
    paymentMethod = method;
    notifyListeners();
  }

  void setPaymentReference(String ref) {
    paymentReference = ref.trim();
    notifyListeners();
  }

  void setPaymentDate(DateTime date) {
    paymentDate = date;
    notifyListeners();
  }

  void setPaymentRemarks(String remarks) {
    paymentRemarks = remarks.trim();
    notifyListeners();
  }

  void setBillDate(DateTime date) {
    billDate = date;
    notifyListeners();
  }

  /// Clears the current bill and starts a fresh one.
  void startNewBill() {
    _billCounter += 1;
    billNumber = _generateBillNumber();
    billDate = DateTime.now();
    customerName = '';
    customerPhone = '';
    selectedCustomer = null;
    previousOutstanding = 0.0;
    billDiscount = 0.0;
    billTax = 0.0;
    paymentReceived = 0.0;
    paymentMethod = 'cash';
    paymentReference = '';
    paymentDate = DateTime.now();
    paymentRemarks = '';
    isFetchingBalance = false;
    billItems.clear();
    notifyListeners();
  }

  /// Clears the current order cart and starts a fresh one, after the order
  /// has been placed.
  void startNewOrder() {
    _orderCounter += 1;
    orderNumber = _generateOrderNumber();
    orderDate = DateTime.now();
    orderCustomerName = '';
    orderItems.clear();
    notifyListeners();
  }

  /// Unique-ish bill number: INV-YYMMDD-HHmm-counter, so bills saved across
  /// app sessions don't collide.
  String _generateBillNumber() {
    final now = DateTime.now();
    final stamp = '${now.year % 100}${_pad2(now.month)}${_pad2(now.day)}-'
        '${_pad2(now.hour)}${_pad2(now.minute)}';
    return 'INV-$stamp-$_billCounter';
  }

  /// Same idea as [_generateBillNumber] but prefixed ORD- for orders.
  String _generateOrderNumber() {
    final now = DateTime.now();
    final stamp = '${now.year % 100}${_pad2(now.month)}${_pad2(now.day)}-'
        '${_pad2(now.hour)}${_pad2(now.minute)}';
    return 'ORD-$stamp-$_orderCounter';
  }

  String _pad2(int n) => n.toString().padLeft(2, '0');

  /// Converts the current cart into the generic shape [BillPdfService]
  /// builds invoices from.
  BillPdfData toPdfData() => BillPdfData(
        billNumber: billNumber,
        date: billDate,
        customerName: customerName,
        customerPhone: customerPhone,
        items: billItems
            .map((i) => BillPdfLineData(desc: i.desc, qty: i.qty, price: i.price))
            .toList(),
        discount: billDiscount,
        tax: billTax,
        previousOutstanding: previousOutstanding,
        paidAmount: paymentReceived,
      );

  /// Converts the current cart into a [SavedBill] record ready to persist
  /// into bill history / ledger.
  SavedBill toSavedBill() => SavedBill(
        billNumber: billNumber,
        date: billDate,
        customerName: customerName,
        customerPhone: customerPhone,
        items: billItems
            .map((i) => SavedBillItem(desc: i.desc, qty: i.qty, price: i.price))
            .toList(),
        status: remainingOutstanding <= 0.005 && totalAmountPayable > 0
            ? BillStatus.paid
            : BillStatus.unpaid,
        paidAmount: paymentReceived,
        discount: billDiscount,
        tax: billTax,
        previousOutstanding: previousOutstanding,
      );

  /// Converts the current order cart into a [SavedOrder] record ready to
  /// persist into order history.
  SavedOrder toSavedOrder() => SavedOrder(
        orderNumber: orderNumber,
        date: orderDate,
        customerName: orderCustomerName,
        items: orderItems
            .map((i) => SavedOrderItem(desc: i.desc, qty: i.qty, price: i.price))
            .toList(),
        status: OrderStatus.pending,
      );
}
