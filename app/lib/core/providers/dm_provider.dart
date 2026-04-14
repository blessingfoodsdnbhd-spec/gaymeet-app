import 'package:gaymeet/core/providers/auth_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/dm_service.dart';
import '../models/direct_message.dart';

class DmState {
  final List<DirectMessage> inbox;
  final List<DirectMessage> sent;
  final bool isLoading;
  final int unreadCount;

  const DmState({
    this.inbox = const [],
    this.sent = const [],
    this.isLoading = false,
    this.unreadCount = 0,
  });

  DmState copyWith({
    List<DirectMessage>? inbox,
    List<DirectMessage>? sent,
    bool? isLoading,
    int? unreadCount,
  }) =>
      DmState(
        inbox: inbox ?? this.inbox,
        sent: sent ?? this.sent,
        isLoading: isLoading ?? this.isLoading,
        unreadCount: unreadCount ?? this.unreadCount,
      );
}

class DmNotifier extends StateNotifier<DmState> {
  final DmService _service;

  DmNotifier(this._service) : super(const DmState()) {
    fetchInbox();
  }

  Future<void> fetchInbox() async {
    state = state.copyWith(isLoading: true);
    try {
      final inbox = await _service.getInbox();
      final unread = inbox.where((m) => !m.isAccepted).length;
      state = state.copyWith(inbox: inbox, isLoading: false, unreadCount: unread);
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> fetchSent() async {
    try {
      final sent = await _service.getSent();
      state = state.copyWith(sent: sent);
    } catch (_) {}
  }

  Future<bool> send({required String receiverId, required String content}) async {
    try {
      await _service.send(receiverId: receiverId, content: content);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> accept(String id) async {
    try {
      await _service.accept(id);
      final updated = state.inbox.map((m) {
        if (m.id == id) return m.copyWith(isAccepted: true, blurred: false);
        return m;
      }).toList();
      final unread = updated.where((m) => !m.isAccepted).length;
      state = state.copyWith(inbox: updated, unreadCount: unread);
    } catch (_) {}
  }

  Future<bool> reply(String id, String content) async {
    try {
      await _service.reply(id, content);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> delete(String id) async {
    try {
      await _service.delete(id);
      final inbox = state.inbox.where((m) => m.id != id).toList();
      final sent = state.sent.where((m) => m.id != id).toList();
      final unread = inbox.where((m) => !m.isAccepted).length;
      state = state.copyWith(inbox: inbox, sent: sent, unreadCount: unread);
    } catch (_) {}
  }
}

final _dmServiceProvider = Provider<DmService>(
  (ref) => DmService(ref.watch(apiClientProvider)),
);

final dmProvider = StateNotifierProvider<DmNotifier, DmState>(
  (ref) => DmNotifier(ref.watch(_dmServiceProvider)),
);
