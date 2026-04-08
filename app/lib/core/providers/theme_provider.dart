import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeNotifier extends StateNotifier<ThemeMode> {
  static const _kTheme = 'app_theme_mode';

  ThemeNotifier() : super(ThemeMode.dark) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kTheme);
    state = switch (saved) {
      'light' => ThemeMode.light,
      'system' => ThemeMode.system,
      _ => ThemeMode.dark,
    };
  }

  Future<void> setTheme(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    final name = switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.system => 'system',
      _ => 'dark',
    };
    await prefs.setString(_kTheme, name);
    state = mode;
  }

  void toggle() {
    setTheme(state == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark);
  }
}

final themeProvider = StateNotifierProvider<ThemeNotifier, ThemeMode>(
  (_) => ThemeNotifier(),
);
