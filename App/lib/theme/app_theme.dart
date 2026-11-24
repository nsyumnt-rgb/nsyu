import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

export '../widgets/app_ui_components.dart';

/// ── NSYU Premium Design System — Foundation ─────────────────────────────────
/// Palette: White, deep forest green and emerald — shared with the web app tokens.
/// Built for commercial trust, high readability, and effortless non-technical use.
class AppColors {
  // Official Design Tokens — Emerald & Forest Green Palette (web: brand-600 #047857, brand-900 #064E3B)
  // Note: the `navy*` / `blue*` names are kept for backward compatibility; they hold the green brand tones.
  static const navy900 = Color(0xFF064E3B); // headers, primary text on light, primary buttons
  static const navy700 = Color(0xFF047857);
  static const blue600 = Color(0xFF047857); // accent, links, active states (unified emerald)
  static const blue100 = Color(0xFFD1FAE5); // soft surfaces, chips (light green)
  static const blue50 = Color(0xFFECFDF5);  // soft surfaces, active pills (lightest green)
  static const bg = Color(0xFFFAF9F5);      // screen canvas (warm ivory, matches web `canvas`)
  static const surface = Color(0xFFFFFFFF); // card surface
  static const border = Color(0xFFEAE7DD);  // soft 1px border (warm neutral, matches web `border`)
  static const textPrimary = Color(0xFF0F172A);
  static const textSecondary = Color(0xFF64748B);
  static const success = Color(0xFF16A34A);
  static const successBg = Color(0xFFDCFCE7);
  static const emerald = Color(0xFF047857);
  static const emeraldLight = Color(0xFFECFDF5);
  static const warning = Color(0xFFD97706);
  static const warningBg = Color(0xFFFEF3C7);
  static const danger = Color(0xFFDC2626);
  static const dangerBg = Color(0xFFFEE2E2);

  // Backward-compatible aliases
  static const deepNavy = navy900;
  static const navy = navy700;
  static const navy2 = Color(0xFF065F46);
  static const steelBlue = emerald;
  static const skyBlue = Color(0xFF10B981);
  static const surfaceBlue = blue50;
  static const surfaceBlueLight = Color(0xFFF0FDF4);
  static const badgeBlue = blue100;

  static const silver = Color(0xFFCBD5E1);
  static const silverDark = textSecondary;

  static const billGreen = emerald;
  static const billGreenLight = emeraldLight;
  static const billGreenBorder = Color(0xFFA7F3D0);

  static const red = danger;
  static const redLight = dangerBg;
  static const redBorder = Color(0xFFFECACA);

  static const warningLight = warningBg;
  static const warningBorder = Color(0xFFFDE68A);

  static const card = surface;
  static const borderLight = Color(0xFFF1F5F9);
  static const text = textPrimary;
  static const muted = textSecondary;
}

/// Reusable gradients for headers, primary buttons, and highlight hero cards.
class AppGradients {
  static const primary = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF04261D), Color(0xFF064E3B), Color(0xFF047857)],
    stops: [0.0, 0.55, 1.0],
  );

  static const deepNavy = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF04261D), Color(0xFF064E3B), Color(0xFF047857)],
    stops: [0.0, 0.55, 1.0],
  );

  static const subtleBlue = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFECFDF5), Color(0xFFD1FAE5)],
  );

  static const success = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF059669), Color(0xFF10B981)],
  );

  static const accent = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFDC2626), Color(0xFFEF4444)],
  );
}

/// Consistent spacing scale across the app.
class AppSpacing {
  static const xxs = 4.0;
  static const xs = 8.0;
  static const sm = 16.0;
  static const md = 24.0;
  static const lg = 32.0;
  static const xl = 40.0;
}

/// Standardized card and container box decorations.
class AppDecorations {
  static BoxDecoration card({
    Color color = Colors.white,
    double radius = 16.0,
    Color borderColor = AppColors.border,
    double borderWidth = 1.0,
    double shadowOpacity = 0.04,
  }) {
    return BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: borderColor, width: borderWidth),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFF04261D).withValues(alpha: shadowOpacity),
          blurRadius: 16,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  static BoxDecoration badge({
    required Color bg,
    required Color border,
    double radius = 20.0,
  }) {
    return BoxDecoration(
      color: bg,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: border, width: 1.0),
    );
  }
}

/// Typography hierarchy with clean weights and line heights.
class AppTextStyles {
  static const heading = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w800,
    color: AppColors.text,
    letterSpacing: -0.3,
    height: 1.2,
  );

  static const section = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w700,
    color: AppColors.text,
    letterSpacing: -0.2,
    height: 1.25,
  );

  static const body = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w500,
    color: AppColors.text,
    height: 1.35,
  );

  static const subtitle = TextStyle(
    fontSize: 13.5,
    fontWeight: FontWeight.w600,
    color: AppColors.muted,
    height: 1.3,
  );

  static const hint = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
    height: 1.2,
  );

  static const currencyLarge = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    color: AppColors.text,
    letterSpacing: -0.5,
  );

  static const currencyMedium = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: AppColors.text,
  );
}

ThemeData buildAppTheme() => _buildTheme(Brightness.light);
ThemeData buildAppDarkTheme() => _buildTheme(Brightness.dark);

ThemeData _buildTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final bg = isDark ? const Color(0xFF0B1220) : AppColors.bg;
  final card = isDark ? const Color(0xFF141B2D) : AppColors.card;
  final border = isDark ? const Color(0xFF283248) : AppColors.border;
  final text = isDark ? const Color(0xFFE2E8F0) : AppColors.text;
  final muted = isDark ? const Color(0xFF94A3B8) : AppColors.muted;
  final primary = isDark ? const Color(0xFF34D399) : AppColors.emerald;
  const onPrimary = Colors.white;

  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    fontFamily: 'Roboto',
    materialTapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );

  return base.copyWith(
    scaffoldBackgroundColor: bg,
    colorScheme: base.colorScheme.copyWith(
      brightness: brightness,
      primary: primary,
      onPrimary: onPrimary,
      secondary: AppColors.emerald,
      tertiary: AppColors.red,
      onTertiary: Colors.white,
      surface: card,
      onSurface: text,
      error: AppColors.red,
      onError: Colors.white,
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
    textTheme: base.textTheme
        .copyWith(
          headlineSmall: AppTextStyles.heading,
          titleLarge: AppTextStyles.section,
          bodyLarge: AppTextStyles.body,
          bodyMedium: AppTextStyles.subtitle,
          bodySmall: AppTextStyles.hint,
        )
        .apply(bodyColor: text, displayColor: text),
    appBarTheme: AppBarTheme(
      backgroundColor: isDark ? card : Colors.white,
      foregroundColor: isDark ? Colors.white : AppColors.text,
      elevation: 0,
      scrolledUnderElevation: 1,
      centerTitle: false,
      iconTheme: IconThemeData(color: isDark ? Colors.white : AppColors.text, size: 22),
      titleTextStyle: TextStyle(
        color: isDark ? Colors.white : AppColors.text,
        fontSize: 17.5,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
      ),
    ),
    cardTheme: CardThemeData(
      color: card,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: border, width: 1.0),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: onPrimary,
        disabledBackgroundColor: primary.withValues(alpha: 0.4),
        disabledForegroundColor: onPrimary.withValues(alpha: 0.7),
        elevation: 0,
        minimumSize: const Size(64, 48),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 14,
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, letterSpacing: .2),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: onPrimary,
        minimumSize: const Size(64, 48),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, letterSpacing: .2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: primary,
        minimumSize: const Size(64, 48),
        side: BorderSide(color: primary, width: 1.2),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 14,
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: primary,
        minimumSize: const Size(48, 44),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        minimumSize: const Size(40, 40),
        foregroundColor: text,
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: AppColors.emerald,
      foregroundColor: Colors.white,
      elevation: 3,
      highlightElevation: 6,
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: isDark ? const Color(0xFF1C2436) : const Color(0xFFF1F5F9),
      selectedColor: AppColors.surfaceBlue,
      labelStyle: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: text),
      secondaryLabelStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.emerald),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? const Color(0xFF1A2338) : Colors.white,
      hintStyle: TextStyle(color: muted, fontSize: 13.5),
      labelStyle: TextStyle(color: muted, fontSize: 13.5),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 14,
        vertical: 14,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.emerald, width: 1.8),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.red, width: 1.4),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: isDark ? const Color(0xFF1E293B) : AppColors.text,
      contentTextStyle: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w500),
      behavior: SnackBarBehavior.floating,
      elevation: 4,
      insetPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: card,
      surfaceTintColor: Colors.transparent,
      elevation: 6,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      titleTextStyle: TextStyle(color: text, fontSize: 17, fontWeight: FontWeight.w700),
      contentTextStyle: TextStyle(color: text, fontSize: 14, height: 1.4),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: card,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
    ),
    dividerTheme: DividerThemeData(
      color: border,
      thickness: 1,
      space: 1,
    ),
  );
}

/// Helper to show a consistent, modern success/error snackbar from anywhere in the app.
void showAppSnackBar(
  BuildContext context,
  String message, {
  bool isError = false,
  Duration duration = const Duration(seconds: 3),
}) {
  ScaffoldMessenger.of(context).hideCurrentSnackBar();
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      duration: duration,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      backgroundColor: isError ? AppColors.red : AppColors.billGreen,
      content: Row(
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.check_circle_outline,
            color: Colors.white,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13.5),
            ),
          ),
        ],
      ),
    ),
  );
}
