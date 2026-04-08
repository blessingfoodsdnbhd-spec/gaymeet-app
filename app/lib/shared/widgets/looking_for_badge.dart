import 'package:flutter/material.dart';

/// Colored pill badge showing "正在找" status.
class LookingForBadge extends StatelessWidget {
  final String status;
  final bool small;
  const LookingForBadge({super.key, required this.status, this.small = false});

  @override
  Widget build(BuildContext context) {
    final info = _info(status);
    if (info == null) return const SizedBox.shrink();

    final fontSize = small ? 10.0 : 12.0;
    final padding = small
        ? const EdgeInsets.symmetric(horizontal: 7, vertical: 2)
        : const EdgeInsets.symmetric(horizontal: 10, vertical: 4);

    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: info.color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: info.color.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(info.emoji, style: TextStyle(fontSize: fontSize)),
          const SizedBox(width: 3),
          Text(
            info.label,
            style: TextStyle(
              fontSize: fontSize,
              color: info.color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  static _LookingForInfo? _info(String status) {
    switch (status) {
      case 'chat':
        return _LookingForInfo('💬', '聊天', const Color(0xFF42A5F5));
      case 'date':
        return _LookingForInfo('❤️', '约会', const Color(0xFFEF5350));
      case 'friends':
        return _LookingForInfo('👋', '交友', const Color(0xFF66BB6A));
      case 'gym':
        return _LookingForInfo('💪', '健身伙伴', const Color(0xFFFF7043));
      case 'makan':
        return _LookingForInfo('🍜', '一起吃饭', const Color(0xFFFFB300));
      case 'travel':
        return _LookingForInfo('✈️', '旅行伙伴', const Color(0xFF26C6DA));
      case 'relationship':
        return _LookingForInfo('💕', '认真交往', const Color(0xFFAB47BC));
      default:
        return null;
    }
  }
}

class _LookingForInfo {
  final String emoji;
  final String label;
  final Color color;
  const _LookingForInfo(this.emoji, this.label, this.color);
}

/// All supported statuses — used by the picker sheet.
const kLookingForOptions = [
  'chat',
  'date',
  'friends',
  'gym',
  'makan',
  'travel',
  'relationship',
];
