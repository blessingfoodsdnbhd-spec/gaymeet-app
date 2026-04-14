import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';

/// Wraps [child] in an animated rainbow gradient border.
class RainbowBorder extends StatefulWidget {
  final Widget child;
  final double borderWidth;
  final double borderRadius;
  final bool animated;

  const RainbowBorder({
    super.key,
    required this.child,
    this.borderWidth = 2,
    this.borderRadius = AppRadius.lg,
    this.animated = true,
  });

  @override
  State<RainbowBorder> createState() => _RainbowBorderState();
}

class _RainbowBorderState extends State<RainbowBorder>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.animated) {
      return _StaticBorder(
        borderWidth: widget.borderWidth,
        borderRadius: widget.borderRadius,
        child: widget.child,
      );
    }
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => _StaticBorder(
        borderWidth: widget.borderWidth,
        borderRadius: widget.borderRadius,
        gradientAngle: _ctrl.value * 2 * 3.14159,
        child: widget.child,
      ),
    );
  }
}

class _StaticBorder extends StatelessWidget {
  final Widget child;
  final double borderWidth;
  final double borderRadius;
  final double gradientAngle;

  const _StaticBorder({
    required this.child,
    required this.borderWidth,
    required this.borderRadius,
    this.gradientAngle = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        gradient: SweepGradient(
          colors: const [
            AppColors.rainbowRed,
            AppColors.rainbowOrange,
            AppColors.rainbowYellow,
            AppColors.rainbowGreen,
            AppColors.rainbowBlue,
            AppColors.rainbowIndigo,
            AppColors.rainbowViolet,
            AppColors.rainbowRed,
          ],
          startAngle: gradientAngle,
          endAngle: gradientAngle + 3.14159 * 2,
        ),
      ),
      child: Padding(
        padding: EdgeInsets.all(borderWidth),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(borderRadius - borderWidth),
          child: child,
        ),
      ),
    );
  }
}
