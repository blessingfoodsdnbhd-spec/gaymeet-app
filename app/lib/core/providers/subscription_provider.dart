import 'package:gaymeet/core/providers/auth_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import 'privacy_provider.dart'; // re-uses sharedPreferencesProvider

// ── Prefs keys ────────────────────────────────────────────────────────────────

const _kIsPremium = 'sub_isPremium';
const _kSwipeDate = 'sub_swipeDate';
const _kSwipeCount = 'sub_swipeCount';
const _kSuperLikeDate = 'sub_superLikeDate';
const _kSuperLikeCount = 'sub_superLikeCount';

// ── Limits ────────────────────────────────────────────────────────────────────

const int kFreeSwipesPerDay = 20;
const int kPremiumSuperLikesPerDay = 5;

// ── State ─────────────────────────────────────────────────────────────────────

class SubscriptionState {
  final bool isPremium;
  final int vipLevel; // 0 = free, 1–3 = VIP tier
  final bool isLoading;
  final int swipesUsedToday;
  final int superLikesUsedToday;

  const SubscriptionState({
    this.isPremium = false,
    this.vipLevel = 0,
    this.isLoading = false,
    this.swipesUsedToday = 0,
    this.superLikesUsedToday = 0,
  });

  bool get canSwipe => isPremium || swipesUsedToday < kFreeSwipesPerDay;
  bool get canSuperLike => isPremium && superLikesUsedToday < kPremiumSuperLikesPerDay;

  /// Remaining free swipes for UI display (only meaningful when !isPremium)
  int get freeSwipesRemaining =>
      (kFreeSwipesPerDay - swipesUsedToday).clamp(0, kFreeSwipesPerDay);

  SubscriptionState copyWith({
    bool? isPremium,
    int? vipLevel,
    bool? isLoading,
    int? swipesUsedToday,
    int? superLikesUsedToday,
  }) =>
      SubscriptionState(
        isPremium: isPremium ?? this.isPremium,
        vipLevel: vipLevel ?? this.vipLevel,
        isLoading: isLoading ?? this.isLoading,
        swipesUsedToday: swipesUsedToday ?? this.swipesUsedToday,
        superLikesUsedToday: superLikesUsedToday ?? this.superLikesUsedToday,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class SubscriptionNotifier extends StateNotifier<SubscriptionState> {
  final ApiClient _api;
  final SharedPreferences _prefs;

  SubscriptionNotifier(this._api, this._prefs)
      : super(const SubscriptionState()) {
    _seedFromPrefs();
  }

  void _seedFromPrefs() {
    final isPremium = _prefs.getBool(_kIsPremium) ?? false;
    final today = _todayStr();

    final swipeDate = _prefs.getString(_kSwipeDate);
    final swipeCount = swipeDate == today ? (_prefs.getInt(_kSwipeCount) ?? 0) : 0;

    final superLikeDate = _prefs.getString(_kSuperLikeDate);
    final superLikeCount =
        superLikeDate == today ? (_prefs.getInt(_kSuperLikeCount) ?? 0) : 0;

    state = SubscriptionState(
      isPremium: isPremium,
      swipesUsedToday: swipeCount,
      superLikesUsedToday: superLikeCount,
    );
  }

  /// Called from app.dart after auth resolves — syncs premium status from server.
  void syncFromUser(bool isPremium, {int vipLevel = 0}) {
    state = state.copyWith(isPremium: isPremium, vipLevel: vipLevel);
    _prefs.setBool(_kIsPremium, isPremium);
  }

  /// Record a swipe (right or left) — only counts against the free limit.
  void recordSwipe() {
    if (state.isPremium) return; // unlimited for premium
    final newCount = state.swipesUsedToday + 1;
    state = state.copyWith(swipesUsedToday: newCount);
    _prefs.setString(_kSwipeDate, _todayStr());
    _prefs.setInt(_kSwipeCount, newCount);
  }

  /// Record a super-like use.
  void recordSuperLike() {
    if (!state.isPremium) return;
    final newCount = state.superLikesUsedToday + 1;
    state = state.copyWith(superLikesUsedToday: newCount);
    _prefs.setString(_kSuperLikeDate, _todayStr());
    _prefs.setInt(_kSuperLikeCount, newCount);
  }

  // ── Purchase / restore ────────────────────────────────────────────────────

  /// Mock purchase — simulates a 1.5 s store round-trip.
  /// Structure: plug RevenueCat / Stripe in here later.
  Future<bool> purchase(String productId) async {
    state = state.copyWith(isLoading: true);
    try {
      // Simulate store latency
      await Future.delayed(const Duration(milliseconds: 1500));

      // In production: call RevenueCat.purchase(productId) here
      // Fire-and-forget notify backend (best-effort)
      _api.dio
          .post('/subscriptions/purchase', data: {'plan': productId})
          .then((_) {}, onError: (_) {});

      state = state.copyWith(isPremium: true, isLoading: false);
      _prefs.setBool(_kIsPremium, true);
      return true;
    } catch (_) {
      state = state.copyWith(isLoading: false);
      return false;
    }
  }

  /// Restore previous purchases (e.g. after reinstall).
  Future<bool> restore() async {
    state = state.copyWith(isLoading: true);
    try {
      await Future.delayed(const Duration(milliseconds: 1000));

      // In production: call RevenueCat.restorePurchases() here
      final resp = await _api.dio.get('/subscriptions/status');
      final isPremium = resp.data['data']['isPremium'] as bool? ?? false;
      state = state.copyWith(isPremium: isPremium, isLoading: false);
      _prefs.setBool(_kIsPremium, isPremium);
      return true;
    } catch (_) {
      state = state.copyWith(isLoading: false);
      return false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  String _todayStr() => DateTime.now().toIso8601String().substring(0, 10);
}

// ── Provider ──────────────────────────────────────────────────────────────────

final subscriptionProvider =
    StateNotifierProvider<SubscriptionNotifier, SubscriptionState>((ref) {
  return SubscriptionNotifier(
    ref.watch(apiClientProvider),
    ref.watch(sharedPreferencesProvider),
  );
});
