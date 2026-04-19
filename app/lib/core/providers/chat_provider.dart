import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/socket_service.dart';
import '../models/message.dart';
import 'auth_provider.dart';

final chatProvider =
    StateNotifierProvider<ChatNotifier, AsyncValue<List<MessageModel>>>((ref) {
  return ChatNotifier(
    ref.watch(apiClientProvider),
    ref.watch(socketServiceProvider),
  );
});

class ChatNotifier extends StateNotifier<AsyncValue<List<MessageModel>>> {
  final ApiClient _api;
  final SocketService _socket;
  StreamSubscription? _messageSub;
  String? _currentMatchId;
  // Tracks real IDs already in the list; temp IDs use a "temp:" prefix.
  final Set<String> _seenIds = {};

  ChatNotifier(this._api, this._socket)
      : super(const AsyncValue.data([]));

  void openChat(String matchId, String otherUserId) {
    _currentMatchId = matchId;
    _seenIds.clear();
    _messageSub?.cancel();
    state = const AsyncValue.data([]); // clear previous chat's messages immediately
    _messageSub = _socket.onMessage.listen((msg) {
      if (msg.matchId != matchId) return;
      if (_seenIds.contains(msg.id)) return; // already present
      _seenIds.add(msg.id);
      state.whenData((messages) {
        // If we have an optimistic temp message with the same content+type,
        // replace it with the real message instead of prepending a duplicate.
        final tempIdx = messages.indexWhere(
          (m) => m.id.startsWith('temp:') && m.content == msg.content && m.type == msg.type,
        );
        if (tempIdx != -1) {
          final updated = List<MessageModel>.from(messages);
          updated[tempIdx] = msg;
          state = AsyncValue.data(updated);
        } else {
          state = AsyncValue.data([msg, ...messages]);
        }
      });
    });
    _socket.joinRoom(matchId);
    fetchMessages(matchId, otherUserId);
    _socket.markRead(matchId);
  }

  Future<void> fetchMessages(String matchId, String otherUserId) async {
    final existing = state.valueOrNull ?? [];
    state = const AsyncValue.loading();
    try {
      final response = await _api.dio.get('/conversations/$otherUserId/messages');
      // Discard if the user navigated away while the request was in flight
      if (_currentMatchId != matchId) return;
      final List<dynamic> raw = response.data['data'] as List<dynamic>;
      // API returns ascending (oldest first); reverse to newest-first so
      // index 0 = newest = bottom with ListView(reverse: true).
      final httpMessages = raw.map((m) => MessageModel.fromJson(m)).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      for (final m in httpMessages) {
        _seenIds.add(m.id);
      }
      final httpIds = httpMessages.map((m) => m.id).toSet();
      // Preserve socket messages that arrived during the HTTP load,
      // but only for THIS conversation — never bleed in a previous chat's messages.
      final extra = existing
          .where((m) =>
              !httpIds.contains(m.id) &&
              !m.id.startsWith('temp:') &&
              m.matchId == matchId)
          .toList();
      state = AsyncValue.data([...extra, ...httpMessages]);
    } catch (e, st) {
      if (_currentMatchId != matchId) return;
      state = AsyncValue.error(e, st);
    }
  }

  void _addOptimistic(MessageModel msg) {
    _seenIds.add(msg.id);
    state.whenData((messages) {
      state = AsyncValue.data([msg, ...messages]);
    });
  }

  void sendMessage(String matchId, String content) {
    _addOptimistic(MessageModel(
      id: 'temp:${DateTime.now().millisecondsSinceEpoch}',
      matchId: matchId,
      senderId: 'me',
      content: content,
      type: 'text',
      createdAt: DateTime.now(),
    ));
    if (_socket.isConnected) {
      _socket.sendMessage(matchId, content);
    } else {
      _sendViaHttp(matchId, content, 'text');
    }
  }

  void sendSticker(String matchId, String emoji) {
    _addOptimistic(MessageModel(
      id: 'temp:${DateTime.now().millisecondsSinceEpoch}',
      matchId: matchId,
      senderId: 'me',
      content: emoji,
      type: 'sticker',
      createdAt: DateTime.now(),
    ));
    if (_socket.isConnected) {
      _socket.sendMessage(matchId, emoji, type: 'sticker');
    } else {
      _sendViaHttp(matchId, emoji, 'sticker');
    }
  }

  Future<void> _sendViaHttp(String matchId, String content, String type) async {
    try {
      await _api.dio.post(
        '/conversations/$matchId/send',
        data: {'content': content, 'type': type},
      );
    } catch (_) {}
  }

  void closeChat() {
    _messageSub?.cancel();
    _currentMatchId = null;
    _seenIds.clear();
    state = const AsyncValue.data([]);
  }

  @override
  void dispose() {
    _messageSub?.cancel();
    super.dispose();
  }
}
