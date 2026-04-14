import 'package:gaymeet/core/providers/auth_provider.dart';
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/groups_service.dart';
import '../api/socket_service.dart';
import '../models/group_chat.dart';

// ── Groups list state ─────────────────────────────────────────────────────────

class GroupsState {
  final List<GroupChat> discoverGroups;
  final List<GroupChat> myGroups;
  final bool isLoading;
  final String? error;

  const GroupsState({
    this.discoverGroups = const [],
    this.myGroups = const [],
    this.isLoading = false,
    this.error,
  });

  GroupsState copyWith({
    List<GroupChat>? discoverGroups,
    List<GroupChat>? myGroups,
    bool? isLoading,
    String? error,
  }) =>
      GroupsState(
        discoverGroups: discoverGroups ?? this.discoverGroups,
        myGroups: myGroups ?? this.myGroups,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

class GroupsNotifier extends StateNotifier<GroupsState> {
  final GroupsService _service;

  GroupsNotifier(this._service) : super(const GroupsState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final discover = await _service.getGroups(tab: 'discover');
      final mine = await _service.getGroups(tab: 'mine');
      state = state.copyWith(
        discoverGroups: discover,
        myGroups: mine,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<GroupChat?> createGroup({
    required String name,
    String description = '',
    bool isPublic = true,
  }) async {
    try {
      final group = await _service.createGroup(
        name: name,
        description: description,
        isPublic: isPublic,
      );
      state = state.copyWith(
        myGroups: [group, ...state.myGroups],
      );
      return group;
    } catch (_) {
      return null;
    }
  }

  Future<bool> joinGroup(String groupId) async {
    try {
      await _service.joinGroup(groupId);
      // Update the group in discoverGroups to show as member
      state = state.copyWith(
        discoverGroups: state.discoverGroups.map((g) {
          if (g.id != groupId) return g;
          return g.copyWith(
              isMember: true, memberCount: g.memberCount + 1);
        }).toList(),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> leaveGroup(String groupId) async {
    try {
      await _service.leaveGroup(groupId);
      state = state.copyWith(
        myGroups: state.myGroups.where((g) => g.id != groupId).toList(),
        discoverGroups: state.discoverGroups.map((g) {
          if (g.id != groupId) return g;
          return g.copyWith(
              isMember: false, memberCount: g.memberCount - 1);
        }).toList(),
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ── Group chat messages state ─────────────────────────────────────────────────

class GroupChatState {
  final List<GroupMessage> messages;
  final bool isLoading;
  final bool isSending;

  const GroupChatState({
    this.messages = const [],
    this.isLoading = false,
    this.isSending = false,
  });

  GroupChatState copyWith({
    List<GroupMessage>? messages,
    bool? isLoading,
    bool? isSending,
  }) =>
      GroupChatState(
        messages: messages ?? this.messages,
        isLoading: isLoading ?? this.isLoading,
        isSending: isSending ?? this.isSending,
      );
}

class GroupChatNotifier extends StateNotifier<GroupChatState> {
  final GroupsService _service;
  final SocketService _socket;
  final String _groupId;
  StreamSubscription? _sub;

  GroupChatNotifier(this._service, this._socket, this._groupId)
      : super(const GroupChatState()) {
    _loadMessages();
    _socket.joinGroupRoom(_groupId);
    _sub = _socket.onGroupMessage.listen(_onIncoming);
  }

  @override
  void dispose() {
    _sub?.cancel();
    _socket.leaveGroupRoom(_groupId);
    super.dispose();
  }

  void _onIncoming(GroupMessage msg) {
    if (msg.groupId != _groupId) return;
    state = state.copyWith(messages: [...state.messages, msg]);
  }

  Future<void> _loadMessages() async {
    state = state.copyWith(isLoading: true);
    try {
      final msgs = await _service.getMessages(_groupId);
      state = state.copyWith(messages: msgs, isLoading: false);
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  void sendMessage(String content) {
    if (content.trim().isEmpty) return;
    _socket.sendGroupMessage(_groupId, content);
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

final _groupsServiceProvider = Provider<GroupsService>(
  (ref) => GroupsService(ref.watch(apiClientProvider)),
);

final groupsProvider =
    StateNotifierProvider<GroupsNotifier, GroupsState>((ref) {
  return GroupsNotifier(ref.watch(_groupsServiceProvider));
});

final groupChatProvider =
    StateNotifierProvider.family<GroupChatNotifier, GroupChatState, String>(
  (ref, groupId) => GroupChatNotifier(
    ref.watch(_groupsServiceProvider),
    ref.watch(socketServiceProvider),
    groupId,
  ),
);
