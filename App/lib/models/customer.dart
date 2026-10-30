/// Matches the "Customer.xlsx" schema and Supabase customer model: ID | Customer | Mobile | Balance
class Customer {
  final String id;
  final String? referenceCode;
  String name;
  String mobile;
  String address;
  double currentBalance;
  double openingBalance;
  bool isSupplier;

  Customer({
    required this.id,
    this.referenceCode,
    required this.name,
    this.mobile = '',
    this.address = '',
    this.currentBalance = 0.0,
    this.openingBalance = 0.0,
    this.isSupplier = false,
  });

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
        id: json['id']?.toString() ?? '',
        referenceCode: json['reference_code']?.toString() ?? json['referenceCode']?.toString(),
        name: json['name']?.toString() ?? '',
        mobile: json['mobile']?.toString() ?? '',
        address: json['address']?.toString() ?? '',
        currentBalance: double.tryParse(json['current_balance']?.toString() ?? json['currentBalance']?.toString() ?? '0') ?? 0.0,
        openingBalance: double.tryParse(json['opening_balance']?.toString() ?? json['openingBalance']?.toString() ?? '0') ?? 0.0,
        isSupplier: json['is_supplier'] == true || json['isSupplier'] == true,
      );

  factory Customer.fromSupabase(Map<String, dynamic> json) => Customer(
        id: json['id']?.toString() ?? '',
        referenceCode: json['reference_code']?.toString() ?? json['referenceCode']?.toString(),
        name: json['name']?.toString() ?? '',
        mobile: json['phone']?.toString() ?? json['mobile']?.toString() ?? '',
        address: json['address']?.toString() ?? '',
        currentBalance: double.tryParse(json['current_balance']?.toString() ?? json['currentBalance']?.toString() ?? '0') ?? 0.0,
        openingBalance: double.tryParse(json['opening_balance']?.toString() ?? json['openingBalance']?.toString() ?? '0') ?? 0.0,
        isSupplier: json['is_supplier'] == true || json['isSupplier'] == true,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'reference_code': referenceCode,
        'name': name,
        'mobile': mobile,
        'address': address,
        'current_balance': currentBalance,
        'opening_balance': openingBalance,
        'is_supplier': isSupplier,
      };
}

