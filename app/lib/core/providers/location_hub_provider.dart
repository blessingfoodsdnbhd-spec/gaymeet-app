import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/location_service.dart';
import 'shout_provider.dart'; // re-uses kUseDummyData

// ── Provider ──────────────────────────────────────────────────────────────────

final _locationApiClientProvider = Provider((ref) => ApiClient());

final locationServiceProvider = Provider(
  (ref) => LocationService(ref.read(_locationApiClientProvider)),
);

// ── State ─────────────────────────────────────────────────────────────────────

class LocationHubState {
  final bool stealthMode;
  final double? virtualLat;
  final double? virtualLng;
  final String? virtualLocationLabel;
  final bool isLoading;
  final String? error;

  const LocationHubState({
    this.stealthMode = false,
    this.virtualLat,
    this.virtualLng,
    this.virtualLocationLabel,
    this.isLoading = false,
    this.error,
  });

  bool get hasVirtualLocation => virtualLat != null && virtualLng != null;

  LocationHubState copyWith({
    bool? stealthMode,
    double? virtualLat,
    double? virtualLng,
    String? virtualLocationLabel,
    bool clearVirtual = false,
    bool? isLoading,
    String? error,
  }) =>
      LocationHubState(
        stealthMode: stealthMode ?? this.stealthMode,
        virtualLat: clearVirtual ? null : (virtualLat ?? this.virtualLat),
        virtualLng: clearVirtual ? null : (virtualLng ?? this.virtualLng),
        virtualLocationLabel: clearVirtual
            ? null
            : (virtualLocationLabel ?? this.virtualLocationLabel),
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class LocationHubNotifier extends StateNotifier<LocationHubState> {
  final LocationService _service;

  LocationHubNotifier(this._service) : super(const LocationHubState());

  Future<void> toggleStealth(bool enabled) async {
    state = state.copyWith(stealthMode: enabled);
    if (!kUseDummyData) {
      try {
        await _service.setStealthMode(enabled);
      } catch (_) {
        // revert on error
        state = state.copyWith(stealthMode: !enabled);
      }
    }
  }

  Future<void> setVirtualLocation(
    double lat,
    double lng, {
    String? label,
  }) async {
    state = state.copyWith(
      virtualLat: lat,
      virtualLng: lng,
      virtualLocationLabel: label,
    );
    if (!kUseDummyData) {
      try {
        await _service.setVirtualLocation(lat, lng, label: label);
      } catch (e) {
        state = state.copyWith(error: e.toString());
      }
    }
  }

  Future<void> clearVirtualLocation() async {
    state = state.copyWith(clearVirtual: true);
    if (!kUseDummyData) {
      try {
        await _service.clearVirtualLocation();
      } catch (e) {
        state = state.copyWith(error: e.toString());
      }
    }
  }
}

final locationHubProvider =
    StateNotifierProvider<LocationHubNotifier, LocationHubState>(
  (ref) => LocationHubNotifier(ref.read(locationServiceProvider)),
);
