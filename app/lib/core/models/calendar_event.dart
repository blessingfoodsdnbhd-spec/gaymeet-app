import 'package:flutter/material.dart';

class CalendarEvent {
  final String id;
  final String title;
  final String description;
  final DateTime date;
  final DateTime? endDate;
  final String type; // pride|health|community|party|holiday
  final String location;
  final String emoji;

  const CalendarEvent({
    required this.id,
    required this.title,
    required this.description,
    required this.date,
    this.endDate,
    required this.type,
    required this.location,
    required this.emoji,
  });

  factory CalendarEvent.fromJson(Map<String, dynamic> j) {
    return CalendarEvent(
      id: j['_id']?.toString() ?? j['id']?.toString() ?? '',
      title: j['title'] as String? ?? '',
      description: j['description'] as String? ?? '',
      date: j['date'] != null
          ? DateTime.parse(j['date'].toString()).toLocal()
          : DateTime.now(),
      endDate: j['endDate'] != null
          ? DateTime.parse(j['endDate'].toString()).toLocal()
          : null,
      type: j['type'] as String? ?? 'community',
      location: j['location'] as String? ?? '',
      emoji: j['emoji'] as String? ?? '📅',
    );
  }

  Color get typeColor {
    switch (type) {
      case 'pride':
        return const Color(0xFFFF4D7E);
      case 'health':
        return const Color(0xFFE53935);
      case 'community':
        return const Color(0xFF1976D2);
      case 'party':
        return const Color(0xFF9C27B0);
      case 'holiday':
        return const Color(0xFFFF6D00);
      default:
        return const Color(0xFF1976D2);
    }
  }

  String get typeLabel {
    switch (type) {
      case 'pride':
        return '🏳️‍🌈 Pride';
      case 'health':
        return '❤️ 健康';
      case 'community':
        return '📅 社区';
      case 'party':
        return '🎉 派对';
      case 'holiday':
        return '🌟 节日';
      default:
        return '📅 社区';
    }
  }
}
