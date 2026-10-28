import 'package:flutter/material.dart';

/// ── NSYU Design System — Foundation ─────────────────────────────────────
/// Palette: Logo Blue (primary) · Silver (secondary) · Red (accent) ·
/// Green (success). All existing field NAMES are kept unchanged (navy,
/// steelBlue, red, muted, billGreen, text, border, bg, card, silver) so
/// every screen that already reads AppColors.xxx picks up the new palette
/// automatically — no per-screen rename needed.
class AppColors {
  // Primary — logo blue (used for AppBars, headers, badges, primary actions)
  static const navy = Color(0xFF1D4ED8); // rich logo blue (was near-black navy)
  static const navy2 = Color(0xFF1E40AF); // darker blue, for gradients
  static const steelBlue = Color(0xFF2563EB); // slightly lighter blue accent

  // Secondary — silver
  static const silver = Color(0xFFCBD5E1);
  static const silverDark = Color(0xFF94A3B8);

  // Accent — red
  static const red = Color(0xFFDC2626);
  static const redLight = Color(0xFFFEE2E2);

  // Success — green
  static const billGreen = Color(0xFF16A34A);
  static const billGreenLight = Color(0xFFDCFCE7);

  // Warning
  static const warning = Color(0xFFF59E0B);
  static const warningLight = Color(0xFFFEF3C7);

  // Neutrals
  static const bg = Color(0xFFF8FAFC);
  static const card = Color(0xFFFFFFFF);
  static const border = Color(0xFFE2E8F0);
  static const text = Color(0xFF0F172A);
  static const muted = Color(0xFF64748B);
}

/// Reusable gradients for headers, primary buttons, and highlight cards.
class AppGradients {
  static const primary = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AppColors.navy, AppColors.steelBlue],
  );

  static const success = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF16A34A), Color(0xFF22C55E)],
  );

  static const accent = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFDC2626), Color(0xFFEF4444)],
  );
}

/// Consistent spacing scale — use these instead of ad-hoc numbers
/// (12, 14, 20, 22 etc.) so gaps line up across screens.
class AppSpacing {
  static const xs = 8.0;
  static const sm = 16.0;
  static const md = 24.0;
  static const lg = 32.0;
}

/// Typography hierarchy — pick the right level instead of defaulting
/// everything to ~14px body text.
class AppTextStyles {
  static const heading = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w800,
    color: AppColors.text,
    height: 1.2,
  );
  static const section = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: AppColors.text,
    height: 1.25,
  );
  static const body = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w500,
    color: AppColors.text,
    height: 1.35,
  );
  static const subtitle = TextStyle(
    fontSize: 14,
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
}

ThemeData buildAppTheme() => _buildTheme(Brightness.light);

/// Dark-theme counterpart — same palette/spacing/type-scale, just remapped
/// onto dark surfaces so text/icons keep proper contrast. Wire this up as
/// `darkTheme: buildAppDarkTheme()` + `themeMode: ThemeMode.system` in
/// MaterialApp to get automatic light/dark switching.
ThemeData buildAppDarkTheme() => _buildTheme(Brightness.dark);

ThemeData _buildTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final bg = isDark ? const Color(0xFF0B1220) : AppColors.bg;
  final card = isDark ? const Color(0xFF141B2D) : AppColors.card;
  final border = isDark ? const Color(0xFF283248) : AppColors.border;
  final text = isDark ? const Color(0xFFE2E8F0) : AppColors.text;
  final muted = isDark ? const Color(0xFF94A3B8) : AppColors.muted;
  // A lighter blue reads better than the deep logo-navy against dark
  // surfaces, while still being unmistakably "the same brand blue".
  final primary = isDark ? const Color(0xFF60A5FA) : AppColors.navy;
  // Text/icons placed ON TOP of a primary-colored surface (e.g. button
  // labels on a navy button) — white on the light theme's dark navy, but
  // dark text on the dark theme's lighter blue, so contrast stays high
  // either way instead of quietly failing accessibility checks.
  final onPrimary = isDark ? const Color(0xFF06111F) : Colors.white;

  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    fontFamily: 'Roboto',
    // Ensures every tappable control (buttons, list tiles, icon buttons)
    // gets at least a 48x48 touch target, per accessibility guidelines.
    materialTapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );
  return base.copyWith(
    scaffoldBackgroundColor: bg,
    colorScheme: base.colorScheme.copyWith(
      brightness: brightness,
      primary: primary,
      onPrimary: onPrimary,
      secondary: AppColors.silverDark,
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
      backgroundColor: isDark ? card : AppColors.navy,
      foregroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 2,
      centerTitle: false,
      titleTextStyle: const TextStyle(
        color: Colors.white,
        fontSize: 18,
        fontWeight: FontWeight.w700,
        letterSpacing: .3,
      ),
    ),
    cardTheme: CardThemeData(
      color: card,
      elevation: 2,
      surfaceTintColor: Colors.transparent,
      shadowColor: (isDark ? Colors.black : AppColors.navy).withOpacity(isDark ? 0.4 : 0.08),
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: border),
      ),
    ),
    // Primary CTA — solid fill with the brand color and a clearly readable
    // label color (chosen per-theme above), plus a soft shadow so it reads
    // as raised/tappable instead of flat.
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: onPrimary,
        disabledBackgroundColor: primary.withOpacity(0.4),
        disabledForegroundColor: onPrimary.withOpacity(0.7),
        elevation: 1,
        shadowColor: primary.withOpacity(0.35),
        minimumSize: const Size(64, 48),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: 14,
        ),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, letterSpacing: .2),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ).copyWith(
        elevation: MaterialStateProperty.resolveWith(
          (states) => states.contains(MaterialState.pressed) ? 0 : 1,
        ),
      ),
    ),
    // MD3's dedicated "filled button" — used for the strongest calls to
    // action (e.g. Save/Confirm dialogs). Same treatment as ElevatedButton
    // so both read consistently across the app.
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
        side: BorderSide(color: primary, width: 1.4),
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
        minimumSize: const Size(44, 44),
        foregroundColor: text,
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: AppColors.red,
      foregroundColor: Colors.white,
      elevation: 3,
      highlightElevation: 6,
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: isDark ? const Color(0xFF1C2436) : AppColors.bg,
      selectedColor: primary,
      // Bug fix: previously the selected-chip label kept the default
      // (dark) text color, which was nearly unreadable against the navy
      // selected background. Now it flips to a high-contrast color that
      // matches whichever color is on top of `primary` in this theme.
      labelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: text),
      secondaryLabelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: onPrimary),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? const Color(0xFF1A2338) : Colors.white,
      hintStyle: TextStyle(color: muted),
      labelStyle: TextStyle(color: muted),
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
        borderSide: BorderSide(color: primary, width: 1.8),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.red, width: 1.4),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: isDark ? const Color(0xFF1E293B) : AppColors.text,
      contentTextStyle: const TextStyle(color: Colors.white, fontSize: 13.5),
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

/// Helper to show a consistent, modern success/error snackbar from
/// anywhere in the app: `showAppSnackBar(context, 'Saved!')`.
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
            child: Text(message, style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    ),
  );
}
