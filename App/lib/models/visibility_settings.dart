class VisibilitySettings {
  // Business Information
  final bool showPurchasePrice;
  final bool showMargin;
  final bool showCostPrice;
  final bool showStockQuantity;
  final bool showCustomerOutstanding;
  final bool showProfit;

  // App Modules
  final bool moduleInventory;
  final bool modulePurchase;
  final bool moduleSales;
  final bool moduleBilling;
  final bool moduleCustomers;
  final bool moduleSuppliers;
  final bool modulePayments;
  final bool moduleCustomerLedger;
  final bool moduleEmi;
  final bool moduleEmployees;
  final bool moduleAttendance;
  final bool modulePayroll;
  final bool moduleReports;
  final bool moduleShops;
  final bool moduleRoles;

  // Product Display
  final bool productSku;
  final bool productBarcode;
  final bool productCategoryIcon;
  final bool productBrand;
  final bool productDescription;

  // Bottom Navigation
  final bool navHome;
  final bool navBills;
  final bool navLedger;
  final bool navCatalog;
  final bool navOrders;

  const VisibilitySettings({
    // Business Information (Profit hidden by default)
    this.showPurchasePrice = true,
    this.showMargin = true,
    this.showCostPrice = true,
    this.showStockQuantity = true,
    this.showCustomerOutstanding = true,
    this.showProfit = false,

    // App Modules (EMI hidden by default)
    this.moduleInventory = true,
    this.modulePurchase = true,
    this.moduleSales = true,
    this.moduleBilling = true,
    this.moduleCustomers = true,
    this.moduleSuppliers = true,
    this.modulePayments = true,
    this.moduleCustomerLedger = true,
    this.moduleEmi = false,
    this.moduleEmployees = true,
    this.moduleAttendance = true,
    this.modulePayroll = true,
    this.moduleReports = true,
    this.moduleShops = true,
    this.moduleRoles = true,

    // Product Display (Description hidden by default)
    this.productSku = true,
    this.productBarcode = true,
    this.productCategoryIcon = true,
    this.productBrand = true,
    this.productDescription = false,

    // Bottom Navigation (All 5 visible by default)
    this.navHome = true,
    this.navBills = true,
    this.navLedger = true,
    this.navCatalog = true,
    this.navOrders = true,
  });

  factory VisibilitySettings.defaults() => const VisibilitySettings();

  factory VisibilitySettings.fromJson(Map<String, dynamic> json) {
    return VisibilitySettings(
      // Business Information
      showPurchasePrice: json['show_purchase_price'] ?? json['showPurchasePrice'] ?? true,
      showMargin: json['show_margin'] ?? json['showMargin'] ?? true,
      showCostPrice: json['show_cost_price'] ?? json['showCostPrice'] ?? true,
      showStockQuantity: json['show_stock_quantity'] ?? json['showStockQuantity'] ?? true,
      showCustomerOutstanding: json['show_customer_outstanding'] ?? json['showCustomerOutstanding'] ?? true,
      showProfit: json['show_profit'] ?? json['showProfit'] ?? false,

      // App Modules
      moduleInventory: json['module_inventory'] ?? json['moduleInventory'] ?? true,
      modulePurchase: json['module_purchase'] ?? json['modulePurchase'] ?? true,
      moduleSales: json['module_sales'] ?? json['moduleSales'] ?? true,
      moduleBilling: json['module_billing'] ?? json['moduleBilling'] ?? true,
      moduleCustomers: json['module_customers'] ?? json['moduleCustomers'] ?? true,
      moduleSuppliers: json['module_suppliers'] ?? json['moduleSuppliers'] ?? true,
      modulePayments: json['module_payments'] ?? json['modulePayments'] ?? true,
      moduleCustomerLedger: json['module_customer_ledger'] ?? json['moduleCustomerLedger'] ?? true,
      moduleEmi: json['module_emi'] ?? json['moduleEmi'] ?? false,
      moduleEmployees: json['module_employees'] ?? json['moduleEmployees'] ?? true,
      moduleAttendance: json['module_attendance'] ?? json['moduleAttendance'] ?? true,
      modulePayroll: json['module_payroll'] ?? json['modulePayroll'] ?? true,
      moduleReports: json['module_reports'] ?? json['moduleReports'] ?? true,
      moduleShops: json['module_shops'] ?? json['moduleShops'] ?? true,
      moduleRoles: json['module_roles'] ?? json['moduleRoles'] ?? true,

      // Product Display
      productSku: json['product_sku'] ?? json['productSku'] ?? true,
      productBarcode: json['product_barcode'] ?? json['productBarcode'] ?? true,
      productCategoryIcon: json['product_category_icon'] ?? json['productCategoryIcon'] ?? true,
      productBrand: json['product_brand'] ?? json['productBrand'] ?? true,
      productDescription: json['product_description'] ?? json['productDescription'] ?? false,

      // Bottom Navigation
      navHome: json['nav_home'] ?? json['navHome'] ?? true,
      navBills: json['nav_bills'] ?? json['navBills'] ?? true,
      navLedger: json['nav_ledger'] ?? json['navLedger'] ?? true,
      navCatalog: json['nav_catalog'] ?? json['navCatalog'] ?? true,
      navOrders: json['nav_orders'] ?? json['navOrders'] ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'show_purchase_price': showPurchasePrice,
        'show_margin': showMargin,
        'show_cost_price': showCostPrice,
        'show_stock_quantity': showStockQuantity,
        'show_customer_outstanding': showCustomerOutstanding,
        'show_profit': showProfit,

        'module_inventory': moduleInventory,
        'module_purchase': modulePurchase,
        'module_sales': moduleSales,
        'module_billing': moduleBilling,
        'module_customers': moduleCustomers,
        'module_suppliers': moduleSuppliers,
        'module_payments': modulePayments,
        'module_customer_ledger': moduleCustomerLedger,
        'module_emi': moduleEmi,
        'module_employees': moduleEmployees,
        'module_attendance': moduleAttendance,
        'module_payroll': modulePayroll,
        'module_reports': moduleReports,
        'module_shops': moduleShops,
        'module_roles': moduleRoles,

        'product_sku': productSku,
        'product_barcode': productBarcode,
        'product_category_icon': productCategoryIcon,
        'product_brand': productBrand,
        'product_description': productDescription,

        'nav_home': navHome,
        'nav_bills': navBills,
        'nav_ledger': navLedger,
        'nav_catalog': navCatalog,
        'nav_orders': navOrders,
      };

  VisibilitySettings copyWith({
    bool? showPurchasePrice,
    bool? showMargin,
    bool? showCostPrice,
    bool? showStockQuantity,
    bool? showCustomerOutstanding,
    bool? showProfit,

    bool? moduleInventory,
    bool? modulePurchase,
    bool? moduleSales,
    bool? moduleBilling,
    bool? moduleCustomers,
    bool? moduleSuppliers,
    bool? modulePayments,
    bool? moduleCustomerLedger,
    bool? moduleEmi,
    bool? moduleEmployees,
    bool? moduleAttendance,
    bool? modulePayroll,
    bool? moduleReports,
    bool? moduleShops,
    bool? moduleRoles,

    bool? productSku,
    bool? productBarcode,
    bool? productCategoryIcon,
    bool? productBrand,
    bool? productDescription,

    bool? navHome,
    bool? navBills,
    bool? navLedger,
    bool? navCatalog,
    bool? navOrders,
  }) {
    return VisibilitySettings(
      showPurchasePrice: showPurchasePrice ?? this.showPurchasePrice,
      showMargin: showMargin ?? this.showMargin,
      showCostPrice: showCostPrice ?? this.showCostPrice,
      showStockQuantity: showStockQuantity ?? this.showStockQuantity,
      showCustomerOutstanding: showCustomerOutstanding ?? this.showCustomerOutstanding,
      showProfit: showProfit ?? this.showProfit,

      moduleInventory: moduleInventory ?? this.moduleInventory,
      modulePurchase: modulePurchase ?? this.modulePurchase,
      moduleSales: moduleSales ?? this.moduleSales,
      moduleBilling: moduleBilling ?? this.moduleBilling,
      moduleCustomers: moduleCustomers ?? this.moduleCustomers,
      moduleSuppliers: moduleSuppliers ?? this.moduleSuppliers,
      modulePayments: modulePayments ?? this.modulePayments,
      moduleCustomerLedger: moduleCustomerLedger ?? this.moduleCustomerLedger,
      moduleEmi: moduleEmi ?? this.moduleEmi,
      moduleEmployees: moduleEmployees ?? this.moduleEmployees,
      moduleAttendance: moduleAttendance ?? this.moduleAttendance,
      modulePayroll: modulePayroll ?? this.modulePayroll,
      moduleReports: moduleReports ?? this.moduleReports,
      moduleShops: moduleShops ?? this.moduleShops,
      moduleRoles: moduleRoles ?? this.moduleRoles,

      productSku: productSku ?? this.productSku,
      productBarcode: productBarcode ?? this.productBarcode,
      productCategoryIcon: productCategoryIcon ?? this.productCategoryIcon,
      productBrand: productBrand ?? this.productBrand,
      productDescription: productDescription ?? this.productDescription,

      navHome: navHome ?? this.navHome,
      navBills: navBills ?? this.navBills,
      navLedger: navLedger ?? this.navLedger,
      navCatalog: navCatalog ?? this.navCatalog,
      navOrders: navOrders ?? this.navOrders,
    );
  }
}
