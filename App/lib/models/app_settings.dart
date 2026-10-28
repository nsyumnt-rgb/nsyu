class AppSettings {
  String company;
  String logo;
  String phone;
  String email;
  String terms;
  double marginPrice;

  AppSettings({
    this.company = 'NSYU Traders',
    this.logo = '',
    this.phone = '',
    this.email = '',
    this.terms = '',
    this.marginPrice = 0,
  });

  factory AppSettings.fromJson(Map<String, dynamic> json) => AppSettings(
        company: json['company']?.toString() ?? 'NSYU Traders',
        logo: json['logo']?.toString() ?? '',
        phone: json['phone']?.toString() ?? '',
        email: json['email']?.toString() ?? '',
        terms: json['terms']?.toString() ?? '',
        marginPrice: double.tryParse(json['marginPrice']?.toString() ?? '') ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'company': company,
        'logo': logo,
        'phone': phone,
        'email': email,
        'terms': terms,
        'marginPrice': marginPrice,
      };
}
