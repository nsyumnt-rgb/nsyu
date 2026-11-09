import 'package:flutter/material.dart';

class ChargerIllustration extends StatelessWidget {
  final int thumbnailIndex; // 0: White front, 1: Black front, 2: Side USB-A
  final bool isLarge;

  const ChargerIllustration({
    super.key,
    this.thumbnailIndex = 0,
    this.isLarge = false,
  });

  @override
  Widget build(BuildContext context) {
    final scale = isLarge ? 2.2 : 1.25;
    final isBlack = thumbnailIndex == 1;
    final isSideView = thumbnailIndex == 2;

    return Center(
      child: Transform.scale(
        scale: scale,
        child: SizedBox(
          width: 100,
          height: 100,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Metal AC Prongs
              if (!isSideView) ...[
                Positioned(
                  top: 8,
                  left: 36,
                  child: Container(
                    width: 7,
                    height: 18,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                      border: Border.all(color: const Color(0xFF94A3B8), width: 1),
                    ),
                    child: Center(
                      child: Container(
                        width: 3,
                        height: 3,
                        decoration: const BoxDecoration(
                          color: Color(0xFF64748B),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 8,
                  left: 56,
                  child: Container(
                    width: 7,
                    height: 18,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                      border: Border.all(color: const Color(0xFF94A3B8), width: 1),
                    ),
                    child: Center(
                      child: Container(
                        width: 3,
                        height: 3,
                        decoration: const BoxDecoration(
                          color: Color(0xFF64748B),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ),
                ),
              ],

              // Main Charger Body Block
              Positioned(
                top: 22,
                child: Container(
                  width: 72,
                  height: 68,
                  decoration: BoxDecoration(
                    color: isBlack ? const Color(0xFF1E293B) : Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isBlack ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: isBlack ? 0.25 : 0.08),
                        blurRadius: 8,
                        offset: const Offset(2, 4),
                      ),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Side perspective shade
                      if (!isSideView)
                        Positioned(
                          right: 0,
                          top: 0,
                          bottom: 0,
                          child: Container(
                            width: 12,
                            decoration: BoxDecoration(
                              color: isBlack ? Colors.black26 : const Color(0xFFF1F5F9),
                              borderRadius: const BorderRadius.only(
                                topRight: Radius.circular(8),
                                bottomRight: Radius.circular(8),
                              ),
                            ),
                          ),
                        ),

                      if (isSideView) ...[
                        // USB-A Port on Face
                        Container(
                          width: 28,
                          height: 14,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(3),
                          ),
                          child: Center(
                            child: Container(
                              width: 18,
                              height: 5,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ] else ...[
                        // "ERD" Logo Printed on Face
                        Padding(
                          padding: const EdgeInsets.only(top: 8, right: 6),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'ERD',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                  color: isBlack ? Colors.white : const Color(0xFF0F172A),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

