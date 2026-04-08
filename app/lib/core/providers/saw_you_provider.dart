import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/saw_you_service.dart';
import 'privacy_provider.dart'; // sharedPreferencesProvider

// ── Prefs keys ────────────────────────────────────────────────────────────────

const _kPlatesMsgDate = 'sawu_msg_date';
const _kPlatesMsgCount = 'sawu_msg_count';
const _kClaimedPlate = 'sawu_claimed_plate';

/// Free users can send this many plate messages per day (mirrors backend).
const int kFreePlateMessagesPerDay = 3;

// ── Send-limit state (daily counter, SharedPreferences) ───────────────────────

class SawYouLimitState {
  final int sentToday;
  const SawYouLimitState({this.sentToday = 0});

  bool get canSend => sentToday < kFreePlateMessagesPerDay;
  int get remaining =>
      (kFreePlateMessagesPerDay - sentToday).clamp(0, kFreePlateMessagesPerDay);
}

class SawYouLimitNotifier extends StateNotifier<SawYouLimitState> {
  final SharedPreferences _prefs;

  SawYouLimitNotifier(this._prefs) : super(const SawYouLimitState()) {
    _seed();
  }

  void _seed() {
    final savedDate = _prefs.getString(_kPlatesMsgDate);
    final today = _todayStr();
    final count =
        savedDate == today ? (_prefs.getInt(_kPlatesMsgCount) ?? 0) : 0;
    state = SawYouLimitState(sentToday: count);
  }

  void recordSent() {
    final n = state.sentToday + 1;
    state = SawYouLimitState(sentToday: n);
    _prefs.setString(_kPlatesMsgDate, _todayStr());
    _prefs.setInt(_kPlatesMsgCount, n);
  }

  String _todayStr() => DateTime.now().toIso8601String().substring(0, 10);
}

final sawYouLimitProvider =
    StateNotifierProvider<SawYouLimitNotifier, SawYouLimitState>((ref) {
  return SawYouLimitNotifier(ref.watch(sharedPreferencesProvider));
});

// ── Inbox state ───────────────────────────────────────────────────────────────

class SawYouInboxState {
  final PlateInbox? inbox;
  final bool isLoading;
  final String? error;

  const SawYouInboxState({
    this.inbox,
    this.isLoading = false,
    this.error,
  });

  SawYouInboxState copyWith({
    PlateInbox? inbox,
    bool? isLoading,
    String? error,
  }) =>
      SawYouInboxState(
        inbox: inbox ?? this.inbox,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

class SawYouInboxNotifier extends StateNotifier<SawYouInboxState> {
  final SawYouService _service;

  SawYouInboxNotifier(this._service) : super(const SawYouInboxState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true);
    try {
      final inbox = await _service.getMessages();
      state = state.copyWith(inbox: inbox, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> reportMessage(String messageId, String reason) async {
    await _service.reportMessage(messageId, reason);
    await fetch();
  }

  Future<void> blockSender(String messageId) async {
    await _service.blockSender(messageId);
    await fetch();
  }
}

final sawYouInboxProvider =
    StateNotifierProvider<SawYouInboxNotifier, SawYouInboxState>((ref) {
  return SawYouInboxNotifier(ref.watch(sawYouServiceProvider));
});

// ── Claimed plate (persisted locally for quick access) ────────────────────────

class ClaimedPlateNotifier extends StateNotifier<String?> {
  final SharedPreferences _prefs;

  ClaimedPlateNotifier(this._prefs)
      : super(_prefs.getString(_kClaimedPlate));

  void set(String plateNumber) {
    state = plateNumber;
    _prefs.setString(_kClaimedPlate, plateNumber);
  }

  void clear() {
    state = null;
    _prefs.remove(_kClaimedPlate);
  }
}

final claimedPlateProvider =
    StateNotifierProvider<ClaimedPlateNotifier, String?>((ref) {
  return ClaimedPlateNotifier(ref.watch(sharedPreferencesProvider));
});
