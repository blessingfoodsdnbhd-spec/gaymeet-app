import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import 'privacy_provider.dart'; // re-uses sharedPreferencesProvider

// ── Prefs keys ────────────────────────────────────────────────────────────────

const _kBoostExpiryMs = 'boost_expiry_ms';
const _kBoostWeekKey = 'boost_week_key';

// ── State ─────────────────────────────────────────────────────────────────────

class BoostState {
  /// True while the 30-min boost window is open.
  final bool isBoostActive;

  /// When the active boost expires (null when inactive).
  final DateTime? boostExpiresAt;

  /// True if the free weekly boost has already been used this week.
  final bool weeklyBoostUsed;

  const BoostState({
    this.isBoostActive = false,
    this.boostExpiresAt,
    this.weeklyBoostUsed = false,
  });

  /// Premium users get one free boost per week.
  bool get weeklyBoostAvailable => !weeklyBoostUsed;

  /// Remaining boost duration (null when inactive or expired).
  Duration? get remaining {
    if (!isBoostActive || boostExpiresAt == null) return null;
    final diff = boostExpiresAt!.difference(DateTime.now());
    return diff.isNegative ? null : diff;
  }

  BoostState copyWith({
    bool? isBoostActive,
    DateTime? boostExpiresAt,
    bool clearExpiry = false,
    bool? weeklyBoostUsed,
  }) =>
      BoostState(
        isBoostActive: isBoostActive ?? this.isBoostActive,
        boostExpiresAt:
            clearExpiry ? null : boostExpiresAt ?? this.boostExpiresAt,
        weeklyBoostUsed: weeklyBoostUsed ?? this.weeklyBoostUsed,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class BoostNotifier extends StateNotifier<BoostState> {
  final ApiClient _api;
  final SharedPreferences _prefs;
  Timer? _expiryTimer;

  BoostNotifier(this._api, this._prefs) : super(const BoostState()) {
    _seedFromPrefs();
  }

  void _seedFromPrefs() {
    final expiryMs = _prefs.getInt(_kBoostExpiryMs);
    final weekKey = _prefs.getString(_kBoostWeekKey);
    final weeklyUsed = weekKey == _currentWeekKey();

    if (expiryMs != null) {
      final expiresAt = DateTime.fromMillisecondsSinceEpoch(expiryMs);
      if (DateTime.now().isBefore(expiresAt)) {
        state = BoostState(
          isBoostActive: true,
          boostExpiresAt: expiresAt,
          weeklyBoostUsed: weeklyUsed,
        );
        _scheduleExpiry(expiresAt);
        return;
      }
    }

    state = BoostState(weeklyBoostUsed: weeklyUsed);
  }

  /// Activate a 30-minute profile boost.
  /// Calls the API and persists state locally.
  Future<void> activateBoost() async {
    final expiresAt = DateTime.now().add(const Duration(minutes: 30));
    state = state.copyWith(
      isBoostActive: true,
      boostExpiresAt: expiresAt,
      weeklyBoostUsed: true,
    );
    _prefs.setInt(_kBoostExpiryMs, expiresAt.millisecondsSinceEpoch);
    _prefs.setString(_kBoostWeekKey, _currentWeekKey());
    _scheduleExpiry(expiresAt);

    // Fire-and-forget — best effort; local state is already updated
    _api.dio.post('/users/boost').catchError((_) {});
  }

  void _scheduleExpiry(DateTime expiresAt) {
    _expiryTimer?.cancel();
    final delay = expiresAt.difference(DateTime.now());
    if (delay.isNegative) {
      _expire();
      return;
    }
    _expiryTimer = Timer(delay, _expire);
  }

  void _expire() {
    if (mounted) {
      state = state.copyWith(
        isBoostActive: false,
        clearExpiry: true,
      );
    }
  }

  /// ISO week identifier: "YYYY-Www"
  String _currentWeekKey() {
    final now = DateTime.now();
    final daysSinceEpoch = now.difference(DateTime(1970)).inDays;
    return 'week_${daysSinceEpoch ~/ 7}';
  }

  @override
  void dispose() {
    _expiryTimer?.cancel();
    super.dispose();
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

final boostProvider =
    StateNotifierProvider<BoostNotifier, BoostState>((ref) {
  return BoostNotifier(
    ref.watch(apiClientProvider),
    ref.watch(sharedPreferencesProvider),
  );
});
