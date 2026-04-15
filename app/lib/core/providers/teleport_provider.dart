import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'privacy_provider.dart'; // re-uses sharedPreferencesProvider
import '../api/api_client.dart';
import 'auth_provider.dart';    // for apiClientProvider

// ── Prefs keys ────────────────────────────────────────────────────────────────

const _kTeleportActive = 'teleport_active';
const _kTeleportLat = 'teleport_lat';
const _kTeleportLng = 'teleport_lng';
const _kTeleportCity = 'teleport_city';

// ── State ─────────────────────────────────────────────────────────────────────

class TeleportState {
  final bool isActive;
  final double? virtualLat;
  final double? virtualLng;
  final String? cityName;

  const TeleportState({
    this.isActive = false,
    this.virtualLat,
    this.virtualLng,
    this.cityName,
  });

  TeleportState copyWith({
    bool? isActive,
    double? virtualLat,
    double? virtualLng,
    String? cityName,
    bool clear = false,
  }) =>
      TeleportState(
        isActive: isActive ?? this.isActive,
        virtualLat: clear ? null : (virtualLat ?? this.virtualLat),
        virtualLng: clear ? null : (virtualLng ?? this.virtualLng),
        cityName: clear ? null : (cityName ?? this.cityName),
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class TeleportNotifier extends StateNotifier<TeleportState> {
  final SharedPreferences _prefs;
  final ApiClient _api;

  TeleportNotifier(this._prefs, this._api) : super(const TeleportState()) {
    _seed();
  }

  void _seed() {
    final active = _prefs.getBool(_kTeleportActive) ?? false;
    if (!active) return;
    state = TeleportState(
      isActive: true,
      virtualLat: _prefs.getDouble(_kTeleportLat),
      virtualLng: _prefs.getDouble(_kTeleportLng),
      cityName: _prefs.getString(_kTeleportCity),
    );
  }

  /// Activate teleport to the given coordinates + city label.
  /// Updates local state immediately, then persists to server.
  Future<void> activate(double lat, double lng, String cityName) async {
    state = TeleportState(
      isActive: true,
      virtualLat: lat,
      virtualLng: lng,
      cityName: cityName,
    );
    _prefs.setBool(_kTeleportActive, true);
    _prefs.setDouble(_kTeleportLat, lat);
    _prefs.setDouble(_kTeleportLng, lng);
    _prefs.setString(_kTeleportCity, cityName);

    // Persist virtual location to server so nearby/discover queries use it
    try {
      await _api.dio.post('/users/me/teleport', data: {
        'latitude': lat,
        'longitude': lng,
        'label': cityName,
      });
    } catch (_) {
      // Best-effort — local state is already updated
    }
  }

  /// Deactivate and revert to real GPS.
  Future<void> deactivate() async {
    state = const TeleportState();
    _prefs.setBool(_kTeleportActive, false);
    _prefs.remove(_kTeleportLat);
    _prefs.remove(_kTeleportLng);
    _prefs.remove(_kTeleportCity);

    // Clear virtual location on server
    try {
      await _api.dio.delete('/users/me/teleport');
    } catch (_) {}
  }
}

final teleportProvider =
    StateNotifierProvider<TeleportNotifier, TeleportState>((ref) {
  return TeleportNotifier(
    ref.watch(sharedPreferencesProvider),
    ref.watch(apiClientProvider),
  );
});
