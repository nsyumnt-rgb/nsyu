import 'package:flutter_test/flutter_test.dart';
import 'package:nsyu_catalog_app/models/business_profile.dart';
import 'package:nsyu_catalog_app/models/product.dart';
import 'package:nsyu_catalog_app/utils/category_icon_helper.dart';

void main() {
  group('Profile & Business Settings Unit Tests', () {
    test('BusinessProfile model correctly initializes and updates with copyWith', () {
      const profile = BusinessProfile(
        businessName: 'NSYU Traders',
        shopCode: 'NSYU-MAIN',
        ownerName: 'Demo Owner',
        role: 'Owner',
        phone: '8800503662',
        email: 'demo.owner@nsyu.local',
        address: 'Ghaziabad, Uttar Pradesh',
        profileImage: '',
        isOwner: true,
      );

      expect(profile.businessName, 'NSYU Traders');
      expect(profile.role, 'Owner');
      expect(profile.isOwner, true);
      expect(profile.phone, '8800503662');

      final updated = profile.copyWith(
        businessName: 'NSYU Branch Store',
        role: 'Manager',
        isOwner: false,
      );

      expect(updated.businessName, 'NSYU Branch Store');
      expect(updated.role, 'Manager');
      expect(updated.isOwner, false);
      expect(updated.phone, '8800503662'); // Preserved original
    });

    test('CategoryIconHelper provides appropriate fallback icons for keywords', () {
      final chargerIcon = CategoryIconHelper.getIconForCategory('Mobile Charger Single USB');
      final cableIcon = CategoryIconHelper.getIconForCategory('Data Cable Type-C');
      final audioIcon = CategoryIconHelper.getIconForCategory('Wireless Earphone');

      expect(chargerIcon, isNotNull);
      expect(cableIcon, isNotNull);
      expect(audioIcon, isNotNull);
      expect(CategoryIconHelper.availableIcons.length, greaterThan(10));
    });

    test('Product pricing and auto margin calculations evaluate accurately', () {
      final product = Product(
        sno: 1,
        code: 'TC001',
        desc: 'ERD TC-30 USB-A DOCK CHARGER BLK',
        spec: '5V DC - 500mA. (2.5W)',
        category: 'Mobile Charger Single USB',
        pkg: 1,
        purchase: 67.0,
        marginPrice: 10.0,
        sellingPrice: 77.0,
        stock: 0,
      );

      expect(product.purchase, 67.0);
      expect(product.sellingPrice, 77.0);
      expect(product.marginAmount, 10.0);
      // Margin % = (10 / 77) * 100 ≈ 12.987%
      expect(product.marginPercent, closeTo(12.99, 0.05));
    });
  });
}
