import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/match.dart';
import 'auth_provider.dart';

// ── Result type for opening a conversation ─────────────────────────────────────

class OpenConversationResult {
  final String matchId;
  final int coinsCharged;

  const OpenConversationResult({
    required this.matchId,
    required this.coinsCharged,
  });

  factory OpenConversationResult.fromJson(Map<String, dynamic> json) {
    return OpenConversationResult(
      matchId: json['matchId'] as String,
      coinsCharged: json['coinsCharged'] as int? ?? 0,
    );
  }
}

// ── Conversations provider ─────────────────────────────────────────────────────

final conversationsProvider = StateNotifierProvider<ConversationsNotifier,
    AsyncValue<List<MatchModel>>>((ref) {
  return ConversationsNotifier(ref.watch(apiClientProvider));
});

class ConversationsNotifier
    extends StateNotifier<AsyncValue<List<MatchModel>>> {
  final ApiClient _api;

  ConversationsNotifier(this._api) : super(const AsyncValue.loading()) {
    fetchConversations();
  }

  Future<void> fetchConversations() async {
    state = const AsyncValue.loading();
    try {
      final response = await _api.dio.get('/conversations');
      final List<dynamic> data = response.data['data'];
      final conversations = data.map((m) => MatchModel.fromJson(m)).toList();
      state = AsyncValue.data(conversations);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<OpenConversationResult> openConversation(String targetUserId) async {
    final response =
        await _api.dio.post('/conversations/open/$targetUserId');
    final result =
        OpenConversationResult.fromJson(response.data['data']);
    await fetchConversations();
    return result;
  }

  /// Optimistically remove a conversation by the other user's id.
  void removeByUserId(String userId) {
    state.whenData((list) {
      state = AsyncValue.data(
        list.where((c) => c.user.id != userId).toList(),
      );
    });
  }
}
