import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../theme/app_theme.dart';

/// Small shared pieces for the business-module screens so they look the same.

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
String inr(dynamic v) => _inr.format(double.tryParse('${v ?? 0}') ?? 0);
double num0(dynamic v) => double.tryParse('${v ?? 0}') ?? 0;
String shortDate(dynamic v) {
  final d = DateTime.tryParse('${v ?? ''}');
  return d == null ? '—' : DateFormat('d MMM yyyy').format(d.toLocal());
}

PreferredSizeWidget bizAppBar(String title, {List<Widget>? actions}) => AppBar(
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      backgroundColor: Colors.white,
      foregroundColor: AppColors.navy900,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      actions: actions,
    );

InputDecoration bizInput(String label, {String? hint, IconData? icon}) => InputDecoration(
      labelText: label,
      hintText: hint,
      isDense: true,
      prefixIcon: icon != null ? Icon(icon, size: 20) : null,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
    );

void bizToast(BuildContext context, String text, {bool ok = true}) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(text),
    backgroundColor: ok ? AppColors.emerald : AppColors.danger,
    behavior: SnackBarBehavior.floating,
  ));
}

class BizCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  const BizCard({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(14)});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: padding,
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
            child: child,
          ),
        ),
      ),
    );
  }
}

class BizState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? text;
  final String? action;
  final VoidCallback? onAction;
  final bool error;
  const BizState({super.key, required this.icon, required this.title, this.text, this.action, this.onAction, this.error = false});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(color: error ? AppColors.dangerBg : AppColors.blue50, shape: BoxShape.circle),
            child: Icon(icon, size: 30, color: error ? AppColors.danger : AppColors.emerald),
          ),
          const SizedBox(height: 14),
          Text(title, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.navy900)),
          if (text != null) ...[
            const SizedBox(height: 6),
            Text(text!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ],
          if (action != null) ...[
            const SizedBox(height: 14),
            FilledButton(onPressed: onAction, style: FilledButton.styleFrom(backgroundColor: AppColors.emerald), child: Text(action!)),
          ],
        ]),
      ),
    );
  }
}

class BizPill extends StatelessWidget {
  final String text;
  final Color color;
  const BizPill(this.text, {super.key, this.color = AppColors.textSecondary});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
      child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

/// Loads a list once, with pull-to-refresh, loading, empty and error states.
class BizListBody<T> extends StatelessWidget {
  final Future<List<T>>? future;
  final Future<void> Function() onRefresh;
  final Widget Function(List<T> items) builder;
  final Widget empty;
  const BizListBody({super.key, required this.future, required this.onRefresh, required this.builder, required this.empty});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<T>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (snap.hasError) {
          return BizState(icon: Icons.cloud_off_rounded, title: 'Could not load', text: '${snap.error}', action: 'Try again', onAction: onRefresh, error: true);
        }
        final items = snap.data ?? [];
        return RefreshIndicator(
          onRefresh: onRefresh,
          child: items.isEmpty ? ListView(children: [const SizedBox(height: 80), empty]) : builder(items),
        );
      },
    );
  }
}

Widget bizPrimaryButton({required String label, required VoidCallback? onPressed, IconData? icon}) => SizedBox(
      width: double.infinity,
      height: 50,
      child: FilledButton.icon(
        style: FilledButton.styleFrom(backgroundColor: AppColors.emerald, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
        onPressed: onPressed,
        icon: Icon(icon ?? Icons.check_rounded, size: 18),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
      ),
    );
