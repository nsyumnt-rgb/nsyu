import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';

enum FeedbackType { success, error, warning, info, saving }

/// Premium Animated Feedback & Dialog System matching NSYU Design System
class AnimatedFeedbackDialog extends StatefulWidget {
  final FeedbackType type;
  final String title;
  final String message;
  final String? detailText;
  final List<String>? bulletPoints;
  final Widget? customContent;
  final String? primaryActionText;
  final VoidCallback? onPrimaryAction;
  final IconData? primaryActionIcon;
  final String? secondaryActionText;
  final VoidCallback? onSecondaryAction;
  final String? tertiaryActionText;
  final VoidCallback? onTertiaryAction;
  final int savingStep; // 0: Validating, 1: Calculating, 2: Updating stock, 3: Saving invoice, 4: Finalizing
  final double savingProgress; // 0.0 to 1.0

  const AnimatedFeedbackDialog({
    super.key,
    required this.type,
    required this.title,
    required this.message,
    this.detailText,
    this.bulletPoints,
    this.customContent,
    this.primaryActionText,
    this.onPrimaryAction,
    this.primaryActionIcon,
    this.secondaryActionText,
    this.onSecondaryAction,
    this.tertiaryActionText,
    this.onTertiaryAction,
    this.savingStep = 3,
    this.savingProgress = 0.70,
  });

  static Future<T?> show<T>({
    required BuildContext context,
    required FeedbackType type,
    required String title,
    required String message,
    String? detailText,
    List<String>? bulletPoints,
    Widget? customContent,
    String? primaryActionText,
    VoidCallback? onPrimaryAction,
    IconData? primaryActionIcon,
    String? secondaryActionText,
    VoidCallback? onSecondaryAction,
    String? tertiaryActionText,
    VoidCallback? onTertiaryAction,
    bool barrierDismissible = false,
  }) {
    return showGeneralDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      barrierLabel: 'FeedbackDialog',
      transitionDuration: const Duration(milliseconds: 320),
      pageBuilder: (_, __, ___) => AnimatedFeedbackDialog(
        type: type,
        title: title,
        message: message,
        detailText: detailText,
        bulletPoints: bulletPoints,
        customContent: customContent,
        primaryActionText: primaryActionText,
        onPrimaryAction: onPrimaryAction,
        primaryActionIcon: primaryActionIcon,
        secondaryActionText: secondaryActionText,
        onSecondaryAction: onSecondaryAction,
        tertiaryActionText: tertiaryActionText,
        onTertiaryAction: onTertiaryAction,
      ),
      transitionBuilder: (ctx, anim, _, child) {
        final curved = CurvedAnimation(parent: anim, curve: Curves.easeOutBack);
        return ScaleTransition(
          scale: curved,
          child: FadeTransition(opacity: anim, child: child),
        );
      },
    );
  }

  /// Show Success Confirmation Dialog matching design
  static Future<T?> showSuccess<T>({
    required BuildContext context,
    required String invoiceNumber,
    String title = 'Bill Saved Successfully!',
    String? customerName,
    double? totalAmount,
    double? paidAmount,
    double? dueAmount,
    VoidCallback? onViewBill,
    VoidCallback? onContinueBilling,
    VoidCallback? onGoToBillList,
  }) {
    return showGeneralDialog<T>(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'SuccessDialog',
      transitionDuration: const Duration(milliseconds: 340),
      pageBuilder: (dialogContext, __, ___) => AnimatedFeedbackDialog(
        type: FeedbackType.success,
        title: title,
        message: 'Invoice #$invoiceNumber\nhas been created.',
        customContent: (totalAmount != null)
            ? Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    if (customerName != null && customerName.isNotEmpty)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Customer:', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                          Text(customerName, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                        ],
                      ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total Amount:', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                        Text('₹${totalAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                      ],
                    ),
                    if (paidAmount != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Amount Paid:', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                          Text('₹${paidAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF16A34A))),
                        ],
                      ),
                    ],
                    if (dueAmount != null && dueAmount > 0) ...[
                      const SizedBox(height: 4),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Balance Due:', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                          Text('₹${dueAmount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFFDC2626))),
                        ],
                      ),
                    ],
                  ],
                ),
              )
            : null,
        primaryActionText: 'View Bill',
        primaryActionIcon: Icons.receipt_long,
        onPrimaryAction: onViewBill,
        secondaryActionText: 'Continue Billing',
        onSecondaryAction: onContinueBilling,
        tertiaryActionText: 'Go to Bill List',
        onTertiaryAction: onGoToBillList,
      ),
      transitionBuilder: (ctx, anim, _, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim, curve: Curves.easeOutBack),
          child: FadeTransition(opacity: anim, child: child),
        );
      },
    );
  }

  /// Show Failure Dialog matching design with reason and Retry button
  static Future<T?> showFailure<T>({
    required BuildContext context,
    String title = 'Failed to Save Bill',
    String message = 'Unable to save bill. Please try again.',
    required String reason,
    VoidCallback? onRetry,
    VoidCallback? onClose,
  }) {
    return showGeneralDialog<T>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'FailureDialog',
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (_, __, ___) => AnimatedFeedbackDialog(
        type: FeedbackType.error,
        title: title,
        message: message,
        detailText: reason,
        primaryActionText: 'Retry',
        primaryActionIcon: Icons.refresh,
        onPrimaryAction: onRetry,
        secondaryActionText: 'Close',
        onSecondaryAction: onClose,
      ),
      transitionBuilder: (ctx, anim, _, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim, curve: Curves.easeOutBack),
          child: FadeTransition(opacity: anim, child: child),
        );
      },
    );
  }

  /// Show Validation Warning Dialog with bullet points
  static Future<T?> showValidationWarning<T>({
    required BuildContext context,
    String title = 'Validation Error',
    String message = 'Please check the highlighted fields.',
    required List<String> errors,
    VoidCallback? onOk,
  }) {
    return showGeneralDialog<T>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'WarningDialog',
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (_, __, ___) => AnimatedFeedbackDialog(
        type: FeedbackType.warning,
        title: title,
        message: message,
        bulletPoints: errors,
        primaryActionText: 'OK',
        onPrimaryAction: onOk,
      ),
      transitionBuilder: (ctx, anim, _, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim, curve: Curves.easeOutBack),
          child: FadeTransition(opacity: anim, child: child),
        );
      },
    );
  }

  /// Show Information Dialog
  static Future<T?> showInfo<T>({
    required BuildContext context,
    String title = 'Information',
    required String message,
    String? detailText,
    VoidCallback? onOk,
  }) {
    return showGeneralDialog<T>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'InfoDialog',
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (_, __, ___) => AnimatedFeedbackDialog(
        type: FeedbackType.info,
        title: title,
        message: message,
        detailText: detailText,
        primaryActionText: 'OK',
        onPrimaryAction: onOk,
      ),
      transitionBuilder: (ctx, anim, _, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim, curve: Curves.easeOutBack),
          child: FadeTransition(opacity: anim, child: child),
        );
      },
    );
  }

  @override
  State<AnimatedFeedbackDialog> createState() => _AnimatedFeedbackDialogState();
}

class _AnimatedFeedbackDialogState extends State<AnimatedFeedbackDialog>
    with TickerProviderStateMixin {
  late final AnimationController _iconCtrl = AnimationController(
    duration: const Duration(milliseconds: 800),
    vsync: this,
  );
  late final AnimationController _pulseCtrl = AnimationController(
    duration: const Duration(milliseconds: 1200),
    vsync: this,
  )..repeat(reverse: true);

  late final AnimationController _shakeCtrl = AnimationController(
    duration: const Duration(milliseconds: 450),
    vsync: this,
  );

  late final Animation<double> _scaleAnim = CurvedAnimation(
    parent: _iconCtrl,
    curve: Curves.elasticOut,
  );

  late final Animation<double> _confettiAnim = CurvedAnimation(
    parent: _iconCtrl,
    curve: Curves.easeOutCubic,
  );

  @override
  void initState() {
    super.initState();
    _iconCtrl.forward();
    if (widget.type == FeedbackType.error) {
      _shakeCtrl.forward();
    }
  }

  @override
  void dispose() {
    _iconCtrl.dispose();
    _pulseCtrl.dispose();
    _shakeCtrl.dispose();
    super.dispose();
  }

  Color get _primaryColor {
    switch (widget.type) {
      case FeedbackType.success:
        return const Color(0xFF16A34A); // Vibrant emerald green
      case FeedbackType.error:
        return const Color(0xFFDC2626); // Rose red
      case FeedbackType.warning:
        return const Color(0xFFF59E0B); // Amber
      case FeedbackType.info:
        return const Color(0xFF2563EB); // Royal Blue
      case FeedbackType.saving:
        return const Color(0xFF1D4ED8); // Blue
    }
  }

  Widget _buildAnimatedIcon() {
    if (widget.type == FeedbackType.success) {
      return Stack(
        alignment: Alignment.center,
        children: [
          // Animated Confetti Particles around circle
          AnimatedBuilder(
            animation: _confettiAnim,
            builder: (ctx, child) {
              return CustomPaint(
                size: const Size(140, 140),
                painter: _ConfettiPainter(progress: _confettiAnim.value),
              );
            },
          ),
          // Pulsing Glow
          AnimatedBuilder(
            animation: _pulseCtrl,
            builder: (ctx, child) {
              return Container(
                width: 76 + (_pulseCtrl.value * 6),
                height: 76 + (_pulseCtrl.value * 6),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF22C55E).withValues(alpha: 0.15 * (1 - _pulseCtrl.value)),
                ),
              );
            },
          ),
          // Success Checkmark Circle
          ScaleTransition(
            scale: _scaleAnim,
            child: Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0xFF22C55E), Color(0xFF16A34A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF16A34A).withValues(alpha: 0.35),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(Icons.check, color: Colors.white, size: 40),
              ),
            ),
          ),
        ],
      );
    }

    if (widget.type == FeedbackType.error) {
      return AnimatedBuilder(
        animation: _shakeCtrl,
        builder: (ctx, child) {
          final offset = math.sin(_shakeCtrl.value * math.pi * 4) * 6 * (1 - _shakeCtrl.value);
          return Transform.translate(
            offset: Offset(offset, 0),
            child: child,
          );
        },
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Soundwave vibration arcs on sides
            CustomPaint(
              size: const Size(120, 80),
              painter: _VibrationArcsPainter(color: const Color(0xFFDC2626)),
            ),
            ScaleTransition(
              scale: _scaleAnim,
              child: Container(
                width: 68,
                height: 68,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFDC2626).withValues(alpha: 0.35),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Center(
                  child: Icon(Icons.close, color: Colors.white, size: 38),
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (widget.type == FeedbackType.warning) {
      return Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _pulseCtrl,
            builder: (ctx, child) {
              return Container(
                width: 78 + (_pulseCtrl.value * 8),
                height: 78 + (_pulseCtrl.value * 8),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.15 * (1 - _pulseCtrl.value)),
                ),
              );
            },
          ),
          ScaleTransition(
            scale: _scaleAnim,
            child: Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0xFFFBBF24), Color(0xFFD97706)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFD97706).withValues(alpha: 0.35),
                    blurRadius: 14,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(Icons.priority_high_rounded, color: Colors.white, size: 40),
              ),
            ),
          ),
        ],
      );
    }

    // Info or Default
    return Stack(
      alignment: Alignment.center,
      children: [
        AnimatedBuilder(
          animation: _pulseCtrl,
          builder: (ctx, child) {
            return Container(
              width: 78 + (_pulseCtrl.value * 8),
              height: 78 + (_pulseCtrl.value * 8),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF3B82F6).withValues(alpha: 0.15 * (1 - _pulseCtrl.value)),
              ),
            );
          },
        ),
        ScaleTransition(
          scale: _scaleAnim,
          child: Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [Color(0xFF60A5FA), Color(0xFF2563EB)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF2563EB).withValues(alpha: 0.35),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Center(
              child: Icon(Icons.info_outline_rounded, color: Colors.white, size: 38),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      elevation: 12,
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 26, 22, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Top Animated Graphic
                _buildAnimatedIcon(),
                const SizedBox(height: 16),

                // Title
                Text(
                  widget.title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 8),

                // Message / Subtitle
                Text(
                  widget.message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
                    height: 1.4,
                  ),
                ),

                // Detail highlight box (for reason in failure or stock info)
                if (widget.detailText != null && widget.detailText!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: widget.type == FeedbackType.error
                          ? const Color(0xFFFEF2F2)
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: widget.type == FeedbackType.error
                            ? const Color(0xFFFECACA)
                            : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (widget.type == FeedbackType.error) ...[
                          const Icon(Icons.error_outline, size: 16, color: Color(0xFFDC2626)),
                          const SizedBox(width: 8),
                        ],
                        Expanded(
                          child: Text(
                            widget.type == FeedbackType.error
                                ? 'Reason: ${widget.detailText!}'
                                : widget.detailText!,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: widget.type == FeedbackType.error
                                  ? const Color(0xFFB91C1C)
                                  : const Color(0xFF334155),
                              height: 1.35,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Bullet points (for validation errors)
                if (widget.bulletPoints != null && widget.bulletPoints!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: widget.bulletPoints!.map((pt) {
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2.5),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('• ', style: TextStyle(color: Color(0xFFD97706), fontWeight: FontWeight.bold, fontSize: 13)),
                              Expanded(
                                child: Text(
                                  pt,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF92400E)),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],

                // Custom content if provided
                if (widget.customContent != null) ...[
                  widget.customContent!,
                ],

                const SizedBox(height: 20),

                // Primary & Secondary Buttons
                if (widget.primaryActionText != null) ...[
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _primaryColor,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: widget.primaryActionIcon != null
                          ? Icon(widget.primaryActionIcon, size: 17)
                          : const SizedBox.shrink(),
                      label: Text(
                        widget.primaryActionText!,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                      ),
                      onPressed: () {
                        Navigator.of(context).pop();
                        widget.onPrimaryAction?.call();
                      },
                    ),
                  ),
                ],

                if (widget.secondaryActionText != null) ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    height: 42,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFE2E8F0)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        foregroundColor: const Color(0xFF475569),
                        backgroundColor: const Color(0xFFF8FAFC),
                      ),
                      onPressed: () {
                        Navigator.of(context).pop();
                        widget.onSecondaryAction?.call();
                      },
                      child: Text(
                        widget.secondaryActionText!,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],

                if (widget.tertiaryActionText != null) ...[
                  const SizedBox(height: 6),
                  TextButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      widget.onTertiaryAction?.call();
                    },
                    child: Text(
                      widget.tertiaryActionText!,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF2563EB),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Top right close button
          Positioned(
            top: 10,
            right: 10,
            child: IconButton(
              icon: const Icon(Icons.close, size: 20, color: Color(0xFF94A3B8)),
              onPressed: () => Navigator.of(context).pop(),
              tooltip: 'Close',
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVING PROGRESS DIALOG WITH LIVE STEP PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
class SavingBillProgressDialog extends StatefulWidget {
  final String title;
  final String subtitle;
  final Stream<int>? stepStream;

  const SavingBillProgressDialog({
    super.key,
    this.title = 'Saving Bill...',
    this.subtitle = 'Please wait, we are processing your request.',
    this.stepStream,
  });

  static Future<T?> show<T>(BuildContext context) {
    return showGeneralDialog<T>(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'SavingBillDialog',
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (_, __, ___) => const SavingBillProgressDialog(),
      transitionBuilder: (ctx, anim, _, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim, curve: Curves.easeOutCubic),
          child: FadeTransition(opacity: anim, child: child),
        );
      },
    );
  }

  @override
  State<SavingBillProgressDialog> createState() => _SavingBillProgressDialogState();
}

class _SavingBillProgressDialogState extends State<SavingBillProgressDialog> {
  int _currentStep = 0;
  Timer? _stepTimer;
  StreamSubscription<int>? _sub;

  final List<String> _steps = const [
    'Validating items...',
    'Calculating totals...',
    'Updating stock...',
    'Saving invoice...',
    'Finalizing...',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.stepStream != null) {
      _sub = widget.stepStream!.listen((step) {
        if (mounted) setState(() => _currentStep = step.clamp(0, _steps.length - 1));
      });
    } else {
      // Auto advance visual feedback smoothly during server roundtrip
      _stepTimer = Timer.periodic(const Duration(milliseconds: 380), (t) {
        if (mounted && _currentStep < _steps.length - 2) {
          setState(() => _currentStep++);
        }
      });
    }
  }

  @override
  void dispose() {
    _stepTimer?.cancel();
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_currentStep + 1) / _steps.length;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      elevation: 12,
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 26, vertical: 24),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Rotating Circular Gradient Ring
            SizedBox(
              width: 72,
              height: 72,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 4.5,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
                  ),
                  const Icon(Icons.receipt_long, color: Color(0xFF2563EB), size: 30),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Title
            Text(
              widget.title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              widget.subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 20),

            // Stepped Progress Checklist
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: List.generate(_steps.length, (idx) {
                  final isDone = idx < _currentStep;
                  final isCurrent = idx == _currentStep;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        if (isDone)
                          const Icon(Icons.check_circle, size: 16, color: Color(0xFF16A34A))
                        else if (isCurrent)
                          const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB)),
                          )
                        else
                          const Icon(Icons.radio_button_unchecked, size: 14, color: Color(0xFFCBD5E1)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _steps[idx],
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                              color: isDone
                                  ? const Color(0xFF16A34A)
                                  : isCurrent
                                      ? const Color(0xFF1E293B)
                                      : const Color(0xFF94A3B8),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 16),

            // Progress bar with percentage
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 6,
                      backgroundColor: const Color(0xFFE2E8F0),
                      valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  '${(progress * 100).toInt()}%',
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Color(0xFF2563EB)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS (AUTO HIDE) MATCHING DESIGN
// ─────────────────────────────────────────────────────────────────────────────
class AppToast {
  static void showSuccess(BuildContext context, {required String title, required String subtitle}) {
    _showToast(context, title: title, subtitle: subtitle, color: const Color(0xFF16A34A), icon: Icons.check_circle);
  }

  static void showError(BuildContext context, {required String title, required String subtitle}) {
    _showToast(context, title: title, subtitle: subtitle, color: const Color(0xFFDC2626), icon: Icons.cancel);
  }

  static void showWarning(BuildContext context, {required String title, required String subtitle}) {
    _showToast(context, title: title, subtitle: subtitle, color: const Color(0xFFD97706), icon: Icons.warning_amber_rounded);
  }

  static void showInfo(BuildContext context, {required String title, required String subtitle}) {
    _showToast(context, title: title, subtitle: subtitle, color: const Color(0xFF2563EB), icon: Icons.info_rounded);
  }

  static void _showToast(
    BuildContext context, {
    required String title,
    required String subtitle,
    required Color color,
    required IconData icon,
  }) {
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        duration: const Duration(seconds: 4),
        content: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.35),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Icon(icon, color: Colors.white, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                    if (subtitle.isNotEmpty)
                      Text(
                        subtitle,
                        style: const TextStyle(color: Colors.white70, fontSize: 11.5),
                      ),
                  ],
                ),
              ),
              IconButton(
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                icon: const Icon(Icons.close, color: Colors.white70, size: 18),
                onPressed: () => messenger.hideCurrentSnackBar(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM PAINTERS: CONFETTI & VIBRATION
// ─────────────────────────────────────────────────────────────────────────────
class _ConfettiPainter extends CustomPainter {
  final double progress;
  _ConfettiPainter({required this.progress});

  static final List<Color> _colors = [
    const Color(0xFF3B82F6),
    const Color(0xFFEF4444),
    const Color(0xFFF59E0B),
    const Color(0xFF10B981),
    const Color(0xFF8B5CF6),
    const Color(0xFFEC4899),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    const count = 18;
    final rand = math.Random(42); // fixed seed for consistent layout

    for (int i = 0; i < count; i++) {
      final angle = (i / count) * 2 * math.pi + rand.nextDouble() * 0.2;
      final distance = (42 + rand.nextDouble() * 26) * progress;
      final x = center.dx + math.cos(angle) * distance;
      final y = center.dy + math.sin(angle) * distance;
      final color = _colors[i % _colors.length].withValues(alpha: (1.0 - (progress * 0.2)).clamp(0.0, 1.0));

      final paint = Paint()
        ..color = color
        ..style = PaintingStyle.fill;

      if (i % 3 == 0) {
        // small circle
        canvas.drawCircle(Offset(x, y), 3.0 * (1 - progress * 0.3), paint);
      } else if (i % 3 == 1) {
        // small square
        canvas.drawRect(Rect.fromCenter(center: Offset(x, y), width: 5, height: 5), paint);
      } else {
        // star / diamond dot
        final path = Path()
          ..moveTo(x, y - 4)
          ..lineTo(x + 3, y)
          ..lineTo(x, y + 4)
          ..lineTo(x - 3, y)
          ..close();
        canvas.drawPath(path, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) => oldDelegate.progress != progress;
}

class _VibrationArcsPainter extends CustomPainter {
  final Color color;
  _VibrationArcsPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withValues(alpha: 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;

    final centerY = size.height / 2;

    // Left vibration wave
    final leftPath1 = Path()
      ..addArc(Rect.fromLTWH(18, centerY - 18, 12, 36), math.pi * 0.6, math.pi * 0.8);
    final leftPath2 = Path()
      ..addArc(Rect.fromLTWH(8, centerY - 24, 14, 48), math.pi * 0.6, math.pi * 0.8);

    // Right vibration wave
    final rightPath1 = Path()
      ..addArc(Rect.fromLTWH(size.width - 30, centerY - 18, 12, 36), -math.pi * 0.4, math.pi * 0.8);
    final rightPath2 = Path()
      ..addArc(Rect.fromLTWH(size.width - 22, centerY - 24, 14, 48), -math.pi * 0.4, math.pi * 0.8);

    canvas.drawPath(leftPath1, paint);
    canvas.drawPath(leftPath2, paint..color = color.withValues(alpha: 0.35));
    canvas.drawPath(rightPath1, paint..color = color.withValues(alpha: 0.6));
    canvas.drawPath(rightPath2, paint..color = color.withValues(alpha: 0.35));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
