import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/shout_service.dart';
import '../dummy/dummy_data.dart';
import '../models/shout.dart';
import 'privacy_provider.dart';

// ── Config ────────────────────────────────────────────────────────────────────

const bool kUseDummyData = true;

// ── Providers ─────────────────────────────────────────────────────────────────

final _apiClientProvider = Provider((ref) => ApiClient());

final shoutServiceProvider = Provider(
  (ref) => ShoutService(ref.read(_apiClientProvider)),
);

// ── State ─────────────────────────────────────────────────────────────────────

class ShoutState {
  final List<ShoutModel> shouts;
  final ShoutModel? myShout;
  final bool isLoading;
  final String? error;

  const ShoutState({
    this.shouts = const [],
    this.myShout,
    this.isLoading = false,
    this.error,
  });

  ShoutState copyWith({
    List<ShoutModel>? shouts,
    ShoutModel? myShout,
    bool clearMyShout = false,
    bool? isLoading,
    String? error,
  }) =>
      ShoutState(
        shouts: shouts ?? this.shouts,
        myShout: clearMyShout ? null : (myShout ?? this.myShout),
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class ShoutNotifier extends StateNotifier<ShoutState> {
  final ShoutService _service;

  ShoutNotifier(this._service) : super(const ShoutState()) {
    fetchShouts();
  }

  Future<void> fetchShouts() async {
    state = state.copyWith(isLoading: true);
    try {
      if (kUseDummyData) {
        await Future.delayed(const Duration(milliseconds: 400));
        state = state.copyWith(
          shouts: DummyData.shouts,
          isLoading: false,
        );
        return;
      }
      final shouts = await _service.getNearbyShouts();
      final myShout = await _service.getMyShout();
      state = state.copyWith(shouts: shouts, myShout: myShout, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> postShout(String content) async {
    if (kUseDummyData) {
      state = state.copyWith(isLoading: false);
      return;
    }
    final shout = await _service.postShout(content);
    state = state.copyWith(myShout: shout);
    await fetchShouts();
  }

  Future<void> deleteShout() async {
    if (kUseDummyData) return;
    await _service.deleteShout();
    state = state.copyWith(clearMyShout: true);
    await fetchShouts();
  }
}

final shoutProvider = StateNotifierProvider<ShoutNotifier, ShoutState>(
  (ref) => ShoutNotifier(ref.read(shoutServiceProvider)),
);
