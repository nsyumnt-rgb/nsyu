import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class ProfileTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final bool hideDivider;

  const ProfileTile({
    super.key,
    required this.icon,
    required this.title,
    required this.onTap,
    this.hideDivider = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEBF3FE),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Icon(
                      icon,
                      color: const Color(0xFF1976D2),
                      size: 24,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 22,
                  color: AppColors.muted,
                ),
              ],
            ),
          ),
        ),
        if (!hideDivider)
          const Divider(
            height: 1,
            thickness: 1,
            indent: 76,
            endIndent: 16,
            color: Color(0xFFF1F5F9),
          ),
      ],
    );
  }
}
