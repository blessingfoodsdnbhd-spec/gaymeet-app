import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppLocale { zh, en, ms }

class LocaleNotifier extends StateNotifier<AppLocale> {
  static const _kLocale = 'app_locale';

  LocaleNotifier() : super(AppLocale.zh) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kLocale);
    state = switch (saved) {
      'en' => AppLocale.en,
      'ms' => AppLocale.ms,
      _ => AppLocale.zh,
    };
  }

  Future<void> setLocale(AppLocale locale) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kLocale, locale.name);
    state = locale;
  }
}

final localeProvider = StateNotifierProvider<LocaleNotifier, AppLocale>(
  (_) => LocaleNotifier(),
);
