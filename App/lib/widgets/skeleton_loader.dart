import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// A single shimmering placeholder box — animates a light sweep across a
/// grey rectangle to signal "loading" instead of a plain spinner.
class ShimmerBox extends StatefulWidget {
  final double width;
  final double height;
  final BorderRadius borderRadius;

  const ShimmerBox({
    super.key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius = const BorderRadius.all(Radius.circular(8)),
  });

  @override
  State<ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<ShimmerBox> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius,
            gradient: LinearGradient(
              begin: Alignment(-1 + _controller.value * 3, 0),
              end: Alignment(0 + _controller.value * 3, 0),
              colors: const [
                Color(0xFFE8EDF3),
                Color(0xFFF4F7FA),
                Color(0xFFE8EDF3),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Placeholder shaped like a [ProductCard] — used while the Catalog is
/// loading, in place of a plain spinner.
class ProductCardSkeleton extends StatelessWidget {
  const ProductCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShimmerBox(width: 56, height: 18, borderRadius: BorderRadius.all(Radius.circular(5))),
          SizedBox(height: 10),
          ShimmerBox(height: 14),
          SizedBox(height: 6),
          ShimmerBox(width: 140, height: 12),
          SizedBox(height: 10),
          Divider(height: 1),
          SizedBox(height: 10),
          ShimmerBox(width: 90, height: 20),
          SizedBox(height: 10),
          ShimmerBox(height: 34, borderRadius: BorderRadius.all(Radius.circular(8))),
        ],
      ),
    );
  }
}

/// A grid of [ProductCardSkeleton]s filling the loading state.
class ProductGridSkeleton extends StatelessWidget {
  final int count;

  const ProductGridSkeleton({super.key, this.count = 6});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: LayoutBuilder(
        builder: (context, constraints) {
          const spacing = 14.0;
          const minCardWidth = 240.0;
          final cols = (constraints.maxWidth / (minCardWidth + spacing))
              .floor()
              .clamp(1, 4);
          final cardWidth = (constraints.maxWidth - spacing * (cols - 1)) / cols;
          return Wrap(
            spacing: spacing,
            runSpacing: spacing,
            children: [
              for (var i = 0; i < count; i++)
                SizedBox(width: cardWidth, child: const ProductCardSkeleton()),
            ],
          );
        },
      ),
    );
  }
}
