import 'package:flutter/material.dart';
import '../../core/theme/design_system.dart';

/// Displays a VIP tier badge.
/// vipLevel 0 = nothing, 1 = silver, 2 = gold, 3 = rainbow crown
class VipBadge extends StatelessWidget {
  final int vipLevel;
  final double size;

  const VipBadge({super.key, required this.vipLevel, this.size = 18});

  @override
  Widget build(BuildContext context) {
    if (vipLevel <= 0) return const SizedBox.shrink();

    final label = 'VIP$vipLevel';
    final gradient = _gradient(vipLevel);

    return Container(
      padding: EdgeInsets.symmetric(horizontal: size * 0.4, vertical: size * 0.15),
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(size * 0.3),
        boxShadow: [
          BoxShadow(
            color: _shadowColor(vipLevel).withOpacity(0.45),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            vipLevel == 3 ? Icons.auto_awesome : Icons.workspace_premium,
            size: size * 0.75,
            color: vipLevel == 1 ? Colors.white70 : Colors.black87,
          ),
          SizedBox(width: size * 0.2),
          Text(
            label,
            style: TextStyle(
              fontSize: size * 0.65,
              fontWeight: FontWeight.w800,
              color: vipLevel == 1 ? Colors.white : Colors.black87,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  static LinearGradient _gradient(int level) {
    switch (level) {
      case 1:
        return const LinearGradient(
          colors: [Color(0xFF9E9E9E), Color(0xFFBDBDBD), Color(0xFF757575)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case 2:
        return const LinearGradient(
          colors: [Color(0xFFFFD700), Color(0xFFFFA726), Color(0xFFFFCC02)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case 3:
        return AppColors.rainbowGradient;
      default:
        return const LinearGradient(colors: [Colors.grey, Colors.grey]);
    }
  }

  static Color _shadowColor(int level) {
    switch (level) {
      case 1:
        return Colors.grey;
      case 2:
        return const Color(0xFFFFD700);
      case 3:
        return AppColors.hotPink;
      default:
        return Colors.transparent;
    }
  }
}
