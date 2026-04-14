import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import 'auth_provider.dart';

// ── State ─────────────────────────────────────────────────────────────────────

class FollowState {
  final bool isFollowing;
  final bool isLoading;

  const FollowState({
    this.isFollowing = false,
    this.isLoading = false,
  });

  FollowState copyWith({bool? isFollowing, bool? isLoading}) => FollowState(
        isFollowing: isFollowing ?? this.isFollowing,
        isLoading: isLoading ?? this.isLoading,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class FollowNotifier extends StateNotifier<FollowState> {
  final ApiClient _client;
  final String _targetId;

  FollowNotifier(this._client, this._targetId) : super(const FollowState()) {
    _checkFollowing();
  }

  Future<void> _checkFollowing() async {
    try {
      final res = await _client.dio.get('/users/$_targetId/is-following');
      final data = (res.data['data'] ?? res.data) as Map<String, dynamic>;
      state = state.copyWith(isFollowing: data['following'] as bool? ?? false);
    } catch (_) {}
  }

  Future<void> toggle() async {
    if (state.isLoading) return;
    state = state.copyWith(isLoading: true);
    try {
      final res = await _client.dio.post('/users/$_targetId/follow');
      final data = (res.data['data'] ?? res.data) as Map<String, dynamic>;
      state = state.copyWith(
        isFollowing: data['following'] as bool? ?? !state.isFollowing,
        isLoading: false,
      );
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }
}

// ── Provider (family by target userId) ───────────────────────────────────────

final followProvider =
    StateNotifierProvider.family<FollowNotifier, FollowState, String>(
  (ref, userId) => FollowNotifier(ref.watch(apiClientProvider), userId),
);

// ── Follow-list state (for followers/following screen) ────────────────────────

class FollowListItem {
  final String id;
  final String nickname;
  final String? avatarUrl;
  final bool isOnline;
  final int level;
  final bool isPremium;
  final bool isVerified;
  final bool isFollowing;
  final bool isSelf;

  const FollowListItem({
    required this.id,
    required this.nickname,
    this.avatarUrl,
    this.isOnline = false,
    this.level = 1,
    this.isPremium = false,
    this.isVerified = false,
    this.isFollowing = false,
    this.isSelf = false,
  });

  factory FollowListItem.fromJson(Map<String, dynamic> json) {
    final rawId = json['_id'] ?? json['id'] ?? '';
    return FollowListItem(
      id: rawId.toString(),
      nickname: json['nickname'] as String? ?? '',
      avatarUrl: json['avatarUrl'] as String?,
      isOnline: json['isOnline'] as bool? ?? false,
      level: (json['level'] as num?)?.toInt() ?? 1,
      isPremium: json['isPremium'] as bool? ?? false,
      isVerified: json['isVerified'] as bool? ?? false,
      isFollowing: json['isFollowing'] as bool? ?? false,
      isSelf: json['isSelf'] as bool? ?? false,
    );
  }

  FollowListItem copyWith({bool? isFollowing}) => FollowListItem(
        id: id,
        nickname: nickname,
        avatarUrl: avatarUrl,
        isOnline: isOnline,
        level: level,
        isPremium: isPremium,
        isVerified: isVerified,
        isFollowing: isFollowing ?? this.isFollowing,
        isSelf: isSelf,
      );
}

class FollowListState {
  final List<FollowListItem> items;
  final bool isLoading;
  final String? error;

  const FollowListState({
    this.items = const [],
    this.isLoading = false,
    this.error,
  });

  FollowListState copyWith({
    List<FollowListItem>? items,
    bool? isLoading,
    String? error,
  }) =>
      FollowListState(
        items: items ?? this.items,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

class FollowListNotifier extends StateNotifier<FollowListState> {
  final ApiClient _client;
  final String _userId;
  final String _type; // 'followers' or 'following'

  FollowListNotifier(this._client, this._userId, this._type)
      : super(const FollowListState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res =
          await _client.dio.get('/users/$_userId/$_type');
      final list = (res.data['data'] ?? res.data) as List;
      state = state.copyWith(
        items: list
            .map((j) =>
                FollowListItem.fromJson(j as Map<String, dynamic>))
            .toList(),
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> toggleFollow(String targetId) async {
    try {
      final res = await _client.dio.post('/users/$targetId/follow');
      final data = (res.data['data'] ?? res.data) as Map<String, dynamic>;
      final isNowFollowing = data['following'] as bool? ?? false;
      state = state.copyWith(
        items: state.items.map((item) {
          if (item.id == targetId) return item.copyWith(isFollowing: isNowFollowing);
          return item;
        }).toList(),
      );
    } catch (_) {}
  }
}

// Family: (userId, type) → provider
final followListProvider = StateNotifierProvider.family<FollowListNotifier,
    FollowListState, (String, String)>(
  (ref, params) =>
      FollowListNotifier(ref.watch(apiClientProvider), params.$1, params.$2),
);
