import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final bool glassy;
  final Color? color;
  final double? borderRadius;
  final List<BoxShadow>? shadows;

  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.glassy = false,
    this.color,
    this.borderRadius,
    this.shadows,
  });

  @override
  Widget build(BuildContext context) {
    final br = borderRadius ?? AppRadius.lg;
    final bg = color ?? (glassy ? AppColors.bgCard.withValues(alpha: 0.7) : AppColors.bgCard);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(br),
        splashColor: AppColors.pink500.withValues(alpha: 0.08),
        highlightColor: AppColors.pink500.withValues(alpha: 0.04),
        child: Ink(
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(br),
            border: glassy
                ? Border.all(color: AppColors.pink500.withValues(alpha: 0.15), width: 1)
                : null,
            boxShadow: shadows ??
                [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  )
                ],
          ),
          child: Padding(
            padding: padding ?? AppSpacing.cardPadding,
            child: child,
          ),
        ),
      ),
    );
  }
}
