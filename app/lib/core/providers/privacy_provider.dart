import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_client.dart';
import '../models/user.dart';
import 'auth_provider.dart';

// ── SharedPreferences provider ────────────────────────────────────────────────
// Seeded at startup via ProviderScope.overrides in main.dart.

final sharedPreferencesProvider = Provider<SharedPreferences>(
  (_) => throw UnimplementedError(
      'sharedPreferencesProvider must be overridden in main.dart'),
);

// ── Pref keys ─────────────────────────────────────────────────────────────────

const _kHideDistance = 'priv_hideDistance';
const _kHideOnlineStatus = 'priv_hideOnlineStatus';
const _kHideFromNearby = 'priv_hideFromNearby';
const _kStealthOption = 'priv_stealthOption'; // 0=complete, 1=friendsOnly, 2=timed
const _kStealthUntil = 'priv_stealthUntil';   // epoch ms, timed stealth
const _kStealthActDate = 'priv_stealthActDate';
const _kStealthActCount = 'priv_stealthActCount';

const int kFreeStealthActivationsPerDay = 1;

enum StealthOption { complete, friendsOnly, timed }

// ── Model ─────────────────────────────────────────────────────────────────────

/// Privacy + stealth settings.
class PrivacySettings {
  final bool hideDistance;
  final bool hideOnlineStatus;
  final bool hideFromNearby;

  // ── Stealth extras (local-only) ──────────────────────────────────────────
  final StealthOption stealthOption;
  final DateTime? stealthUntil;   // non-null only when option==timed
  final int stealthActivationsToday;

  const PrivacySettings({
    this.hideDistance = false,
    this.hideOnlineStatus = false,
    this.hideFromNearby = false,
    this.stealthOption = StealthOption.complete,
    this.stealthUntil,
    this.stealthActivationsToday = 0,
  });

  /// True when timed stealth has expired.
  bool get isTimedStealthExpired =>
      stealthOption == StealthOption.timed &&
      stealthUntil != null &&
      DateTime.now().isAfter(stealthUntil!);

  bool get canActivateStealth =>
      stealthActivationsToday < kFreeStealthActivationsPerDay;

  PrivacySettings copyWith({
    bool? hideDistance,
    bool? hideOnlineStatus,
    bool? hideFromNearby,
    StealthOption? stealthOption,
    DateTime? stealthUntil,
    bool clearStealthUntil = false,
    int? stealthActivationsToday,
  }) =>
      PrivacySettings(
        hideDistance: hideDistance ?? this.hideDistance,
        hideOnlineStatus: hideOnlineStatus ?? this.hideOnlineStatus,
        hideFromNearby: hideFromNearby ?? this.hideFromNearby,
        stealthOption: stealthOption ?? this.stealthOption,
        stealthUntil:
            clearStealthUntil ? null : (stealthUntil ?? this.stealthUntil),
        stealthActivationsToday:
            stealthActivationsToday ?? this.stealthActivationsToday,
      );

  Map<String, dynamic> toJson() => {
        'hideDistance': hideDistance,
        'hideOnlineStatus': hideOnlineStatus,
        'hideFromNearby': hideFromNearby,
      };
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class PrivacyNotifier extends StateNotifier<PrivacySettings> {
  final ApiClient _api;
  final SharedPreferences _prefs;

  PrivacyNotifier(this._api, this._prefs) : super(const PrivacySettings()) {
    _seedFromPrefs();
  }

  /// Seed from the local cache immediately so the UI is correct
  /// before the network round-trip completes.
  void _seedFromPrefs() {
    final stealthOptIdx = _prefs.getInt(_kStealthOption) ?? 0;
    final stealthUntilMs = _prefs.getInt(_kStealthUntil);

    // Daily activation count
    final savedDate = _prefs.getString(_kStealthActDate);
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final count = savedDate == today
        ? (_prefs.getInt(_kStealthActCount) ?? 0)
        : 0;

    state = PrivacySettings(
      hideDistance: _prefs.getBool(_kHideDistance) ?? false,
      hideOnlineStatus: _prefs.getBool(_kHideOnlineStatus) ?? false,
      hideFromNearby: _prefs.getBool(_kHideFromNearby) ?? false,
      stealthOption: StealthOption.values[stealthOptIdx.clamp(0, 2)],
      stealthUntil: stealthUntilMs != null
          ? DateTime.fromMillisecondsSinceEpoch(stealthUntilMs)
          : null,
      stealthActivationsToday: count,
    );
  }

  /// Called after login / checkAuth to overwrite local cache with the
  /// authoritative server values.
  void syncFromServer(UserPreferences? prefs) {
    if (prefs == null) return;
    final updated = PrivacySettings(
      hideDistance: prefs.hideDistance,
      hideOnlineStatus: prefs.hideOnlineStatus,
      hideFromNearby: prefs.hideFromNearby,
    );
    state = updated;
    _persist(updated);
  }

  // ── Individual setters (called from settings screen) ──────────────────────

  /// Returns true on success, false if the API call failed (state is reverted).
  Future<bool> setHideDistance(bool value) =>
      _toggle(state.copyWith(hideDistance: value));

  Future<bool> setHideOnlineStatus(bool value) =>
      _toggle(state.copyWith(hideOnlineStatus: value));

  Future<bool> setHideFromNearby(bool value) =>
      _toggle(state.copyWith(hideFromNearby: value));

  // ── Core toggle logic ─────────────────────────────────────────────────────

  Future<bool> _toggle(PrivacySettings next) async {
    final previous = state;
    // Optimistic update — UI reflects the change immediately
    state = next;
    _persist(next);

    try {
      /// Backend expects: PATCH /users/settings
      /// Body: { hideDistance, hideOnlineStatus, hideFromNearby }
      /// Response: { data: { ... updated preferences ... } }
      await _api.dio.patch('/users/settings', data: next.toJson());
      return true;
    } catch (_) {
      // Revert both in-memory state and local cache on failure
      state = previous;
      _persist(previous);
      return false;
    }
  }

  // ── Stealth option setters ────────────────────────────────────────────────

  /// Set stealth option without changing hideFromNearby.
  void setStealthOption(StealthOption option) {
    state = state.copyWith(stealthOption: option, clearStealthUntil: true);
    _prefs.setInt(_kStealthOption, option.index);
    _prefs.remove(_kStealthUntil);
  }

  /// Activate timed stealth for [hours] hours. Counts against daily limit.
  Future<bool> activateTimedStealth(int hours, {bool isPremium = false}) async {
    if (!isPremium && !state.canActivateStealth) return false;
    final until = DateTime.now().add(Duration(hours: hours));
    final next = state.copyWith(
      hideFromNearby: true,
      stealthOption: StealthOption.timed,
      stealthUntil: until,
      stealthActivationsToday: state.stealthActivationsToday + 1,
    );
    state = next;
    _prefs.setInt(_kStealthUntil, until.millisecondsSinceEpoch);
    final today = DateTime.now().toIso8601String().substring(0, 10);
    _prefs.setString(_kStealthActDate, today);
    _prefs.setInt(_kStealthActCount, next.stealthActivationsToday);
    try {
      await _api.dio.patch('/users/settings', data: next.toJson());
    } catch (_) {}
    return true;
  }

  void _persist(PrivacySettings s) {
    _prefs.setBool(_kHideDistance, s.hideDistance);
    _prefs.setBool(_kHideOnlineStatus, s.hideOnlineStatus);
    _prefs.setBool(_kHideFromNearby, s.hideFromNearby);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

final privacyProvider =
    StateNotifierProvider<PrivacyNotifier, PrivacySettings>((ref) {
  return PrivacyNotifier(
    ref.watch(apiClientProvider),
    ref.watch(sharedPreferencesProvider),
  );
});
