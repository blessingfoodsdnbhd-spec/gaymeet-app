import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/socket_service.dart';
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
  return ConversationsNotifier(
    ref.watch(apiClientProvider),
    ref.watch(socketServiceProvider),
    ref,
  );
});

class ConversationsNotifier
    extends StateNotifier<AsyncValue<List<MatchModel>>> {
  final ApiClient _api;
  final SocketService _socket;
  final Ref _ref;
  StreamSubscription? _msgSub;

  ConversationsNotifier(this._api, this._socket, this._ref)
      : super(const AsyncValue.loading()) {
    fetchConversations();
    _msgSub = _socket.onMessage.listen((msg) {
      state.whenData((list) {
        final idx = list.indexWhere((c) => c.matchId == msg.matchId);
        if (idx == -1) return;
        final myId = _ref.read(authStateProvider).user?.id;
        final isIncoming = msg.senderId != myId;
        final updated = List<MatchModel>.from(list);
        updated[idx] = MatchModel(
          matchId: list[idx].matchId,
          matchedAt: list[idx].matchedAt,
          user: list[idx].user,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: isIncoming
              ? list[idx].unreadCount + 1
              : list[idx].unreadCount,
        );
        // Re-sort so most-recent stays at the top
        updated.sort((a, b) {
          final ta = a.lastMessageAt ?? a.matchedAt;
          final tb = b.lastMessageAt ?? b.matchedAt;
          return tb.compareTo(ta);
        });
        state = AsyncValue.data(updated);
      });
    });
  }

  @override
  void dispose() {
    _msgSub?.cancel();
    super.dispose();
  }

  Future<void> fetchConversations({bool retry = true}) async {
    state = const AsyncValue.loading();
    try {
      final response = await _api.dio.get('/conversations');
      final List<dynamic> data = response.data['data'];
      final conversations = data
          .where((m) => m['user'] != null)
          .map((m) => MatchModel.fromJson(m))
          .toList();
      state = AsyncValue.data(conversations);
    } catch (e, st) {
      if (retry) {
        // One automatic retry after 3 s — handles Render cold-start timeouts
        await Future.delayed(const Duration(seconds: 3));
        return fetchConversations(retry: false);
      }
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

  void markRead(String matchId) {
    state.whenData((list) {
      final idx = list.indexWhere((c) => c.matchId == matchId);
      if (idx == -1) return;
      if (list[idx].unreadCount == 0) return;
      final updated = List<MatchModel>.from(list);
      updated[idx] = MatchModel(
        matchId: list[idx].matchId,
        matchedAt: list[idx].matchedAt,
        user: list[idx].user,
        lastMessage: list[idx].lastMessage,
        lastMessageAt: list[idx].lastMessageAt,
        unreadCount: 0,
      );
      state = AsyncValue.data(updated);
    });
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
