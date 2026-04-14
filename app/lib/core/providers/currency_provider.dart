import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ── Currency model ────────────────────────────────────────────────────────────

class CurrencyInfo {
  final String code;
  final String symbol;
  final String name;
  final String flag;
  final double rate; // relative to MYR

  const CurrencyInfo({
    required this.code,
    required this.symbol,
    required this.name,
    required this.flag,
    required this.rate,
  });
}

const Map<String, CurrencyInfo> kCurrencies = {
  'MYR': CurrencyInfo(code: 'MYR', symbol: 'RM',  name: 'Malaysian Ringgit', flag: '🇲🇾', rate: 1.0),
  'SGD': CurrencyInfo(code: 'SGD', symbol: 'S\$', name: 'Singapore Dollar',  flag: '🇸🇬', rate: 0.3),
  'THB': CurrencyInfo(code: 'THB', symbol: '฿',   name: 'Thai Baht',         flag: '🇹🇭', rate: 7.8),
  'USD': CurrencyInfo(code: 'USD', symbol: '\$',   name: 'US Dollar',         flag: '🇺🇸', rate: 0.21),
};

// ── Notifier ──────────────────────────────────────────────────────────────────

class CurrencyNotifier extends StateNotifier<CurrencyInfo> {
  static const _kPrefKey = 'selected_currency';

  CurrencyNotifier() : super(kCurrencies['MYR']!) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_kPrefKey) ?? 'MYR';
    state = kCurrencies[code] ?? kCurrencies['MYR']!;
  }

  Future<void> setCurrency(String code) async {
    final info = kCurrencies[code];
    if (info == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kPrefKey, code);
    state = info;
  }

  /// Convert a MYR amount to the currently selected currency.
  double convert(double amountMYR) {
    return (amountMYR * state.rate * 100).round() / 100;
  }

  /// Format a MYR amount as a price string in the selected currency.
  String formatPrice(double amountMYR) {
    final converted = convert(amountMYR);
    return '${state.symbol}${converted.toStringAsFixed(2)}';
  }
}

final currencyProvider = StateNotifierProvider<CurrencyNotifier, CurrencyInfo>(
  (_) => CurrencyNotifier(),
);
