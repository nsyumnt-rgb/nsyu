class AppSettings {
  String company;
  String logo;
  String phone;
  String email;
  String terms;
  double marginPrice;
  String currency;
  String timezone;
  double defaultMargin;
  bool pricesIncludeTax;
  double defaultGstRate;
  String invoicePrefix;
  int nextInvoiceNumber;
  bool allowNegativeStock;
  bool enableCash;
  bool enableUpi;
  bool enableBank;
  bool enableCredit;
  bool allowStaffDiscount;
  double maxStaffDiscountPercent;

  AppSettings({
    this.company = 'NSYU Traders',
    this.logo = '',
    this.phone = '',
    this.email = '',
    this.terms = '',
    this.marginPrice = 0,
    this.currency = 'INR (₹)',
    this.timezone = 'Asia/Kolkata',
    this.defaultMargin = 20.0,
    this.pricesIncludeTax = false,
    this.defaultGstRate = 18.0,
    this.invoicePrefix = 'INV-',
    this.nextInvoiceNumber = 1,
    this.allowNegativeStock = true,
    this.enableCash = true,
    this.enableUpi = true,
    this.enableBank = true,
    this.enableCredit = true,
    this.allowStaffDiscount = true,
    this.maxStaffDiscountPercent = 10.0,
  });

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    final s = json['settings'] is Map<String, dynamic>
        ? json['settings'] as Map<String, dynamic>
        : json;
    return AppSettings(
      company: json['company']?.toString() ??
          json['name']?.toString() ??
          'NSYU Traders',
      logo: json['logo']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      terms: s['invoiceTerms']?.toString() ??
          json['terms']?.toString() ??
          'Thank you for your business! Goods once sold cannot be returned.',
      marginPrice: double.tryParse(s['defaultMargin']?.toString() ??
              json['marginPrice']?.toString() ??
              '') ??
          20.0,
      currency: s['currency']?.toString() ?? 'INR (₹)',
      timezone: s['timezone']?.toString() ?? 'Asia/Kolkata',
      defaultMargin:
          double.tryParse(s['defaultMargin']?.toString() ?? '') ?? 20.0,
      pricesIncludeTax: s['pricesIncludeTax'] == true,
      defaultGstRate:
          double.tryParse(s['defaultGstRate']?.toString() ?? '') ?? 18.0,
      invoicePrefix: s['invoicePrefix']?.toString() ?? 'INV-',
      nextInvoiceNumber:
          int.tryParse(s['nextInvoiceNumber']?.toString() ?? '') ?? 1,
      allowNegativeStock: s['allowNegativeStock'] != false,
      enableCash: s['enableCash'] != false,
      enableUpi: s['enableUpi'] != false,
      enableBank: s['enableBank'] != false,
      enableCredit: s['enableCredit'] != false,
      allowStaffDiscount: s['allowStaffDiscount'] != false,
      maxStaffDiscountPercent:
          double.tryParse(s['maxStaffDiscountPercent']?.toString() ?? '') ??
              10.0,
    );
  }

  Map<String, dynamic> toJson() => {
        'company': company,
        'logo': logo,
        'phone': phone,
        'email': email,
        'terms': terms,
        'marginPrice': marginPrice,
        'currency': currency,
        'timezone': timezone,
        'defaultMargin': defaultMargin,
        'pricesIncludeTax': pricesIncludeTax,
        'defaultGstRate': defaultGstRate,
        'invoicePrefix': invoicePrefix,
        'nextInvoiceNumber': nextInvoiceNumber,
        'allowNegativeStock': allowNegativeStock,
        'enableCash': enableCash,
        'enableUpi': enableUpi,
        'enableBank': enableBank,
        'enableCredit': enableCredit,
        'allowStaffDiscount': allowStaffDiscount,
        'maxStaffDiscountPercent': maxStaffDiscountPercent,
      };
}
