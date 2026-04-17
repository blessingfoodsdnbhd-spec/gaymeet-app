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

  ChatNotifier(this._api, this._socket)
      : super(const AsyncValue.data([]));

  void openChat(String matchId, String otherUserId) {
    _currentMatchId = matchId;
    _messageSub?.cancel();
    _messageSub = _socket.onMessage.listen((msg) {
      if (msg.matchId == matchId || _currentMatchId == matchId) {
        state.whenData((messages) {
          state = AsyncValue.data([msg, ...messages]);
        });
      }
    });
    _socket.joinRoom(matchId);
    fetchMessages(matchId, otherUserId);
    _socket.markRead(matchId);
  }

  Future<void> fetchMessages(String matchId, String otherUserId) async {
    state = const AsyncValue.loading();
    try {
      final response = await _api.dio.get('/conversations/$otherUserId/messages');
      final List<dynamic> msgs = response.data['data'] as List<dynamic>;
      final messages = msgs.map((m) => MessageModel.fromJson(m)).toList();
      state = AsyncValue.data(messages);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void sendMessage(String matchId, String content) {
    _socket.sendMessage(matchId, content);
    // Optimistically add the message
    final tempMsg = MessageModel(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      matchId: matchId,
      senderId: 'me',
      content: content,
      type: 'text',
      createdAt: DateTime.now(),
    );
    state.whenData((messages) {
      state = AsyncValue.data([tempMsg, ...messages]);
    });
  }

  void sendSticker(String matchId, String emoji) {
    _socket.sendMessage(matchId, emoji, type: 'sticker');
    final tempMsg = MessageModel(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      matchId: matchId,
      senderId: 'me',
      content: emoji,
      type: 'sticker',
      createdAt: DateTime.now(),
    );
    state.whenData((messages) {
      state = AsyncValue.data([tempMsg, ...messages]);
    });
  }

  void closeChat() {
    _messageSub?.cancel();
    _currentMatchId = null;
    state = const AsyncValue.data([]);
  }

  @override
  void dispose() {
    _messageSub?.cancel();
    super.dispose();
  }
}
