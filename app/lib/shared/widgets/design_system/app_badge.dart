import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';

enum AppBadgeStyle { pink, rainbow, gold, success, error, surface }

class AppBadge extends StatelessWidget {
  final String label;
  final AppBadgeStyle style;
  final IconData? icon;
  final double fontSize;

  const AppBadge({
    super.key,
    required this.label,
    this.style = AppBadgeStyle.pink,
    this.icon,
    this.fontSize = 10,
  });

  @override
  Widget build(BuildContext context) {
    final gradient = _gradient();
    final solidColor = _solidColor();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null ? solidColor : null,
        borderRadius: AppRadius.fullRadius,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: fontSize + 2, color: Colors.white),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: AppTypography.badge.copyWith(fontSize: fontSize),
          ),
        ],
      ),
    );
  }

  LinearGradient? _gradient() {
    switch (style) {
      case AppBadgeStyle.pink:
        return AppColors.pinkGradient;
      case AppBadgeStyle.rainbow:
        return AppColors.rainbowGradient;
      case AppBadgeStyle.gold:
        return AppColors.goldGradient;
      default:
        return null;
    }
  }

  Color? _solidColor() {
    switch (style) {
      case AppBadgeStyle.success:
        return AppColors.success;
      case AppBadgeStyle.error:
        return AppColors.error;
      case AppBadgeStyle.surface:
        return AppColors.bgSurface;
      default:
        return null;
    }
  }
}
