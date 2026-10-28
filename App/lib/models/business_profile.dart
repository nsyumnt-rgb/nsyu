class BusinessProfile {
  final String businessName;
  final String shopCode;
  final String ownerName;
  final String role;
  final String phone;
  final String email;
  final String address;
  final String profileImage;
  final bool isOwner;

  const BusinessProfile({
    required this.businessName,
    this.shopCode = '',
    required this.ownerName,
    this.role = 'Owner',
    required this.phone,
    required this.email,
    this.address = '',
    required this.profileImage,
    this.isOwner = true,
  });

  BusinessProfile copyWith({
    String? businessName,
    String? shopCode,
    String? ownerName,
    String? role,
    String? phone,
    String? email,
    String? address,
    String? profileImage,
    bool? isOwner,
  }) {
    return BusinessProfile(
      businessName: businessName ?? this.businessName,
      shopCode: shopCode ?? this.shopCode,
      ownerName: ownerName ?? this.ownerName,
      role: role ?? this.role,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      address: address ?? this.address,
      profileImage: profileImage ?? this.profileImage,
      isOwner: isOwner ?? this.isOwner,
    );
  }
}
