import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/safe_date_service.dart';
import '../api/api_client.dart';
import '../models/safe_date.dart';

class SafeDateState {
  final SafeDate? session;
  final bool isLoading;
  final bool isPanicking;
  final String? error;

  const SafeDateState({
    this.session,
    this.isLoading = false,
    this.isPanicking = false,
    this.error,
  });

  bool get isActive => session?.isActive == true;

  SafeDateState copyWith({
    SafeDate? session,
    bool? isLoading,
    bool? isPanicking,
    String? error,
    bool clearSession = false,
  }) =>
      SafeDateState(
        session: clearSession ? null : (session ?? this.session),
        isLoading: isLoading ?? this.isLoading,
        isPanicking: isPanicking ?? this.isPanicking,
        error: error,
      );
}

class SafeDateNotifier extends StateNotifier<SafeDateState> {
  final SafeDateService _service;

  SafeDateNotifier(this._service) : super(const SafeDateState()) {
    loadActive();
  }

  Future<void> loadActive() async {
    state = state.copyWith(isLoading: true);
    try {
      final session = await _service.getActive();
      state = state.copyWith(
        session: session,
        isLoading: false,
        clearSession: session == null,
      );
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<bool> startSession({
    required List<String> trustedContactIds,
    required String meetingWith,
    required String venue,
    DateTime? expectedEndTime,
  }) async {
    state = state.copyWith(isLoading: true);
    try {
      final session = await _service.start(
        trustedContactIds: trustedContactIds,
        meetingWith: meetingWith,
        venue: venue,
        expectedEndTime: expectedEndTime,
      );
      state = state.copyWith(session: session, isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }

  Future<void> updateLocation(double lat, double lng) async {
    try {
      final session = await _service.updateLocation(lat, lng);
      state = state.copyWith(session: session);
    } catch (_) {}
  }

  Future<bool> triggerPanic({double? lat, double? lng}) async {
    state = state.copyWith(isPanicking: true);
    try {
      await _service.panic(lat: lat, lng: lng);
      // Refresh session to get updated panicTriggered state
      final session = await _service.getActive();
      state = state.copyWith(session: session, isPanicking: false);
      return true;
    } catch (e) {
      state = state.copyWith(isPanicking: false, error: e.toString());
      return false;
    }
  }

  Future<bool> endSession() async {
    state = state.copyWith(isLoading: true);
    try {
      await _service.end();
      state = state.copyWith(clearSession: true, isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

final _safeDateServiceProvider = Provider<SafeDateService>(
  (ref) => SafeDateService(ref.watch(apiClientProvider)),
);

final safeDateProvider =
    StateNotifierProvider<SafeDateNotifier, SafeDateState>((ref) {
  return SafeDateNotifier(ref.watch(_safeDateServiceProvider));
});
