import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/models/event.dart';
import '../../core/providers/events_provider.dart';

class EventsCalendarScreen extends ConsumerStatefulWidget {
  const EventsCalendarScreen({super.key});

  @override
  ConsumerState<EventsCalendarScreen> createState() =>
      _EventsCalendarScreenState();
}

class _EventsCalendarScreenState extends ConsumerState<EventsCalendarScreen> {
  late DateTime _focusMonth;
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _focusMonth = DateTime(now.year, now.month);
    _selectedDay = DateTime(now.year, now.month, now.day);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  Map<DateTime, List<AppEvent>> _buildEventMap(List<AppEvent> events) {
    final map = <DateTime, List<AppEvent>>{};
    for (final e in events) {
      final key = DateTime(e.date.year, e.date.month, e.date.day);
      map.putIfAbsent(key, () => []).add(e);
    }
    return map;
  }

  List<AppEvent> _eventsForDay(
      Map<DateTime, List<AppEvent>> map, DateTime day) {
    final key = DateTime(day.year, day.month, day.day);
    return map[key] ?? [];
  }

  // Returns list of DateTimes for each day cell in the calendar grid
  // (including padding days from prev/next month)
  List<DateTime?> _buildGrid() {
    final firstDay = DateTime(_focusMonth.year, _focusMonth.month, 1);
    // weekday: 1=Mon…7=Sun. We want Sun=0.
    final startPad = (firstDay.weekday % 7);
    final daysInMonth =
        DateUtils.getDaysInMonth(_focusMonth.year, _focusMonth.month);
    final cells = <DateTime?>[];

    for (var i = 0; i < startPad; i++) {
      cells.add(null);
    }
    for (var d = 1; d <= daysInMonth; d++) {
      cells.add(DateTime(_focusMonth.year, _focusMonth.month, d));
    }
    // Pad to complete last row
    while (cells.length % 7 != 0) {
      cells.add(null);
    }
    return cells;
  }

  void _prevMonth() {
    setState(() {
      _focusMonth =
          DateTime(_focusMonth.year, _focusMonth.month - 1);
      _selectedDay = null;
    });
  }

  void _nextMonth() {
    setState(() {
      _focusMonth =
          DateTime(_focusMonth.year, _focusMonth.month + 1);
      _selectedDay = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final eventsState = ref.watch(eventsProvider);
    final eventMap = _buildEventMap(eventsState.events);
    final grid = _buildGrid();
    final selectedEvents = _selectedDay != null
        ? _eventsForDay(eventMap, _selectedDay!)
        : <AppEvent>[];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Event Calendar'),
        actions: [
          IconButton(
            icon: const Icon(Icons.list_rounded),
            tooltip: 'List view',
            onPressed: () => context.pop(),
          ),
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: () => context.push('/events/create'),
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Month navigator ──────────────────────────────────────────────
          _MonthHeader(
            focusMonth: _focusMonth,
            onPrev: _prevMonth,
            onNext: _nextMonth,
          ),

          // ── Day-of-week labels ───────────────────────────────────────────
          const _WeekdayRow(),

          // ── Calendar grid ─────────────────────────────────────────────────
          _CalendarGrid(
            grid: grid,
            eventMap: eventMap,
            selectedDay: _selectedDay,
            today: DateTime.now(),
            onDayTap: (day) => setState(() => _selectedDay = day),
          ),

          const Divider(height: 1),

          // ── Events for selected day ──────────────────────────────────────
          Expanded(
            child: _DayEventsList(
              selectedDay: _selectedDay,
              events: selectedEvents,
              isLoading: eventsState.isLoading,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Month header with nav ─────────────────────────────────────────────────────

class _MonthHeader extends StatelessWidget {
  final DateTime focusMonth;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  const _MonthHeader({
    required this.focusMonth,
    required this.onPrev,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left_rounded, size: 28),
            onPressed: onPrev,
            color: AppTheme.textPrimary,
          ),
          Expanded(
            child: Center(
              child: Text(
                DateFormat('MMMM yyyy').format(focusMonth),
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right_rounded, size: 28),
            onPressed: onNext,
            color: AppTheme.textPrimary,
          ),
        ],
      ),
    );
  }
}

// ── Weekday row ───────────────────────────────────────────────────────────────

class _WeekdayRow extends StatelessWidget {
  const _WeekdayRow();

  static const _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: _days
            .map(
              (d) => Expanded(
                child: Center(
                  child: Text(
                    d,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: d == 'Sun'
                          ? AppColors.hotPink
                          : AppTheme.textSecondary,
                    ),
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

// ── Calendar grid ─────────────────────────────────────────────────────────────

class _CalendarGrid extends StatelessWidget {
  final List<DateTime?> grid;
  final Map<DateTime, List<AppEvent>> eventMap;
  final DateTime? selectedDay;
  final DateTime today;
  final ValueChanged<DateTime> onDayTap;

  const _CalendarGrid({
    required this.grid,
    required this.eventMap,
    required this.selectedDay,
    required this.today,
    required this.onDayTap,
  });

  @override
  Widget build(BuildContext context) {
    final rows = (grid.length / 7).ceil();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Column(
        children: List.generate(rows, (row) {
          return Row(
            children: List.generate(7, (col) {
              final day = grid[row * 7 + col];
              if (day == null) return const Expanded(child: SizedBox(height: 44));
              return Expanded(child: _DayCell(
                day: day,
                events: eventMap[DateTime(day.year, day.month, day.day)] ?? [],
                isSelected: selectedDay != null &&
                    DateUtils.isSameDay(day, selectedDay!),
                isToday: DateUtils.isSameDay(day, today),
                onTap: () => onDayTap(day),
              ));
            }),
          );
        }),
      ),
    );
  }
}

// ── Individual day cell ───────────────────────────────────────────────────────

class _DayCell extends StatelessWidget {
  final DateTime day;
  final List<AppEvent> events;
  final bool isSelected;
  final bool isToday;
  final VoidCallback onTap;

  const _DayCell({
    required this.day,
    required this.events,
    required this.isSelected,
    required this.isToday,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          color: isSelected
              ? AppTheme.primary
              : isToday
                  ? AppTheme.primary.withValues(alpha: 0.12)
                  : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: isToday && !isSelected
              ? Border.all(color: AppTheme.primary.withValues(alpha: 0.5))
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${day.day}',
              style: TextStyle(
                fontSize: 14,
                fontWeight:
                    isSelected || isToday ? FontWeight.w700 : FontWeight.w400,
                color: isSelected
                    ? Colors.white
                    : day.weekday == 7
                        ? AppColors.hotPink
                        : AppTheme.textPrimary,
              ),
            ),
            if (events.isNotEmpty) ...[
              const SizedBox(height: 2),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < events.length.clamp(0, 3); i++)
                    Container(
                      width: 4,
                      height: 4,
                      margin: const EdgeInsets.symmetric(horizontal: 1),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? Colors.white.withValues(alpha: 0.8)
                            : _dotColor(events[i].category),
                        shape: BoxShape.circle,
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Color _dotColor(String category) {
    switch (category) {
      case 'makan':    return const Color(0xFFFF6B35);
      case 'party':    return AppColors.violet;
      case 'sports':   return AppColors.rainbowBlue;
      case 'hangout':  return AppColors.rainbowGreen;
      default:         return AppTheme.primary;
    }
  }
}

// ── Events list for selected day ──────────────────────────────────────────────

class _DayEventsList extends StatelessWidget {
  final DateTime? selectedDay;
  final List<AppEvent> events;
  final bool isLoading;

  const _DayEventsList({
    required this.selectedDay,
    required this.events,
    required this.isLoading,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (selectedDay == null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('📅', style: TextStyle(fontSize: 40)),
            const SizedBox(height: 8),
            Text(
              'Tap a date to see events',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
          ],
        ),
      );
    }

    final label = DateFormat('EEEE, d MMMM').format(selectedDay!);

    if (events.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          ),
          const SizedBox(height: 16),
          Center(
            child: Column(
              children: [
                const Text('🎉', style: TextStyle(fontSize: 36)),
                const SizedBox(height: 8),
                Text(
                  'No events on this day',
                  style: TextStyle(color: AppTheme.textSecondary),
                ),
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: () => context.push('/events/create'),
                  icon: const Icon(Icons.add_rounded, size: 16),
                  label: const Text('Create Event'),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      children: [
        Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
        ),
        const SizedBox(height: 2),
        Text(
          '${events.length} event${events.length != 1 ? 's' : ''}',
          style:
              TextStyle(color: AppTheme.textSecondary, fontSize: 12),
        ),
        const SizedBox(height: 12),
        ...events.map((e) => _CalendarEventTile(event: e)),
      ],
    );
  }
}

// ── Compact event tile ────────────────────────────────────────────────────────

class _CalendarEventTile extends StatelessWidget {
  final AppEvent event;
  const _CalendarEventTile({required this.event});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/events/${event.id}', extra: event),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(14),
          border: event.isAttending
              ? Border.all(
                  color: AppColors.rainbowGreen.withValues(alpha: 0.4), width: 1)
              : null,
        ),
        child: Row(
          children: [
            // Time badge
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: _catGradient(event.category),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  DateFormat('HH:mm').format(event.date),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Icon(Icons.location_on_rounded,
                          size: 11, color: AppTheme.textHint),
                      const SizedBox(width: 3),
                      Expanded(
                        child: Text(
                          event.venue.isEmpty ? event.address : event.venue,
                          style: TextStyle(
                              color: AppTheme.textSecondary, fontSize: 11),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: event.isFree
                        ? AppColors.rainbowGreen.withValues(alpha: 0.15)
                        : AppTheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    event.isFree
                        ? 'Free'
                        : 'RM ${event.price.toStringAsFixed(0)}',
                    style: TextStyle(
                      color: event.isFree
                          ? AppColors.rainbowGreen
                          : AppTheme.primary,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (event.isAttending) ...[
                  const SizedBox(height: 4),
                  const Icon(Icons.check_circle_rounded,
                      size: 14, color: AppColors.rainbowGreen),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  LinearGradient _catGradient(String cat) {
    switch (cat) {
      case 'makan':
        return const LinearGradient(
            colors: [Color(0xFF8B1A1A), Color(0xFFD4380D)]);
      case 'party':
        return const LinearGradient(
            colors: [Color(0xFF4A0E82), Color(0xFFAD4ECC)]);
      case 'sports':
        return const LinearGradient(
            colors: [Color(0xFF004D8C), Color(0xFF0095FF)]);
      case 'hangout':
        return const LinearGradient(
            colors: [Color(0xFF004D40), Color(0xFF00897B)]);
      default:
        return AppTheme.brandGradient;
    }
  }
}
