import 'package:gaymeet/core/providers/auth_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/secret_code_service.dart';

enum SecretCodeStatus { idle, waiting, matched }

class SecretCodeState {
  final SecretCodeStatus status;
  final String? activeCode;
  final String? activeCodeId;
  final DateTime? expiresAt;
  final Map<String, dynamic>? matchedUser;
  final String? matchId;
  final List<Map<String, dynamic>> history;
  final bool isLoading;
  final String? error;

  const SecretCodeState({
    this.status = SecretCodeStatus.idle,
    this.activeCode,
    this.activeCodeId,
    this.expiresAt,
    this.matchedUser,
    this.matchId,
    this.history = const [],
    this.isLoading = false,
    this.error,
  });

  SecretCodeState copyWith({
    SecretCodeStatus? status,
    String? activeCode,
    String? activeCodeId,
    DateTime? expiresAt,
    Map<String, dynamic>? matchedUser,
    String? matchId,
    List<Map<String, dynamic>>? history,
    bool? isLoading,
    String? error,
  }) =>
      SecretCodeState(
        status: status ?? this.status,
        activeCode: activeCode ?? this.activeCode,
        activeCodeId: activeCodeId ?? this.activeCodeId,
        expiresAt: expiresAt ?? this.expiresAt,
        matchedUser: matchedUser ?? this.matchedUser,
        matchId: matchId ?? this.matchId,
        history: history ?? this.history,
        isLoading: isLoading ?? this.isLoading,
        error: error ?? this.error,
      );
}

class SecretCodeNotifier extends StateNotifier<SecretCodeState> {
  final SecretCodeService _service;

  SecretCodeNotifier(this._service) : super(const SecretCodeState()) {
    _loadActive();
  }

  Future<void> _loadActive() async {
    try {
      final active = await _service.getActiveCode();
      if (active != null) {
        state = state.copyWith(
          status: SecretCodeStatus.waiting,
          activeCode: active['code'] as String?,
          activeCodeId: active['_id'] as String?,
          expiresAt: active['expiresAt'] != null
              ? DateTime.tryParse(active['expiresAt'] as String)
              : null,
        );
      }
      _loadHistory();
    } catch (_) {}
  }

  Future<void> _loadHistory() async {
    try {
      final history = await _service.getHistory();
      state = state.copyWith(history: history);
    } catch (_) {}
  }

  Future<void> submitCode(String code) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final result = await _service.setCode(code);
      if (result['matched'] == true) {
        state = state.copyWith(
          status: SecretCodeStatus.matched,
          matchedUser: result['matchedUser'] as Map<String, dynamic>?,
          matchId: result['matchId'] as String?,
          isLoading: false,
          activeCode: null,
        );
      } else {
        state = state.copyWith(
          status: SecretCodeStatus.waiting,
          activeCode: result['code'] as String?,
          activeCodeId: result['codeId'] as String?,
          expiresAt: result['expiresAt'] != null
              ? DateTime.tryParse(result['expiresAt'] as String)
              : null,
          isLoading: false,
        );
      }
      _loadHistory();
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> cancelCode() async {
    try {
      await _service.cancelActiveCode();
      state = state.copyWith(
        status: SecretCodeStatus.idle,
        activeCode: null,
        activeCodeId: null,
        expiresAt: null,
      );
    } catch (_) {}
  }

  void resetMatch() {
    state = state.copyWith(
      status: SecretCodeStatus.idle,
      matchedUser: null,
      matchId: null,
    );
  }
}

final _secretCodeServiceProvider = Provider<SecretCodeService>(
  (ref) => SecretCodeService(ref.watch(apiClientProvider)),
);

final secretCodeProvider =
    StateNotifierProvider<SecretCodeNotifier, SecretCodeState>(
  (ref) => SecretCodeNotifier(ref.watch(_secretCodeServiceProvider)),
);
