import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class CurrencyNotifier extends StateNotifier<String> {
  static const _kCurrency = 'selected_currency';

  CurrencyNotifier() : super('MYR') {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kCurrency);
    if (saved != null && ['MYR', 'SGD', 'THB', 'USD'].contains(saved)) {
      state = saved;
    }
  }

  Future<void> setCurrency(String currency) async {
    if (!['MYR', 'SGD', 'THB', 'USD'].contains(currency)) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kCurrency, currency);
    state = currency;
  }
}

final currencyProvider = StateNotifierProvider<CurrencyNotifier, String>(
  (_) => CurrencyNotifier(),
);
