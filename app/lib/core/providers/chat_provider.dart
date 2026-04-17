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
    state = const AsyncValue.loading();
    try {
      final response = await _api.dio.get('/conversations/$otherUserId/messages');
      final List<dynamic> raw = response.data['data'] as List<dynamic>;
      final messages = raw.map((m) => MessageModel.fromJson(m)).toList();
      for (final m in messages) {
        _seenIds.add(m.id);
      }
      state = AsyncValue.data(messages);
    } catch (e, st) {
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
    _socket.sendMessage(matchId, content);
    _addOptimistic(MessageModel(
      id: 'temp:${DateTime.now().millisecondsSinceEpoch}',
      matchId: matchId,
      senderId: 'me',
      content: content,
      type: 'text',
      createdAt: DateTime.now(),
    ));
  }

  void sendSticker(String matchId, String emoji) {
    _socket.sendMessage(matchId, emoji, type: 'sticker');
    _addOptimistic(MessageModel(
      id: 'temp:${DateTime.now().millisecondsSinceEpoch}',
      matchId: matchId,
      senderId: 'me',
      content: emoji,
      type: 'sticker',
      createdAt: DateTime.now(),
    ));
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
