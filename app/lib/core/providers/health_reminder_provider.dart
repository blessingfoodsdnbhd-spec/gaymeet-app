import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class HealthReminderState {
  final DateTime? lastTestDate;
  final bool reminderEnabled;
  final int intervalMonths; // 3, 6, or 12
  final DateTime? nextReminderDate;

  const HealthReminderState({
    this.lastTestDate,
    this.reminderEnabled = false,
    this.intervalMonths = 3,
    this.nextReminderDate,
  });

  int get daysSinceLastTest {
    if (lastTestDate == null) return -1;
    return DateTime.now().difference(lastTestDate!).inDays;
  }

  HealthReminderState copyWith({
    DateTime? lastTestDate,
    bool? reminderEnabled,
    int? intervalMonths,
    DateTime? nextReminderDate,
    bool clearLastTestDate = false,
  }) =>
      HealthReminderState(
        lastTestDate: clearLastTestDate ? null : (lastTestDate ?? this.lastTestDate),
        reminderEnabled: reminderEnabled ?? this.reminderEnabled,
        intervalMonths: intervalMonths ?? this.intervalMonths,
        nextReminderDate: nextReminderDate ?? _calcNext(
          clearLastTestDate ? null : (lastTestDate ?? this.lastTestDate),
          intervalMonths ?? this.intervalMonths,
          reminderEnabled ?? this.reminderEnabled,
        ),
      );

  static DateTime? _calcNext(DateTime? last, int months, bool enabled) {
    if (!enabled || last == null) return null;
    return DateTime(last.year, last.month + months, last.day);
  }
}

class HealthReminderNotifier extends StateNotifier<HealthReminderState> {
  static const _kLastTest = 'health_last_test';
  static const _kEnabled = 'health_reminder_enabled';
  static const _kInterval = 'health_interval_months';

  HealthReminderNotifier() : super(const HealthReminderState()) {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final lastTestStr = prefs.getString(_kLastTest);
    final enabled = prefs.getBool(_kEnabled) ?? false;
    final interval = prefs.getInt(_kInterval) ?? 3;
    final lastTest =
        lastTestStr != null ? DateTime.tryParse(lastTestStr) : null;

    state = HealthReminderState(
      lastTestDate: lastTest,
      reminderEnabled: enabled,
      intervalMonths: interval,
      nextReminderDate: HealthReminderState._calcNext(lastTest, interval, enabled),
    );
  }

  Future<void> setLastTestDate(DateTime date) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kLastTest, date.toIso8601String());
    state = state.copyWith(
      lastTestDate: date,
      nextReminderDate: HealthReminderState._calcNext(
          date, state.intervalMonths, state.reminderEnabled),
    );
  }

  Future<void> setReminderEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kEnabled, enabled);
    state = state.copyWith(reminderEnabled: enabled);
  }

  Future<void> setInterval(int months) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kInterval, months);
    state = state.copyWith(intervalMonths: months);
  }
}

final healthReminderProvider =
    StateNotifierProvider<HealthReminderNotifier, HealthReminderState>(
  (_) => HealthReminderNotifier(),
);
