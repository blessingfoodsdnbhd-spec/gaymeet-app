import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/currency_provider.dart';

class CurrencyScreen extends ConsumerWidget {
  const CurrencyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(currencyProvider);
    final notifier = ref.read(currencyProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Currency / 货币'),
        backgroundColor: AppTheme.bg,
        elevation: 0,
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              'Select your preferred currency for pricing display.',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
          ),
          Expanded(
            child: ListView(
              children: kCurrencies.values.map((currency) {
                final isSelected = currency.code == current.code;
                return GestureDetector(
                  onTap: () async {
                    await notifier.setCurrency(currency.code);
                    if (context.mounted) Navigator.of(context).pop();
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppTheme.primary.withValues(alpha: 0.12)
                          : AppTheme.card,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isSelected
                            ? AppTheme.primary
                            : const Color(0xFF3A3A3A),
                        width: isSelected ? 2 : 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Text(currency.flag, style: const TextStyle(fontSize: 32)),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                currency.name,
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 15,
                                  color: isSelected
                                      ? AppTheme.textPrimary
                                      : AppTheme.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${currency.code} · ${currency.symbol}',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.textHint,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (isSelected)
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              color: AppTheme.primary,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.check_rounded,
                                color: Colors.white, size: 14),
                          )
                        else
                          Container(
                            width: 22,
                            height: 22,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: AppTheme.textHint, width: 2),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
