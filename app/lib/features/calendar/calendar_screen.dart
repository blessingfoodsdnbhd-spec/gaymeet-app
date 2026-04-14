import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/api/calendar_service.dart';
import '../../core/models/calendar_event.dart';
import '../../core/providers/auth_provider.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late CalendarService _svc;
  DateTime _focusedMonth = DateTime.now();
  DateTime? _selectedDay;
  List<CalendarEvent> _events = [];
  bool _loading = false;

  static const List<String> _weekdays = ['一', '二', '三', '四', '五', '六', '日'];

  @override
  void initState() {
    super.initState();
    _svc = CalendarService(ref.read(apiClientProvider));
    _loadEvents(_focusedMonth);
  }

  Future<void> _loadEvents(DateTime month) async {
    setState(() { _loading = true; });
    try {
      final events = await _svc.getEvents(month.month, month.year);
      setState(() {
        _events = events;
        _loading = false;
      });
    } catch (_) {
      setState(() { _loading = false; });
    }
  }

  void _prevMonth() {
    final newMonth = DateTime(_focusedMonth.year, _focusedMonth.month - 1, 1);
    setState(() {
      _focusedMonth = newMonth;
      _selectedDay = null;
    });
    _loadEvents(newMonth);
  }

  void _nextMonth() {
    final newMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1, 1);
    setState(() {
      _focusedMonth = newMonth;
      _selectedDay = null;
    });
    _loadEvents(newMonth);
  }

  List<CalendarEvent> _eventsForDay(DateTime day) {
    return _events.where((e) {
      final d = e.date;
      return d.year == day.year && d.month == day.month && d.day == day.day;
    }).toList();
  }

  bool _isToday(DateTime day) {
    final now = DateTime.now();
    return day.year == now.year && day.month == now.month && day.day == now.day;
  }

  bool _isSelected(DateTime day) {
    if (_selectedDay == null) return false;
    return day.year == _selectedDay!.year &&
        day.month == _selectedDay!.month &&
        day.day == _selectedDay!.day;
  }

  @override
  Widget build(BuildContext context) {
    final firstDayOfMonth = DateTime(_focusedMonth.year, _focusedMonth.month, 1);
    // Monday=1, offset from Monday start
    int startWeekday = firstDayOfMonth.weekday; // 1=Mon ... 7=Sun
    final daysInMonth = DateUtils.getDaysInMonth(_focusedMonth.year, _focusedMonth.month);
    final totalCells = startWeekday - 1 + daysInMonth;
    final rows = (totalCells / 7).ceil();

    final selectedEvents = _selectedDay != null ? _eventsForDay(_selectedDay!) : <CalendarEvent>[];

    return Scaffold(
      appBar: AppBar(title: const Text('活动日历')),
      body: Column(
        children: [
          // ── Month header ─────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  onPressed: _prevMonth,
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                Text(
                  DateFormat('yyyy年M月').format(_focusedMonth),
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700),
                ),
                IconButton(
                  onPressed: _nextMonth,
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
              ],
            ),
          ),

          // ── Weekday headers ──────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              children: _weekdays.map((w) {
                return Expanded(
                  child: Center(
                    child: Text(
                      w,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 8),

          // ── Calendar grid ────────────────────────────────────────────────────
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(),
            )
          else
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Table(
                children: List.generate(rows, (rowIdx) {
                  return TableRow(
                    children: List.generate(7, (colIdx) {
                      final cellIdx = rowIdx * 7 + colIdx;
                      final dayNum = cellIdx - (startWeekday - 1) + 1;

                      if (dayNum < 1 || dayNum > daysInMonth) {
                        return const SizedBox(height: 52);
                      }

                      final day = DateTime(_focusedMonth.year, _focusedMonth.month, dayNum);
                      final dayEvents = _eventsForDay(day);
                      final today = _isToday(day);
                      final selected = _isSelected(day);

                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedDay = selected ? null : day;
                          });
                        },
                        child: Container(
                          height: 52,
                          margin: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: selected
                                ? AppTheme.primary
                                : today
                                    ? AppTheme.primary.withOpacity(0.15)
                                    : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            border: today && !selected
                                ? Border.all(
                                    color: AppTheme.primary.withOpacity(0.5))
                                : null,
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                '$dayNum',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: today || selected
                                      ? FontWeight.w700
                                      : FontWeight.w400,
                                  color: selected
                                      ? Colors.white
                                      : today
                                          ? AppTheme.primary
                                          : AppTheme.textPrimary,
                                ),
                              ),
                              if (dayEvents.isNotEmpty)
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: dayEvents
                                      .take(3)
                                      .map(
                                        (e) => Container(
                                          width: 5,
                                          height: 5,
                                          margin: const EdgeInsets.symmetric(
                                              horizontal: 1),
                                          decoration: BoxDecoration(
                                            color: selected
                                                ? Colors.white
                                                : e.typeColor,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                      )
                                      .toList(),
                                ),
                            ],
                          ),
                        ),
                      );
                    }),
                  );
                }),
              ),
            ),

          const Divider(height: 24),

          // ── Selected day events ──────────────────────────────────────────────
          Expanded(
            child: _selectedDay == null
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('📅',
                            style: const TextStyle(fontSize: 40)),
                        const SizedBox(height: 8),
                        Text(
                          '选择日期查看活动',
                          style: TextStyle(color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                  )
                : selectedEvents.isEmpty
                    ? Center(
                        child: Text(
                          '该日暂无活动',
                          style:
                              TextStyle(color: AppTheme.textSecondary),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 8),
                        itemCount: selectedEvents.length,
                        itemBuilder: (_, i) {
                          final event = selectedEvents[i];
                          return _EventCard(event: event);
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  final CalendarEvent event;
  const _EventCard({required this.event});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: event.typeColor.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: event.typeColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(event.emoji, style: const TextStyle(fontSize: 22)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        event.title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: event.typeColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        event.typeLabel,
                        style: TextStyle(
                          fontSize: 11,
                          color: event.typeColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                if (event.description.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    event.description,
                    style: TextStyle(
                        color: AppTheme.textSecondary, fontSize: 13),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (event.location.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.location_on_outlined,
                          size: 13, color: AppTheme.textHint),
                      const SizedBox(width: 4),
                      Text(
                        event.location,
                        style: TextStyle(
                            fontSize: 12, color: AppTheme.textHint),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
