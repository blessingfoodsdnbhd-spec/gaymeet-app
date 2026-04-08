import 'package:flutter/material.dart';

class AppTheme {
  // Brand colors
  static const Color primary = Color(0xFFFF3B6F);
  static const Color primaryLight = Color(0xFFFF6B95);
  static const Color accent = Color(0xFF7C4DFF);
  static const Color gradient1 = Color(0xFFFF3B6F);
  static const Color gradient2 = Color(0xFFFF8A5C);

  // Surface colors
  static const Color bg = Color(0xFF0D0D0D);
  static const Color surface = Color(0xFF1A1A1A);
  static const Color card = Color(0xFF242424);
  static const Color cardHover = Color(0xFF2E2E2E);

  // Status colors
  static const Color online = Color(0xFF00E676);
  static const Color boost = Color(0xFFFFD740);
  static const Color premium = Color(0xFFFFD700);
  static const Color error = Color(0xFFFF5252);

  // Text
  static const Color textPrimary = Color(0xFFF5F5F5);
  static const Color textSecondary = Color(0xFF9E9E9E);
  static const Color textHint = Color(0xFF616161);

  static const LinearGradient brandGradient = LinearGradient(
    colors: [gradient1, gradient2],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Colors.transparent, Colors.transparent, Color(0xCC000000)],
    stops: [0.0, 0.45, 1.0],
  );

  static final ThemeData darkTheme = ThemeData(
    brightness: Brightness.dark,
    primaryColor: primary,
    scaffoldBackgroundColor: bg,
    fontFamily: 'SF Pro Display',
    colorScheme: const ColorScheme.dark(
      primary: primary,
      secondary: accent,
      surface: surface,
      error: error,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: bg,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: textPrimary,
        fontSize: 18,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
      ),
      iconTheme: IconThemeData(color: textPrimary),
    ),
    cardTheme: CardThemeData(
      color: card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
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
        foregroundColor: textPrimary,
        side: const BorderSide(color: Color(0xFF3A3A3A)),
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: primary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      hintStyle: const TextStyle(color: textHint, fontSize: 15),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: surface,
      selectedItemColor: primary,
      unselectedItemColor: textHint,
      type: BottomNavigationBarType.fixed,
      showUnselectedLabels: true,
      selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      unselectedLabelStyle: TextStyle(fontSize: 11),
    ),
    dividerTheme: const DividerThemeData(
      color: Color(0xFF2A2A2A),
      thickness: 0.5,
    ),
  );
}
