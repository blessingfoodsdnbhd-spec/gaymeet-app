import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/promotion.dart';
import 'auth_provider.dart';

// ── Dummy data ─────────────────────────────────────────────────────────────────

final _dummyPromotions = [
  Promotion(
    id: 'promo_1',
    imageUrl: '',
    title: '高级会员限时 5 折',
    subtitle: '本周末前升级，解锁传送、隐身、超级喜欢等功能',
    actionUrl: '/premium',
    type: PromotionType.both,
    startDate: DateTime.now().subtract(const Duration(days: 1)),
    endDate: DateTime.now().add(const Duration(days: 3)),
    isActive: true,
  ),
  Promotion(
    id: 'promo_2',
    imageUrl: '',
    title: 'GayMeet 同骄活动',
    subtitle: '参与彩虹周活动，赢取免费高级会员',
    actionUrl: '/premium',
    type: PromotionType.banner,
    startDate: DateTime.now().subtract(const Duration(hours: 2)),
    endDate: DateTime.now().add(const Duration(days: 7)),
    isActive: true,
  ),
];

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
