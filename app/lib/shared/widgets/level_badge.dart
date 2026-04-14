import 'package:flutter/material.dart';

/// Circular level badge with a gradient ring whose colour shifts by tier.
///
/// Tiers:
///   1–10  → green
///   11–30 → blue
///   31–50 → purple
///   51–99 → gold
class LevelBadge extends StatelessWidget {
  final int level;

  /// Outer diameter of the badge (ring + label).
  final double size;

  /// When true the badge is displayed in a compact "Lv.XX" pill form instead
  /// of the full circular version.  Useful for grid tiles.
  final bool compact;

  const LevelBadge({
    super.key,
    required this.level,
    this.size = 42,
    this.compact = false,
  });

  // ── Tier colours ─────────────────────────────────────────────────────────────

  static List<Color> _ringColors(int lv) {
    if (lv >= 51) return const [Color(0xFFFFD700), Color(0xFFFFA000)]; // gold
    if (lv >= 31) return const [Color(0xFF9C27B0), Color(0xFFCE93D8)]; // purple
    if (lv >= 11) return const [Color(0xFF1565C0), Color(0xFF42A5F5)]; // blue
    return const [Color(0xFF2E7D32), Color(0xFF81C784)];                 // green
  }

  Color _textColor(int lv) {
    if (lv >= 51) return const Color(0xFFFFD700);
    if (lv >= 31) return const Color(0xFFCE93D8);
    if (lv >= 11) return const Color(0xFF42A5F5);
    return const Color(0xFF81C784);
  }

  @override
  Widget build(BuildContext context) {
    final colors = _ringColors(level);

    if (compact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: colors),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Text(
          'Lv.$level',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 10,
            fontWeight: FontWeight.w800,
          ),
        ),
      );
    }

    final innerSize = size - 5;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Gradient ring
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: colors,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),

          // Dark inner circle
          Container(
            width: innerSize,
            height: innerSize,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Color(0xFF1A1A1A),
            ),
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Lv',
                  style: TextStyle(
                    color: _textColor(level).withValues(alpha: 0.8),
                    fontSize: size * 0.18,
                    fontWeight: FontWeight.w600,
                    height: 1.1,
                  ),
                ),
                Text(
                  '$level',
                  style: TextStyle(
                    color: _textColor(level),
                    fontSize: size * 0.28,
                    fontWeight: FontWeight.w900,
                    height: 1.0,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
