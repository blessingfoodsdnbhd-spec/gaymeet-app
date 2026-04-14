import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/api/api_client.dart';
import '../../core/providers/auth_provider.dart';

// ── Model ─────────────────────────────────────────────────────────────────────

class CalendarEvent {
  final String id;
  final String title;
  final String description;
  final DateTime startAt;
  final DateTime endAt;
  final bool allDay;
  final String type;
  final String color;
  final String? location;

  const CalendarEvent({
    required this.id,
    required this.title,
    required this.description,
    required this.startAt,
    required this.endAt,
    required this.allDay,
    required this.type,
    required this.color,
    this.location,
  });

  factory CalendarEvent.fromJson(Map<String, dynamic> json) {
    return CalendarEvent(
      id: json['_id'] as String,
      title: json['title'] as String,
      description: json['description'] as String? ?? '',
      startAt: DateTime.parse(json['startAt'] as String).toLocal(),
      endAt: DateTime.parse(json['endAt'] as String).toLocal(),
      allDay: json['allDay'] as bool? ?? false,
      type: json['type'] as String? ?? 'event',
      color: json['color'] as String? ?? '#E91E63',
      location: json['location'] as String?,
    );
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

final _selectedMonthProvider = StateProvider<DateTime>(
  (_) => DateTime(DateTime.now().year, DateTime.now().month),
);

final _calendarEventsProvider = FutureProvider.family
    .autoDispose<List<CalendarEvent>, DateTime>((ref, month) async {
  final api = ref.watch(apiClientProvider);
  final from = DateTime(month.year, month.month);
  final to = DateTime(month.year, month.month + 1, 0, 23, 59, 59);
  final res = await api.dio.get('/calendar', queryParameters: {
    'from': from.toIso8601String(),
    'to': to.toIso8601String(),
  });
  final list = res.data['data'] as List;
  return list.map((e) => CalendarEvent.fromJson(e as Map<String, dynamic>)).toList();
});

// ── Screen ────────────────────────────────────────────────────────────────────

class CalendarScreen extends ConsumerWidget {
  const CalendarScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedMonth = ref.watch(_selectedMonthProvider);
    final eventsAsync = ref.watch(_calendarEventsProvider(selectedMonth));

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        title: const Text('Calendar'),
        backgroundColor: AppTheme.bg,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: () => _showCreateSheet(context, ref, selectedMonth),
          ),
        ],
      ),
      body: Column(
        children: [
          _MonthSelector(selectedMonth: selectedMonth),
          _CalendarGrid(
            month: selectedMonth,
            eventsAsync: eventsAsync,
          ),
          const Divider(height: 1),
          Expanded(
            child: eventsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Text('Failed to load events',
                    style: TextStyle(color: AppTheme.textSecondary)),
              ),
              data: (events) => events.isEmpty
                  ? _EmptyState(onAdd: () => _showCreateSheet(context, ref, selectedMonth))
                  : _EventList(
                      events: events,
                      onDelete: (id) => _deleteEvent(context, ref, id, selectedMonth),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showCreateSheet(BuildContext context, WidgetRef ref, DateTime month) async {
    final titleCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final locCtrl = TextEditingController();
    DateTime selectedDate = DateTime.now();
    String selectedType = 'event';
    String selectedColor = '#E91E63';

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => Padding(
          padding: EdgeInsets.only(
            left: 20, right: 20, top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 32,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    gradient: AppTheme.brandGradient,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.calendar_today_rounded, color: Colors.white, size: 18),
                ),
                const SizedBox(width: 10),
                const Text('New Event',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              ]),
              const SizedBox(height: 16),
              TextField(
                controller: titleCtrl,
                decoration: _inputDecoration('Title *'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: descCtrl,
                decoration: _inputDecoration('Description'),
                maxLines: 2,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: locCtrl,
                decoration: _inputDecoration('Location (optional)'),
              ),
              const SizedBox(height: 14),
              // Date picker row
              GestureDetector(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: ctx,
                    initialDate: selectedDate,
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2030),
                    builder: (_, child) => Theme(
                      data: Theme.of(context).copyWith(
                        colorScheme: ColorScheme.dark(primary: AppTheme.primary),
                      ),
                      child: child!,
                    ),
                  );
                  if (picked != null) setState(() => selectedDate = picked);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.event_rounded, color: AppTheme.primary, size: 18),
                      const SizedBox(width: 10),
                      Text(
                        '${selectedDate.day}/${selectedDate.month}/${selectedDate.year}',
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
              // Type chips
              Wrap(
                spacing: 8,
                children: ['event', 'date', 'reminder', 'birthday'].map((t) {
                  final icons = {'event': '📅', 'date': '💕', 'reminder': '⏰', 'birthday': '🎂'};
                  return ChoiceChip(
                    label: Text('${icons[t]} $t'),
                    selected: selectedType == t,
                    onSelected: (_) => setState(() => selectedType = t),
                    selectedColor: AppTheme.primary.withOpacity(0.2),
                    labelStyle: TextStyle(
                      color: selectedType == t ? AppTheme.primary : AppTheme.textSecondary,
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () async {
                    if (titleCtrl.text.trim().isEmpty) return;
                    Navigator.pop(ctx);
                    await _createEvent(
                      context, ref,
                      title: titleCtrl.text.trim(),
                      description: descCtrl.text.trim(),
                      location: locCtrl.text.trim(),
                      date: selectedDate,
                      type: selectedType,
                      color: selectedColor,
                      month: month,
                    );
                  },
                  child: const Text('Add Event', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) => InputDecoration(
        hintText: hint,
        filled: true,
        fillColor: AppTheme.card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        hintStyle: TextStyle(color: AppTheme.textHint),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      );

  Future<void> _createEvent(
    BuildContext context,
    WidgetRef ref, {
    required String title,
    required String description,
    required String location,
    required DateTime date,
    required String type,
    required String color,
    required DateTime month,
  }) async {
    final api = ref.read(apiClientProvider);
    try {
      await api.dio.post('/calendar', data: {
        'title': title,
        'description': description,
        'location': location.isEmpty ? null : location,
        'startAt': date.toIso8601String(),
        'endAt': date.toIso8601String(),
        'type': type,
        'color': color,
      });
      ref.invalidate(_calendarEventsProvider(month));
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create event: $e')),
        );
      }
    }
  }

  Future<void> _deleteEvent(
      BuildContext context, WidgetRef ref, String id, DateTime month) async {
    final api = ref.read(apiClientProvider);
    try {
      await api.dio.delete('/calendar/$id');
      ref.invalidate(_calendarEventsProvider(month));
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to delete event')),
        );
      }
    }
  }
}

// ── Month selector ────────────────────────────────────────────────────────────

class _MonthSelector extends ConsumerWidget {
  final DateTime selectedMonth;
  const _MonthSelector({required this.selectedMonth});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: Icon(Icons.chevron_left_rounded, color: AppTheme.primary),
            onPressed: () {
              ref.read(_selectedMonthProvider.notifier).state = DateTime(
                selectedMonth.year,
                selectedMonth.month - 1,
              );
            },
          ),
          Text(
            '${months[selectedMonth.month - 1]} ${selectedMonth.year}',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
          IconButton(
            icon: Icon(Icons.chevron_right_rounded, color: AppTheme.primary),
            onPressed: () {
              ref.read(_selectedMonthProvider.notifier).state = DateTime(
                selectedMonth.year,
                selectedMonth.month + 1,
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── Calendar grid ─────────────────────────────────────────────────────────────

class _CalendarGrid extends StatelessWidget {
  final DateTime month;
  final AsyncValue<List<CalendarEvent>> eventsAsync;
  const _CalendarGrid({required this.month, required this.eventsAsync});

  @override
  Widget build(BuildContext context) {
    final daysInMonth = DateUtils.getDaysInMonth(month.year, month.month);
    final firstWeekday = DateTime(month.year, month.month, 1).weekday % 7; // Sun=0
    final today = DateTime.now();

    final eventDays = eventsAsync.maybeWhen(
      data: (events) => events.map((e) => e.startAt.day).toSet(),
      orElse: () => <int>{},
    );

    final dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        children: [
          // Day headers
          Row(
            children: dayLabels.map((d) => Expanded(
              child: Center(
                child: Text(d,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textHint,
                    )),
              ),
            )).toList(),
          ),
          const SizedBox(height: 6),
          // Days grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 1,
            ),
            itemCount: firstWeekday + daysInMonth,
            itemBuilder: (_, i) {
              if (i < firstWeekday) return const SizedBox.shrink();
              final day = i - firstWeekday + 1;
              final isToday = today.year == month.year &&
                  today.month == month.month &&
                  today.day == day;
              final hasEvent = eventDays.contains(day);

              return Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      gradient: isToday ? AppTheme.brandGradient : null,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        '$day',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isToday ? FontWeight.w700 : FontWeight.w400,
                          color: isToday ? Colors.white : AppTheme.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  if (hasEvent)
                    Container(
                      width: 4,
                      height: 4,
                      margin: const EdgeInsets.only(top: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── Event list ────────────────────────────────────────────────────────────────

class _EventList extends StatelessWidget {
  final List<CalendarEvent> events;
  final void Function(String id) onDelete;
  const _EventList({required this.events, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: events.length,
      itemBuilder: (_, i) {
        final e = events[i];
        final typeIcon = {'date': '💕', 'reminder': '⏰', 'birthday': '🎂'}[e.type] ?? '📅';
        final colorVal = Color(
          int.parse(e.color.replaceFirst('#', '0xFF')),
        );

        return Dismissible(
          key: Key(e.id),
          direction: DismissDirection.endToStart,
          onDismissed: (_) => onDelete(e.id),
          background: Container(
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: 20),
            decoration: BoxDecoration(
              color: Colors.redAccent.withOpacity(0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
          ),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(14),
              border: Border(left: BorderSide(color: colorVal, width: 3)),
            ),
            child: Row(
              children: [
                Text(typeIcon, style: const TextStyle(fontSize: 22)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e.title,
                          style: const TextStyle(
                              fontWeight: FontWeight.w600, fontSize: 14)),
                      if (e.description.isNotEmpty)
                        Text(e.description,
                            style: TextStyle(
                                fontSize: 12, color: AppTheme.textSecondary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      Text(
                        '${e.startAt.day}/${e.startAt.month}/${e.startAt.year}'
                        '${e.location != null ? ' · ${e.location}' : ''}',
                        style: TextStyle(fontSize: 11, color: AppTheme.textHint),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptyState({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('📅', style: const TextStyle(fontSize: 48)),
          const SizedBox(height: 14),
          Text('No events this month',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textSecondary)),
          const SizedBox(height: 6),
          Text('Tap + to add a date or reminder',
              style: TextStyle(fontSize: 13, color: AppTheme.textHint)),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add_rounded, size: 16),
            label: const Text('Add Event'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ],
      ),
    );
  }
}
