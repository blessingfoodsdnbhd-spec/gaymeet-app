import 'package:flutter/material.dart';
import '../../../core/theme/design_system.dart';

enum AppButtonVariant { gradient, outline, ghost }

class AppButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final bool isLoading;
  final IconData? icon;
  final double? width;
  final LinearGradient? gradient;

  const AppButton({
    super.key,
    required this.text,
    this.onPressed,
    this.variant = AppButtonVariant.gradient,
    this.isLoading = false,
    this.icon,
    this.width,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    final grad = gradient ?? AppColors.pinkGradient;

    if (variant == AppButtonVariant.gradient) {
      return SizedBox(
        width: width ?? double.infinity,
        height: 54,
        child: AnimatedOpacity(
          opacity: (onPressed == null && !isLoading) ? 0.5 : 1.0,
          duration: const Duration(milliseconds: 200),
          child: GestureDetector(
            onTap: isLoading ? null : onPressed,
            child: Container(
              decoration: BoxDecoration(
                gradient: grad,
                borderRadius: AppRadius.lgRadius,
                boxShadow: onPressed != null
                    ? [
                        BoxShadow(
                          color: AppColors.hotPink.withValues(alpha: 0.35),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        )
                      ]
                    : null,
              ),
              child: _child(),
            ),
          ),
        ),
      );
    }

    if (variant == AppButtonVariant.outline) {
      return SizedBox(
        width: width ?? double.infinity,
        height: 54,
        child: OutlinedButton(
          onPressed: isLoading ? null : onPressed,
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: AppColors.pink500, width: 1.5),
            shape: RoundedRectangleBorder(borderRadius: AppRadius.lgRadius),
            foregroundColor: AppColors.pink500,
          ),
          child: _child(color: AppColors.pink500),
        ),
      );
    }

    // ghost
    return SizedBox(
      width: width,
      height: 54,
      child: TextButton(
        onPressed: isLoading ? null : onPressed,
        style: TextButton.styleFrom(
          foregroundColor: AppColors.textSecondary,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.lgRadius),
        ),
        child: _child(color: AppColors.textSecondary),
      ),
    );
  }

  Widget _child({Color color = Colors.white}) {
    if (isLoading) {
      return Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(color: color, strokeWidth: 2),
        ),
      );
    }
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (icon != null) ...[
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 8),
        ],
        Text(
          text,
          style: TextStyle(
            color: color,
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.3,
          ),
        ),
      ],
    );
  }
}
