import 'package:flutter/material.dart';

class ProductItemIcon extends StatelessWidget {
  final String name;
  final String? category;
  final String? sku;
  final String? imageUrl;
  final double size;

  const ProductItemIcon({
    super.key,
    required this.name,
    this.category,
    this.sku,
    this.imageUrl,
    this.size = 48.0,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrl != null && imageUrl!.trim().isNotEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(size * 0.22),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.network(
          imageUrl!.trim(),
          fit: BoxFit.contain,
          errorBuilder: (_, __, ___) => _buildVectorIcon(),
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;
            return Center(
              child: SizedBox(
                width: size * 0.4,
                height: size * 0.4,
                child: const CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Color(0xFF047857),
                ),
              ),
            );
          },
        ),
      );
    }

    return _buildVectorIcon();
  }

  Widget _buildVectorIcon() {
    final d = '$name ${category ?? ''} ${sku ?? ''}'.toLowerCase();

    Color bgColor = const Color(0xFFECFDF5);
    Color borderColor = const Color(0xFFD1FAE5);
    Color iconColor = const Color(0xFF047857);
    IconData iconData = Icons.inventory_2_outlined;

    // 1. Mobile Chargers & Dock Adapters
    if (d.contains('charger') ||
        d.contains('dock') ||
        d.contains('chg') ||
        d.contains('adapter') ||
        d.contains('tc-') ||
        d.contains('tc0') ||
        d.contains('cc-') ||
        d.contains('dc-') ||
        d.contains('vook') ||
        d.contains('vooc') ||
        d.contains('pd ') ||
        d.contains('qc ')) {
      bgColor = const Color(0xFFECFDF5);
      borderColor = const Color(0xFFA7F3D0);
      iconColor = const Color(0xFF047857);
      iconData = Icons.power_rounded;
    }
    // 2. Cables & Wires
    else if (d.contains('cable') ||
        d.contains('cbl') ||
        d.contains('wire') ||
        d.contains('uc-') ||
        d.contains('type-c') ||
        d.contains('micro usb') ||
        d.contains('lightning') ||
        d.contains('aux') ||
        d.contains('otg')) {
      bgColor = const Color(0xFFF0F9FF);
      borderColor = const Color(0xFFBAE6FD);
      iconColor = const Color(0xFF0284C7);
      iconData = Icons.cable_rounded;
    }
    // 3. Power Bank
    else if (d.contains('power') ||
        d.contains('bank') ||
        d.contains('pb-') ||
        d.contains('mah')) {
      bgColor = const Color(0xFFFFFBEB);
      borderColor = const Color(0xFFFDE68A);
      iconColor = const Color(0xFFD97706);
      iconData = Icons.battery_charging_full_rounded;
    }
    // 4. Earbuds / TWS
    else if (d.contains('earbud') ||
        d.contains('tws') ||
        d.contains('ows') ||
        d.contains('airpod')) {
      bgColor = const Color(0xFFF5F3FF);
      borderColor = const Color(0xFFDDD6FE);
      iconColor = const Color(0xFF7C3AED);
      iconData = Icons.headset_mic_rounded;
    }
    // 5. Earphones / Headphones
    else if (d.contains('earphone') ||
        d.contains('headphone') ||
        d.contains('we-') ||
        d.contains('hf-')) {
      bgColor = const Color(0xFFEEF2FF);
      borderColor = const Color(0xFFC7D2FE);
      iconColor = const Color(0xFF4F46E5);
      iconData = Icons.headphones_rounded;
    }
    // 6. Bluetooth Speakers
    else if (d.contains('speaker') ||
        d.contains('bts-') ||
        d.contains('bts0')) {
      bgColor = const Color(0xFFFFF1F2);
      borderColor = const Color(0xFFFECDD3);
      iconColor = const Color(0xFFE11D48);
      iconData = Icons.speaker_rounded;
    }
    // 7. Mobile Batteries
    else if (d.contains('battery') ||
        d.contains('bt-') ||
        d.contains('bt0') ||
        d.contains('li-ion')) {
      bgColor = const Color(0xFFF0FDFA);
      borderColor = const Color(0xFF99F6E4);
      iconColor = const Color(0xFF0D9488);
      iconData = Icons.battery_std_rounded;
    }
    // 8. Extension Board / Power Strip
    else if (d.contains('extension') ||
        d.contains('strip') ||
        d.contains('socket') ||
        d.contains('eb-')) {
      bgColor = const Color(0xFFF8FAFC);
      borderColor = const Color(0xFFCBD5E1);
      iconColor = const Color(0xFF334155);
      iconData = Icons.settings_input_composite_rounded;
    }
    // 9. LED Torch / Flashlight
    else if (d.contains('torch') || d.contains('tl-')) {
      bgColor = const Color(0xFFFEFCE8);
      borderColor = const Color(0xFFFEF08A);
      iconColor = const Color(0xFFCA8A04);
      iconData = Icons.flashlight_on_rounded;
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(size * 0.22),
        border: Border.all(color: borderColor, width: 1.2),
      ),
      child: Center(
        child: Icon(
          iconData,
          size: size * 0.52,
          color: iconColor,
        ),
      ),
    );
  }
}
