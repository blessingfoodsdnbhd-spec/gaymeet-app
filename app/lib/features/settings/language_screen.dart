import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/locale_provider.dart';

class LanguageScreen extends ConsumerWidget {
  const LanguageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(localeProvider);

    final options = [
      (AppLocale.zh, '🇨🇳', '中文', 'Chinese (Simplified)'),
      (AppLocale.en, '🇬🇧', 'English', 'English'),
      (AppLocale.ms, '🇲🇾', 'Bahasa Melayu', 'Malay'),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('语言 / Language')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.translate_rounded,
                    size: 18, color: AppTheme.primary),
                const SizedBox(width: 10),
                Text(
                  '选择应用语言',
                  style: TextStyle(
                      color: AppTheme.textSecondary, fontSize: 13),
                ),
              ],
            ),
          ),
          ...options.map((opt) {
            final (locale, flag, name, subtitle) = opt;
            final selected = current == locale;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              decoration: BoxDecoration(
                color: selected
                    ? AppTheme.primary.withOpacity(0.1)
                    : AppTheme.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: selected
                      ? AppTheme.primary.withOpacity(0.6)
                      : const Color(0xFF2A2A2A),
                  width: selected ? 1.5 : 1,
                ),
              ),
              child: ListTile(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                leading: Text(flag,
                    style: const TextStyle(fontSize: 28)),
                title: Text(
                  name,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: selected ? AppTheme.primary : null,
                  ),
                ),
                subtitle: Text(
                  subtitle,
                  style: TextStyle(
                      color: AppTheme.textHint, fontSize: 12),
                ),
                trailing: selected
                    ? Icon(Icons.check_circle_rounded,
                        color: AppTheme.primary)
                    : Icon(Icons.circle_outlined,
                        color: AppTheme.textHint, size: 20),
                onTap: () {
                  ref.read(localeProvider.notifier).setLocale(locale);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('语言已切换为 $name'),
                      duration: const Duration(seconds: 1),
                    ),
                  );
                },
              ),
            );
          }),
        ],
      ),
    );
  }
}
