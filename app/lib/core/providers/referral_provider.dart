import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/referral_service.dart';
import 'auth_provider.dart';

// ── Service provider ──────────────────────────────────────────────────────────

final referralServiceProvider = Provider<ReferralService>((ref) {
  return ReferralService(ref.watch(apiClientProvider));
});

// ── State ─────────────────────────────────────────────────────────────────────

class ReferralState {
  final bool isLoading;
  final String? error;

  // Code
  final String myCode;
  final String shareLink;
  final String shareMessage;

  // Stats
  final int referralCount;
  final double totalEarned;
  final double pendingAmount;
  final double walletBalance;
  final double totalWithdrawn;

  // Lists
  final List<ReferralEntry> referralList;
  final List<WalletTransaction> transactions;
  final List<WithdrawalRecord> withdrawalHistory;

  const ReferralState({
    this.isLoading = false,
    this.error,
    this.myCode = '',
    this.shareLink = '',
    this.shareMessage = '',
    this.referralCount = 0,
    this.totalEarned = 0,
    this.pendingAmount = 0,
    this.walletBalance = 0,
    this.totalWithdrawn = 0,
    this.referralList = const [],
    this.transactions = const [],
    this.withdrawalHistory = const [],
  });

  ReferralState copyWith({
    bool? isLoading,
    String? error,
    String? myCode,
    String? shareLink,
    String? shareMessage,
    int? referralCount,
    double? totalEarned,
    double? pendingAmount,
    double? walletBalance,
    double? totalWithdrawn,
    List<ReferralEntry>? referralList,
    List<WalletTransaction>? transactions,
    List<WithdrawalRecord>? withdrawalHistory,
  }) =>
      ReferralState(
        isLoading: isLoading ?? this.isLoading,
        error: error,
        myCode: myCode ?? this.myCode,
        shareLink: shareLink ?? this.shareLink,
        shareMessage: shareMessage ?? this.shareMessage,
        referralCount: referralCount ?? this.referralCount,
        totalEarned: totalEarned ?? this.totalEarned,
        pendingAmount: pendingAmount ?? this.pendingAmount,
        walletBalance: walletBalance ?? this.walletBalance,
        totalWithdrawn: totalWithdrawn ?? this.totalWithdrawn,
        referralList: referralList ?? this.referralList,
        transactions: transactions ?? this.transactions,
        withdrawalHistory: withdrawalHistory ?? this.withdrawalHistory,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class ReferralNotifier extends StateNotifier<ReferralState> {
  final ReferralService _service;

  ReferralNotifier(this._service) : super(const ReferralState());

  Future<void> load() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final results = await Future.wait([
        _service.getCode(),
        _service.getStats(),
        _service.getList(),
      ]);

      final codeData = results[0] as Map<String, dynamic>;
      final stats = results[1] as ReferralStats;
      final list = results[2] as List<ReferralEntry>;

      state = state.copyWith(
        isLoading: false,
        myCode: codeData['code'] ?? '',
        shareLink: codeData['shareLink'] ?? '',
        shareMessage: codeData['shareMessage'] ?? '',
        referralCount: stats.referralCount,
        totalEarned: stats.totalEarned,
        pendingAmount: stats.pendingCommission,
        walletBalance: stats.walletBalance,
        totalWithdrawn: stats.totalWithdrawn,
        referralList: list,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _parseError(e));
    }
  }

  Future<void> loadWallet() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final data = await _service.getWallet();
      final txList = (data['transactions'] as List<dynamic>)
          .map((e) => WalletTransaction.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(
        isLoading: false,
        walletBalance: (data['balance'] ?? 0).toDouble(),
        totalEarned: (data['totalEarned'] ?? 0).toDouble(),
        totalWithdrawn: (data['totalWithdrawn'] ?? 0).toDouble(),
        transactions: txList,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: _parseError(e));
    }
  }

  Future<String?> applyCode(String code) async {
    try {
      final ok = await _service.applyCode(code);
      if (ok) await load();
      return ok ? null : 'Failed to apply code';
    } catch (e) {
      return _parseError(e);
    }
  }

  Future<String?> requestWithdrawal({
    required double amount,
    required String method,
    required String accountDetails,
  }) async {
    try {
      await _service.requestWithdrawal(
          amount: amount, method: method, accountDetails: accountDetails);
      await loadWallet();
      return null;
    } catch (e) {
      return _parseError(e);
    }
  }

  String _parseError(dynamic e) {
    if (e is Exception) return e.toString().replaceAll('Exception: ', '');
    return 'Something went wrong';
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

final referralProvider =
    StateNotifierProvider<ReferralNotifier, ReferralState>((ref) {
  return ReferralNotifier(ref.watch(referralServiceProvider));
});
