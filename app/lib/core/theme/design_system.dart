import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────────────────────
// AppColors
// ─────────────────────────────────────────────────────────────────────────────
class AppColors {
  AppColors._();

  // Backgrounds
  static const Color bgDark     = Color(0xFF0D0D1A);
  static const Color bgCard     = Color(0xFF1A1028);
  static const Color bgCardLight= Color(0xFF251535);
  static const Color bgSurface  = Color(0xFF2D1B3D);

  // Pink / Hot-pink
  static const Color pink500    = Color(0xFFE91E63);
  static const Color hotPink    = Color(0xFFFF1493);
  static const Color rose       = Color(0xFFFF6B9D);
  static const Color pinkLight  = Color(0xFFFF9EC4);

  // Purple / Violet
  static const Color violet     = Color(0xFF7C4DFF);
  static const Color purple     = Color(0xFF9C27B0);
  static const Color lavender   = Color(0xFFBA68C8);

  // Rainbow palette
  static const Color rainbowRed    = Color(0xFFFF3B3B);
  static const Color rainbowOrange = Color(0xFFFF8C00);
  static const Color rainbowYellow = Color(0xFFFFD700);
  static const Color rainbowGreen  = Color(0xFF00E676);
  static const Color rainbowBlue   = Color(0xFF2196F3);
  static const Color rainbowIndigo = Color(0xFF3F51B5);
  static const Color rainbowViolet = Color(0xFF9C27B0);

  // Status
  static const Color online  = Color(0xFF00E676);
  static const Color premium = Color(0xFFFFD700);
  static const Color error   = Color(0xFFFF5252);
  static const Color success = Color(0xFF00C853);
  static const Color warning = Color(0xFFFFD740);

  // Text
  static const Color textPrimary   = Color(0xFFF5F5F5);
  static const Color textSecondary = Color(0xFFB0A8C0);
  static const Color textHint      = Color(0xFF6B5E7A);

  // ── Gradients ───────────────────────────────────────────────────────────────
  static const LinearGradient pinkGradient = LinearGradient(
    colors: [hotPink, pink500],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient purpleGradient = LinearGradient(
    colors: [violet, purple],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient pinkPurpleGradient = LinearGradient(
    colors: [hotPink, violet],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient rainbowGradient = LinearGradient(
    colors: [
      rainbowRed,
      rainbowOrange,
      rainbowYellow,
      rainbowGreen,
      rainbowBlue,
      rainbowIndigo,
      rainbowViolet,
    ],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static const LinearGradient cardOverlay = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Colors.transparent, Colors.transparent, Color(0xCC000000)],
    stops: [0.0, 0.45, 1.0],
  );

  static const LinearGradient goldGradient = LinearGradient(
    colors: [Color(0xFFFFD700), Color(0xFFFFA000)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppTypography
// ─────────────────────────────────────────────────────────────────────────────
class AppTypography {
  AppTypography._();

  static const String _family = 'SF Pro Display';

  static const TextStyle h1 = TextStyle(
    fontFamily: _family,
    fontSize: 32,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
  );

  static const TextStyle h2 = TextStyle(
    fontFamily: _family,
    fontSize: 24,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    letterSpacing: -0.3,
  );

  static const TextStyle h3 = TextStyle(
    fontFamily: _family,
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const TextStyle body = TextStyle(
    fontFamily: _family,
    fontSize: 15,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
  );

  static const TextStyle bodyBold = TextStyle(
    fontFamily: _family,
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: _family,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  static const TextStyle captionBold = TextStyle(
    fontFamily: _family,
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: AppColors.textSecondary,
  );

  static const TextStyle badge = TextStyle(
    fontFamily: _family,
    fontSize: 10,
    fontWeight: FontWeight.w700,
    color: Colors.white,
    letterSpacing: 0.5,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppSpacing
// ─────────────────────────────────────────────────────────────────────────────
class AppSpacing {
  AppSpacing._();

  static const double xs  = 4;
  static const double sm  = 8;
  static const double md  = 16;
  static const double lg  = 24;
  static const double xl  = 32;
  static const double xxl = 48;

  static const EdgeInsets screenPadding =
      EdgeInsets.symmetric(horizontal: md);

  static const EdgeInsets cardPadding =
      EdgeInsets.all(md);
}

// ─────────────────────────────────────────────────────────────────────────────
// AppRadius
// ─────────────────────────────────────────────────────────────────────────────
class AppRadius {
  AppRadius._();

  static const double sm   = 8;
  static const double md   = 14;
  static const double lg   = 20;
  static const double xl   = 28;
  static const double full = 999;

  static BorderRadius get smRadius   => BorderRadius.circular(sm);
  static BorderRadius get mdRadius   => BorderRadius.circular(md);
  static BorderRadius get lgRadius   => BorderRadius.circular(lg);
  static BorderRadius get xlRadius   => BorderRadius.circular(xl);
  static BorderRadius get fullRadius => BorderRadius.circular(full);
}
