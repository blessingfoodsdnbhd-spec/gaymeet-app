import 'package:gaymeet/core/providers/auth_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../dummy/dummy_data.dart';
import '../models/user.dart';

final likesProvider =
    StateNotifierProvider<LikesNotifier, AsyncValue<List<UserModel>>>((ref) {
  return LikesNotifier(ref.watch(apiClientProvider));
});

class LikesNotifier extends StateNotifier<AsyncValue<List<UserModel>>> {
  final ApiClient _api;

  LikesNotifier(this._api) : super(const AsyncValue.loading());

  Future<void> fetchLikes() async {
    state = const AsyncValue.loading();
    if (kUseDummyData) {
      await Future.delayed(const Duration(milliseconds: 300));
      // Return all dummy users as "people who liked you"
      state = AsyncValue.data(List.from(DummyData.users));
      return;
    }
    try {
      final resp = await _api.dio.get('/users/likes');
      final List<dynamic> data = resp.data['data'];
      state = AsyncValue.data(data.map((u) => UserModel.fromJson(u)).toList());
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  /// Like back or pass on a user who liked you.
  /// Returns true when it's a mutual match.
  Future<bool> swipe(String userId, String direction) async {
    // Optimistically remove from local list immediately
    state.whenData((users) {
      state = AsyncValue.data(users.where((u) => u.id != userId).toList());
    });

    if (kUseDummyData) return direction == 'like';

    try {
      final resp = await _api.dio.post('/swipes', data: {
        'targetUserId': userId,
        'direction': direction,
      });
      return resp.data['data']['isMatch'] == true;
    } catch (_) {
      return false;
    }
  }
}
