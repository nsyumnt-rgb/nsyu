import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../theme/app_theme.dart';

/// ─────────────────────────────────────────────────────────────────────────────
/// SHARED PREMIUM UI COMPONENTS FOR NSYU MOBILE APP
/// ─────────────────────────────────────────────────────────────────────────────

/// 1. AppCard — Uniform card container with soft 16px radius, subtle border & soft shadow
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;
  final VoidCallback? onTap;
  final Border? border;
  final double radius;

  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.color,
    this.onTap,
    this.border,
    this.radius = 16.0,
  });

  @override
  Widget build(BuildContext context) {
    final cardContent = Container(
      margin: margin,
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color ?? AppColors.surface,
        borderRadius: BorderRadius.circular(radius),
        border: border ?? Border.all(color: AppColors.border, width: 1.0),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F0B1F4B), // opacity 0.06
            blurRadius: 16,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );

    if (onTap != null) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(radius),
          child: cardContent,
        ),
      );
    }
    return cardContent;
  }
}

/// 2. AmountText — Tabular figures with Indian comma grouping & slightly smaller rupee symbol
class AmountText extends StatelessWidget {
  final double amount;
  final double fontSize;
  final FontWeight fontWeight;
  final Color? color;
  final bool showDecimals;
  final String? prefix;
  final String? suffix;

  const AmountText({
    super.key,
    required this.amount,
    this.fontSize = 16,
    this.fontWeight = FontWeight.w700,
    this.color,
    this.showDecimals = false,
    this.prefix,
    this.suffix,
  });

  static final _formatterNoDecimals = NumberFormat('#,##,###', 'en_IN');
  static final _formatterWithDecimals = NumberFormat('#,##,##0.00', 'en_IN');

  @override
  Widget build(BuildContext context) {
    final numString = (showDecimals || amount % 1 != 0)
        ? _formatterWithDecimals.format(amount.abs())
        : _formatterNoDecimals.format(amount.abs());

    final finalColor = color ?? AppColors.textPrimary;
    final rupeeSize = fontSize * 0.82;

    return Text.rich(
      TextSpan(
        children: [
          if (prefix != null)
            TextSpan(
              text: prefix,
              style: TextStyle(
                fontSize: fontSize * 0.85,
                fontWeight: FontWeight.w600,
                color: finalColor,
              ),
            ),
          TextSpan(
            text: '₹ ',
            style: TextStyle(
              fontSize: rupeeSize,
              fontWeight: FontWeight.w700,
              color: finalColor,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          TextSpan(
            text: numString,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: fontWeight,
              color: finalColor,
              fontFeatures: const [FontFeature.tabularFigures()],
              letterSpacing: -0.3,
            ),
          ),
          if (suffix != null)
            TextSpan(
              text: suffix,
              style: TextStyle(
                fontSize: fontSize * 0.85,
                fontWeight: FontWeight.w600,
                color: finalColor,
              ),
            ),
        ],
      ),
    );
  }
}

/// 3. StatusChip — Pill chip with 999 radius for financial & order states
enum StatusChipVariant {
  success, // green: paid, delivered, active
  warning, // amber: partial, pending
  danger,  // red: unpaid, due, overdue, cancelled
  info,    // blue: general, processing
  neutral, // slate: draft, default
}

class StatusChip extends StatelessWidget {
  final String label;
  final StatusChipVariant variant;
  final IconData? icon;
  final double fontSize;
  final EdgeInsetsGeometry? padding;

  const StatusChip({
    super.key,
    required this.label,
    required this.variant,
    this.icon,
    this.fontSize = 11.5,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    Color border;

    switch (variant) {
      case StatusChipVariant.success:
        bg = AppColors.successBg;
        fg = AppColors.success;
        border = const Color(0xFFBBF7D0);
        break;
      case StatusChipVariant.warning:
        bg = AppColors.warningBg;
        fg = AppColors.warning;
        border = const Color(0xFFFDE68A);
        break;
      case StatusChipVariant.danger:
        bg = AppColors.dangerBg;
        fg = AppColors.danger;
        border = const Color(0xFFFECACA);
        break;
      case StatusChipVariant.info:
        bg = AppColors.blue50;
        fg = AppColors.blue600;
        border = AppColors.blue100;
        break;
      case StatusChipVariant.neutral:
        bg = const Color(0xFFF1F5F9);
        fg = AppColors.textSecondary;
        border = AppColors.border;
        break;
    }

    return Container(
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: border, width: 1.0),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: fontSize + 1, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              color: fg,
              height: 1.1,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

/// 4. PrimaryButton — Prominent action button with 52pt height, 14pt radius, and loading state
class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double height;
  final double radius;

  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon,
    this.backgroundColor,
    this.foregroundColor,
    this.height = 52.0,
    this.radius = 14.0,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: backgroundColor ?? AppColors.navy900,
          foregroundColor: foregroundColor ?? Colors.white,
          disabledBackgroundColor: (backgroundColor ?? AppColors.navy900).withValues(alpha: 0.45),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radius),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
        ),
        onPressed: loading ? null : onPressed,
        child: loading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 19),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// 5. SecondaryButton — Soft blue surface button with 14pt radius
class SecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double height;
  final double radius;

  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.height = 52.0,
    this.radius = 14.0,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          backgroundColor: AppColors.blue50,
          foregroundColor: AppColors.blue600,
          side: const BorderSide(color: AppColors.blue100, width: 1.2),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radius),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16),
        ),
        onPressed: onPressed,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 19, color: AppColors.blue600),
              const SizedBox(width: 8),
            ],
            Text(
              label,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.blue600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 6. SectionHeader — Consistent header row across lists and dashboards
class SectionHeader extends StatelessWidget {
  final String title;
  final int? count;
  final String? actionLabel;
  final VoidCallback? onAction;

  const SectionHeader({
    super.key,
    required this.title,
    this.count,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Row(
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 16.5,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
                letterSpacing: -0.2,
              ),
            ),
            if (count != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.blue50,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.blue100),
                ),
                child: Text(
                  '$count',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.blue600,
                  ),
                ),
              ),
            ],
          ],
        ),
        if (actionLabel != null && onAction != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: const Size(40, 32),
              visualDensity: VisualDensity.compact,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  actionLabel!,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.blue600,
                  ),
                ),
                const SizedBox(width: 2),
                const Icon(Icons.chevron_right, size: 16, color: AppColors.blue600),
              ],
            ),
          ),
      ],
    );
  }
}

/// 7. EmptyState — Clean illustration/icon with message and optional CTA
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String? buttonLabel;
  final VoidCallback? onButtonPressed;
  final double iconSize;

  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.buttonLabel,
    this.onButtonPressed,
    this.iconSize = 44.0,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: const BoxDecoration(
                color: AppColors.blue50,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Icon(icon, size: iconSize, color: AppColors.blue600),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w400,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            if (buttonLabel != null && onButtonPressed != null) ...[
              const SizedBox(height: 20),
              PrimaryButton(
                label: buttonLabel!,
                onPressed: onButtonPressed,
                height: 44,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// 8. SkeletonLoader — Gentle shimmering skeleton for smooth loading states
class SkeletonLoader extends StatefulWidget {
  final double width;
  final double height;
  final double radius;

  const SkeletonLoader({
    super.key,
    required this.width,
    required this.height,
    this.radius = 8.0,
  });

  static Widget card({double height = 90}) {
    return const AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              SkeletonLoader(width: 44, height: 44, radius: 10),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonLoader(width: 140, height: 14),
                    SizedBox(height: 8),
                    SkeletonLoader(width: 90, height: 11),
                  ],
                ),
              ),
              SkeletonLoader(width: 60, height: 16),
            ],
          ),
        ],
      ),
    );
  }

  static Widget list({int count = 5}) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: count,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, __) => card(),
    );
  }

  @override
  State<SkeletonLoader> createState() => _SkeletonLoaderState();
}

class _SkeletonLoaderState extends State<SkeletonLoader> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        final val = _ctrl.value;
        final base = Color.lerp(const Color(0xFFE2E8F0), const Color(0xFFF1F5F9), val)!;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: base,
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        );
      },
    );
  }
}

/// 9. AppScaffold — Standard screen scaffold with unified Navy gradient or clean white Appbar
class AppScaffold extends StatelessWidget {
  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final bool isDarkHeader;
  final Widget? drawer;
  final Future<void> Function()? onRefresh;

  const AppScaffold({
    super.key,
    required this.title,
    required this.body,
    this.actions,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.isDarkHeader = false,
    this.drawer,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final scaffoldBody = onRefresh != null
        ? RefreshIndicator(
            onRefresh: onRefresh!,
            color: AppColors.blue600,
            child: body,
          )
        : body;

    return Scaffold(
      backgroundColor: AppColors.bg,
      drawer: drawer,
      appBar: AppBar(
        title: Text(
          title,
          style: TextStyle(
            color: isDarkHeader ? Colors.white : AppColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 18,
            letterSpacing: -0.2,
          ),
        ),
        backgroundColor: isDarkHeader ? AppColors.navy900 : Colors.white,
        elevation: 0,
        iconTheme: IconThemeData(
          color: isDarkHeader ? Colors.white : AppColors.textPrimary,
        ),
        actions: actions,
      ),
      body: scaffoldBody,
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
    );
  }
}
