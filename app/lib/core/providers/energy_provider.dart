import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_provider.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class EnergyRecord {
  final String id;
  final String senderNickname;
  final String? senderAvatarUrl;
  final int senderLevel;
  final int amount;
  final DateTime createdAt;

  const EnergyRecord({
    required this.id,
    required this.senderNickname,
    this.senderAvatarUrl,
    required this.senderLevel,
    required this.amount,
    required this.createdAt,
  });

  factory EnergyRecord.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'] as Map<String, dynamic>? ?? {};
    return EnergyRecord(
      id: json['_id'] ?? '',
      senderNickname: sender['nickname'] as String? ?? '?',
      senderAvatarUrl: sender['avatarUrl'] as String?,
      senderLevel: (sender['level'] as num?)?.toInt() ?? 1,
      amount: (json['amount'] as num?)?.toInt() ?? 1,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt']) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

class EnergyState {
  final bool isSending;
  final int sentToday;
  final int freeRemaining;
  final List<EnergyRecord> history;
  final String? error;

  const EnergyState({
    this.isSending = false,
    this.sentToday = 0,
    this.freeRemaining = 3,
    this.history = const [],
    this.error,
  });

  EnergyState copyWith({
    bool? isSending,
    int? sentToday,
    int? freeRemaining,
    List<EnergyRecord>? history,
    String? error,
  }) =>
      EnergyState(
        isSending: isSending ?? this.isSending,
        sentToday: sentToday ?? this.sentToday,
        freeRemaining: freeRemaining ?? this.freeRemaining,
        history: history ?? this.history,
        error: error,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class EnergyNotifier extends StateNotifier<EnergyState> {
  final Ref _ref;

  EnergyNotifier(this._ref) : super(const EnergyState());

  /// Send energy to [receiverId]. Returns null on success, error string on failure.
  Future<String?> sendEnergy(String receiverId) async {
    state = state.copyWith(isSending: true, error: null);
    try {
      final api = _ref.read(apiClientProvider);
      final res = await api.dio.post('/energy/send', data: {'receiverId': receiverId});
      final data = res.data['data'] as Map<String, dynamic>;

      state = state.copyWith(
        isSending: false,
        sentToday: (data['senderSentToday'] as num?)?.toInt() ?? state.sentToday + 1,
        freeRemaining: state.freeRemaining > 0 ? state.freeRemaining - 1 : 0,
      );

      return null;
    } catch (e) {
      final msg = _extractError(e);
      state = state.copyWith(isSending: false, error: msg);
      return msg;
    }
  }

  Future<void> fetchSentToday() async {
    try {
      final api = _ref.read(apiClientProvider);
      final res = await api.dio.get('/energy/sent');
      final data = res.data['data'] as Map<String, dynamic>;
      state = state.copyWith(
        sentToday: (data['sentToday'] as num?)?.toInt() ?? 0,
        freeRemaining: (data['freeRemaining'] as num?)?.toInt() ?? 3,
      );
    } catch (_) {}
  }

  Future<void> fetchHistory() async {
    try {
      final api = _ref.read(apiClientProvider);
      final res = await api.dio.get('/energy/history');
      final data = res.data['data'] as Map<String, dynamic>;
      final records = (data['records'] as List)
          .map((r) => EnergyRecord.fromJson(r as Map<String, dynamic>))
          .toList();
      state = state.copyWith(history: records);
    } catch (_) {}
  }

  String _extractError(Object e) {
    try {
      // Dio errors carry a response message
      final dynamic err = e;
      final msg = err?.response?.data?['error'] as String?;
      return msg ?? e.toString();
    } catch (_) {
      return e.toString();
    }
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

final energyProvider =
    StateNotifierProvider<EnergyNotifier, EnergyState>((ref) {
  return EnergyNotifier(ref);
});
