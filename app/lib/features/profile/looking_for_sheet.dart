import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/auth_provider.dart';
import '../../shared/widgets/looking_for_badge.dart';

class LookingForSheet extends ConsumerStatefulWidget {
  final String? current;
  const LookingForSheet({super.key, this.current});

  @override
  ConsumerState<LookingForSheet> createState() => _LookingForSheetState();
}

class _LookingForSheetState extends ConsumerState<LookingForSheet> {
  String? _selected;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _selected = widget.current;
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    await ref.read(authStateProvider.notifier).updateProfile({'lookingFor': _selected});
    if (mounted) Navigator.of(context).pop(_selected);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(
          20, 16, 20, MediaQuery.of(context).padding.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const Text('正在找',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text('告诉大家你在寻找什么',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 20),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: kLookingForOptions.map((opt) {
              final isSelected = _selected == opt;
              return GestureDetector(
                onTap: () => setState(() => _selected = isSelected ? null : opt),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? AppTheme.primary.withValues(alpha: 0.15)
                        : AppTheme.card,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isSelected
                          ? AppTheme.primary
                          : const Color(0xFF2A2A2A),
                      width: isSelected ? 1.5 : 1,
                    ),
                  ),
                  child: LookingForBadge(status: opt),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('保存'),
            ),
          ),
        ],
      ),
    );
  }
}
