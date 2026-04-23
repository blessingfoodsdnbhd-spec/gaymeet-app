import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/promotion.dart';
import 'auth_provider.dart';

// ── Dummy data ─────────────────────────────────────────────────────────────────

final _dummyPromotions = <Promotion>[];

// ── State ─────────────────────────────────────────────────────────────────────

class PromotionState {
  final List<Promotion> promotions;
  final Set<String> dismissedIds;
  final bool isLoading;

  const PromotionState({
    this.promotions = const [],
    this.dismissedIds = const {},
    this.isLoading = false,
  });

  List<Promotion> get activePromotions => promotions
      .where((p) => p.isCurrentlyActive && !dismissedIds.contains(p.id))
      .toList();

  List<Promotion> get bannerPromotions => activePromotions
      .where((p) =>
          p.type == PromotionType.banner || p.type == PromotionType.both)
      .toList();

  List<Promotion> get interstitialPromotions => activePromotions
      .where((p) =>
          p.type == PromotionType.interstitial || p.type == PromotionType.both)
      .toList();

  PromotionState copyWith({
    List<Promotion>? promotions,
    Set<String>? dismissedIds,
    bool? isLoading,
  }) =>
      PromotionState(
        promotions: promotions ?? this.promotions,
        dismissedIds: dismissedIds ?? this.dismissedIds,
        isLoading: isLoading ?? this.isLoading,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class PromotionNotifier extends StateNotifier<PromotionState> {
  final ApiClient _api;

  PromotionNotifier(this._api) : super(const PromotionState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true);
    try {
      final response = await _api.dio.get('/promotions');
      final List<dynamic> data = response.data['data'] as List<dynamic>;
      final promos = data.map((j) => Promotion.fromJson(j as Map<String, dynamic>)).toList();
      state = state.copyWith(promotions: promos, isLoading: false);
    } catch (_) {
      // Fall back to dummy data
      state = state.copyWith(promotions: _dummyPromotions, isLoading: false);
    }
  }

  void dismiss(String id) {
    state = state.copyWith(
      dismissedIds: {...state.dismissedIds, id},
    );
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

final promotionProvider =
    StateNotifierProvider<PromotionNotifier, PromotionState>((ref) {
  return PromotionNotifier(ref.watch(apiClientProvider));
});
