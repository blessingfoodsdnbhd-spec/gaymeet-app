import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'privacy_provider.dart'; // re-uses sharedPreferencesProvider

// ── Prefs keys ────────────────────────────────────────────────────────────────

const _kFirstMsgDate = 'chat_firstmsg_date';
const _kFirstMsgCount = 'chat_firstmsg_count';

/// Free users can START this many new conversations per day.
/// (Replying to existing conversations is always unlimited.)
const int kFreeFirstMessagesPerDay = 3;

// ── State ─────────────────────────────────────────────────────────────────────

class ChatLimitState {
  final int firstMessagesToday;

  const ChatLimitState({this.firstMessagesToday = 0});

  bool get canStartNewConversation =>
      firstMessagesToday < kFreeFirstMessagesPerDay;

  int get remaining =>
      (kFreeFirstMessagesPerDay - firstMessagesToday).clamp(0, kFreeFirstMessagesPerDay);
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class ChatLimitNotifier extends StateNotifier<ChatLimitState> {
  final SharedPreferences _prefs;

  ChatLimitNotifier(this._prefs) : super(const ChatLimitState()) {
    _seedFromPrefs();
  }

  void _seedFromPrefs() {
    final savedDate = _prefs.getString(_kFirstMsgDate);
    final today = _todayStr();
    final count = savedDate == today ? (_prefs.getInt(_kFirstMsgCount) ?? 0) : 0;
    state = ChatLimitState(firstMessagesToday: count);
  }

  /// Call this once when a free user sends their very first message
  /// in a previously-empty conversation.
  void recordFirstMessage() {
    final newCount = state.firstMessagesToday + 1;
    state = ChatLimitState(firstMessagesToday: newCount);
    _prefs.setString(_kFirstMsgDate, _todayStr());
    _prefs.setInt(_kFirstMsgCount, newCount);
  }

  String _todayStr() => DateTime.now().toIso8601String().substring(0, 10);
}

// ── Provider ──────────────────────────────────────────────────────────────────

final chatLimitProvider =
    StateNotifierProvider<ChatLimitNotifier, ChatLimitState>((ref) {
  return ChatLimitNotifier(ref.watch(sharedPreferencesProvider));
});
