import 'package:flutter/material.dart';
import '../core/theme/design_system.dart';

export '../core/theme/design_system.dart';

class AppTheme {
  // ── Brand colors (map to design tokens) ────────────────────────────────────
  static const Color primary      = AppColors.hotPink;
  static const Color primaryLight = AppColors.rose;
  static const Color accent       = AppColors.violet;
  static const Color gradient1    = AppColors.hotPink;
  static const Color gradient2    = AppColors.pink500;

  // ── Surface colors ──────────────────────────────────────────────────────────
  static const Color bg       = AppColors.bgDark;
  static const Color surface  = AppColors.bgCard;
  static const Color card     = AppColors.bgCardLight;
  static const Color cardHover= AppColors.bgSurface;

  // ── Status colors ───────────────────────────────────────────────────────────
  static const Color online  = AppColors.online;
  static const Color boost   = AppColors.warning;
  static const Color premium = AppColors.premium;
  static const Color error   = AppColors.error;

  // ── Text ────────────────────────────────────────────────────────────────────
  static const Color textPrimary   = AppColors.textPrimary;
  static const Color textSecondary = AppColors.textSecondary;
  static const Color textHint      = AppColors.textHint;

  // ── Gradients ────────────────────────────────────────────────────────────────
  static const LinearGradient brandGradient = AppColors.pinkGradient;

  static const LinearGradient cardGradient = AppColors.cardOverlay;

  static final ThemeData darkTheme = ThemeData(
    brightness: Brightness.dark,
    primaryColor: primary,
    scaffoldBackgroundColor: bg,
    fontFamily: 'SF Pro Display',
    colorScheme: const ColorScheme.dark(
      primary: primary,
      secondary: accent,
      surface: AppColors.bgCard,
      error: error,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.bgDark,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: AppColors.textPrimary,
        fontSize: 18,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
      ),
      iconTheme: IconThemeData(color: AppColors.textPrimary),
    ),
    cardTheme: CardThemeData(
      color: AppColors.bgCardLight,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        textStyle: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        side: BorderSide(color: AppColors.pink500.withValues(alpha: 0.3)),
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.bgCard,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide(color: AppColors.pink500.withValues(alpha: 0.15)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: const BorderSide(color: primary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      hintStyle: const TextStyle(color: AppColors.textHint, fontSize: 15),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.bgCard,
      selectedItemColor: primary,
      unselectedItemColor: AppColors.textHint,
      type: BottomNavigationBarType.fixed,
      showUnselectedLabels: true,
      selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      unselectedLabelStyle: TextStyle(fontSize: 11),
    ),
    dividerTheme: DividerThemeData(
      color: AppColors.pink500.withValues(alpha: 0.1),
      thickness: 0.5,
    ),
  );
}
