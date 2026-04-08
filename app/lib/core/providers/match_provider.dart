import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/match.dart';
import 'auth_provider.dart';

final matchesProvider =
    StateNotifierProvider<MatchesNotifier, AsyncValue<List<MatchModel>>>((ref) {
  return MatchesNotifier(ref.watch(apiClientProvider));
});

class MatchesNotifier extends StateNotifier<AsyncValue<List<MatchModel>>> {
  final ApiClient _api;

  MatchesNotifier(this._api) : super(const AsyncValue.loading());

  Future<void> fetchMatches() async {
    state = const AsyncValue.loading();
    try {
      final response = await _api.dio.get('/matches');
      final List<dynamic> data = response.data['data'];
      final matches = data.map((m) => MatchModel.fromJson(m)).toList();
      state = AsyncValue.data(matches);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<Map<String, dynamic>?> swipe(
      String targetUserId, String direction) async {
    try {
      final response = await _api.dio.post('/swipes', data: {
        'targetUserId': targetUserId,
        'direction': direction,
      });
      final data = response.data['data'];
      if (data['isMatch'] == true) {
        await fetchMatches();
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  Future<void> unmatch(String matchId) async {
    try {
      await _api.dio.delete('/matches/$matchId');
      await fetchMatches();
    } catch (_) {}
  }

  /// Immediately remove a match from the local list by the other user's id.
  /// Call this after block or unmatch for instant UI feedback before the
  /// next fetchMatches() completes.
  void removeMatchByUserId(String userId) {
    state.whenData((matches) {
      state = AsyncValue.data(
        matches.where((m) => m.user.id != userId).toList(),
      );
    });
  }
}
