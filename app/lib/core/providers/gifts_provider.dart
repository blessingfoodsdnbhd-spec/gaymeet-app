import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/gifts_service.dart';
import '../models/gift.dart';
import 'auth_provider.dart';

// ── Dummy gifts ────────────────────────────────────────────────────────────────

final _dummyGifts = [
  Gift(id: 'g1', name: 'Rose', icon: '🌹', price: 10, category: 'romantic'),
  Gift(id: 'g2', name: 'Bouquet', icon: '💐', price: 50, category: 'romantic'),
  Gift(id: 'g3', name: 'Heart Box', icon: '💝', price: 100, category: 'romantic'),
  Gift(id: 'g4', name: 'Ring', icon: '💍', price: 200, category: 'romantic'),
  Gift(id: 'g5', name: 'Beer', icon: '🍺', price: 5, category: 'fun'),
  Gift(id: 'g6', name: 'Cake', icon: '🎂', price: 15, category: 'fun'),
  Gift(id: 'g7', name: 'Star', icon: '⭐', price: 20, category: 'fun'),
  Gift(id: 'g8', name: 'Gift Box', icon: '🎁', price: 30, category: 'fun'),
  Gift(id: 'g9', name: 'Crown', icon: '👑', price: 500, category: 'luxury'),
  Gift(id: 'g10', name: 'Sports Car', icon: '🏎️', price: 1000, category: 'luxury'),
  Gift(id: 'g11', name: 'Villa', icon: '🏠', price: 2000, category: 'luxury'),
  Gift(id: 'g12', name: 'Diamond', icon: '💎', price: 5000, category: 'luxury'),
];

final _dummyPackages = const [
  CoinPackage(id: 'coins_100', coins: 100, price: 9.90, currency: 'MYR', label: '100 Coins'),
  CoinPackage(id: 'coins_500', coins: 500, price: 39.90, currency: 'MYR', label: '500 Coins'),
  CoinPackage(id: 'coins_1000', coins: 1000, price: 69.90, currency: 'MYR', label: '1000 Coins', bestValue: true),
];

// ── State ─────────────────────────────────────────────────────────────────────

class GiftsState {
  final List<Gift> gifts;
  final List<GiftTransaction> received;
  final List<CoinPackage> packages;
  final int coinBalance;
  final bool isLoading;
  final bool isSending;

  const GiftsState({
    this.gifts = const [],
    this.received = const [],
    this.packages = const [],
    this.coinBalance = 0,
    this.isLoading = false,
    this.isSending = false,
  });

  GiftsState copyWith({
    List<Gift>? gifts,
    List<GiftTransaction>? received,
    List<CoinPackage>? packages,
    int? coinBalance,
    bool? isLoading,
    bool? isSending,
  }) =>
      GiftsState(
        gifts: gifts ?? this.gifts,
        received: received ?? this.received,
        packages: packages ?? this.packages,
        coinBalance: coinBalance ?? this.coinBalance,
        isLoading: isLoading ?? this.isLoading,
        isSending: isSending ?? this.isSending,
      );

  List<Gift> byCategory(String cat) =>
      gifts.where((g) => g.category == cat).toList();
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class GiftsNotifier extends StateNotifier<GiftsState> {
  final GiftsService _service;

  GiftsNotifier(this._service) : super(const GiftsState()) {
    _init();
  }

  Future<void> _init() async {
    state = state.copyWith(isLoading: true);
    try {
      final gifts = await _service.getGifts();
      final balance = await _service.getCoinBalance();
      final packages = await _service.getCoinPackages();
      state = state.copyWith(
        gifts: gifts,
        coinBalance: balance,
        packages: packages,
        isLoading: false,
      );
    } catch (_) {
      state = state.copyWith(
        gifts: _dummyGifts,
        coinBalance: 100,
        packages: _dummyPackages,
        isLoading: false,
      );
    }
  }

  Future<void> refreshBalance() async {
    try {
      final b = await _service.getCoinBalance();
      state = state.copyWith(coinBalance: b);
    } catch (_) {}
  }

  /// Returns error string or null on success.
  Future<String?> sendGift({
    required String receiverId,
    required String giftId,
    required int giftPrice,
    String? message,
  }) async {
    if (state.coinBalance < giftPrice) {
      return 'insufficient_coins';
    }
    state = state.copyWith(isSending: true);
    try {
      final result = await _service.sendGift(
        receiverId: receiverId,
        giftId: giftId,
        message: message,
      );
      final newBalance = (result['newBalance'] as num?)?.toInt() ??
          state.coinBalance - giftPrice;
      state = state.copyWith(coinBalance: newBalance, isSending: false);
      return null;
    } catch (e) {
      state = state.copyWith(isSending: false);
      return e.toString();
    }
  }

  Future<void> purchaseCoins(String packageId) async {
    try {
      final result = await _service.purchaseCoins(packageId);
      final newBalance = (result['newBalance'] as num?)?.toInt();
      if (newBalance != null) state = state.copyWith(coinBalance: newBalance);
    } catch (_) {}
  }

  Future<void> fetchReceived() async {
    try {
      final txs = await _service.getReceived();
      state = state.copyWith(received: txs);
    } catch (_) {}
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

final _giftsServiceProvider = Provider<GiftsService>(
  (ref) => GiftsService(ref.watch(apiClientProvider)),
);

final giftsProvider =
    StateNotifierProvider<GiftsNotifier, GiftsState>((ref) {
  return GiftsNotifier(ref.watch(_giftsServiceProvider));
});
