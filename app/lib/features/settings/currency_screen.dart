import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/currency_provider.dart';

class CurrencyScreen extends ConsumerWidget {
  const CurrencyScreen({super.key});

  static const List<Map<String, String>> _currencies = [
    {
      'code': 'MYR',
      'flag': '🇲🇾',
      'name': 'Malaysian Ringgit',
      'symbol': 'RM',
      'country': '马来西亚令吉',
    },
    {
      'code': 'SGD',
      'flag': '🇸🇬',
      'name': 'Singapore Dollar',
      'symbol': 'S\$',
      'country': '新加坡元',
    },
    {
      'code': 'THB',
      'flag': '🇹🇭',
      'name': 'Thai Baht',
      'symbol': '฿',
      'country': '泰国铢',
    },
    {
      'code': 'USD',
      'flag': '🇺🇸',
      'name': 'US Dollar',
      'symbol': '\$',
      'country': '美元',
    },
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(currencyProvider);
    final notifier = ref.read(currencyProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('货币 / Currency')),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(
              '选择你偏好的显示货币',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
            ),
          ),
          ..._currencies.map((currency) {
            final code = currency['code']!;
            final isSelected = selected == code;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GestureDetector(
                onTap: () => notifier.setCurrency(code),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppTheme.primary.withOpacity(0.1)
                        : AppTheme.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected
                          ? AppTheme.primary
                          : AppTheme.primary.withOpacity(0.1),
                      width: isSelected ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Text(
                        currency['flag']!,
                        style: const TextStyle(fontSize: 28),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  code,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 16,
                                    color: isSelected
                                        ? AppTheme.primary
                                        : AppTheme.textPrimary,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: AppTheme.surface,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    currency['symbol']!,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: AppTheme.textSecondary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${currency['country']} · ${currency['name']}',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isSelected)
                        Icon(Icons.check_circle_rounded,
                            color: AppTheme.primary)
                      else
                        Icon(Icons.radio_button_unchecked_rounded,
                            color: AppTheme.textHint),
                    ],
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
