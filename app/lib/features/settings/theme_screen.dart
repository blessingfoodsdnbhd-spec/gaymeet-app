import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/theme_provider.dart';

class ThemeScreen extends ConsumerWidget {
  const ThemeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(themeProvider);

    final options = [
      (
        ThemeMode.dark,
        Icons.dark_mode_rounded,
        '深色模式',
        'Dark Mode',
        const Color(0xFF1A1A1A),
      ),
      (
        ThemeMode.light,
        Icons.light_mode_rounded,
        '浅色模式',
        'Light Mode',
        const Color(0xFFFFF9C4),
      ),
      (
        ThemeMode.system,
        Icons.settings_brightness_rounded,
        '跟随系统',
        'System Default',
        const Color(0xFF1A237E),
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('外观 / Theme')),
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
                Icon(Icons.palette_rounded, size: 18, color: AppTheme.primary),
                const SizedBox(width: 10),
                Text(
                  '选择应用外观模式',
                  style: TextStyle(
                      color: AppTheme.textSecondary, fontSize: 13),
                ),
              ],
            ),
          ),
          ...options.map((opt) {
            final (mode, icon, name, subtitle, previewColor) = opt;
            final selected = current == mode;
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
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: previewColor,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: Colors.white.withOpacity(0.1), width: 1),
                  ),
                  child: Icon(icon,
                      size: 20,
                      color: mode == ThemeMode.light
                          ? Colors.black87
                          : Colors.white70),
                ),
                title: Text(
                  name,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: selected ? AppTheme.primary : null,
                  ),
                ),
                subtitle: Text(
                  subtitle,
                  style:
                      TextStyle(color: AppTheme.textHint, fontSize: 12),
                ),
                trailing: selected
                    ? Icon(Icons.check_circle_rounded,
                        color: AppTheme.primary)
                    : Icon(Icons.circle_outlined,
                        color: AppTheme.textHint, size: 20),
                onTap: () {
                  ref.read(themeProvider.notifier).setTheme(mode);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('外观已切换为 $name'),
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
