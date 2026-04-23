import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/feed_service.dart';
import '../models/feed_item.dart';
import 'auth_provider.dart';

// ── State ─────────────────────────────────────────────────────────────────────

class FeedState {
  final List<FeedItem> items;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final int page;
  final String? error;

  const FeedState({
    this.items = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasMore = true,
    this.page = 1,
    this.error,
  });

  FeedState copyWith({
    List<FeedItem>? items,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasMore,
    int? page,
    String? error,
  }) =>
      FeedState(
        items: items ?? this.items,
        isLoading: isLoading ?? this.isLoading,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        hasMore: hasMore ?? this.hasMore,
        page: page ?? this.page,
        error: error,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class FeedNotifier extends StateNotifier<FeedState> {
  final FeedService _service;
  final String _tab; // 'discover' | 'following'
  static const _pageSize = 20;

  FeedNotifier(this._service, [this._tab = 'discover'])
      : super(const FeedState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, page: 1, error: null);
    try {
      final items = await _service.getFeed(tab: _tab, page: 1, limit: _pageSize);
      debugPrint(
        '[feed.fetch] tab=$_tab count=${items.length} '
        'types=${items.map((i) => i.type).join(",")}',
      );
      state = state.copyWith(
        items: items,
        isLoading: false,
        page: 2,
        hasMore: items.length >= _pageSize,
      );
    } catch (e, st) {
      debugPrint('[feed.fetch] tab=$_tab ERROR: $e');
      debugPrintStack(stackTrace: st, maxFrames: 3);
      state = state.copyWith(isLoading: false, hasMore: false);
    }
  }

  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final more = await _service.getFeed(
          tab: _tab, page: state.page, limit: _pageSize);
      state = state.copyWith(
        items: [...state.items, ...more],
        isLoadingMore: false,
        page: state.page + 1,
        hasMore: more.length >= _pageSize,
      );
    } catch (_) {
      state = state.copyWith(isLoadingMore: false, hasMore: false);
    }
  }

  /// Toggle like on a moment/place item. No-op for events.
  Future<void> toggleLike(String itemId) async {
    final idx = state.items.indexWhere((i) => i.id == itemId);
    if (idx == -1) return;
    final item = state.items[idx];
    if (item.type == 'event') return;

    // Optimistic update.
    final updated = item.copyWith(
      isLiked: !item.isLiked,
      likeCount: item.isLiked ? item.likeCount - 1 : item.likeCount + 1,
    );
    final newList = [...state.items];
    newList[idx] = updated;
    state = state.copyWith(items: newList);

    try {
      await _service.toggleMomentLike(itemId);
    } catch (_) {
      // Revert.
      newList[idx] = item;
      state = state.copyWith(items: [...newList]);
    }
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

final _feedServiceProvider = Provider<FeedService>(
  (ref) => FeedService(ref.watch(apiClientProvider)),
);

final feedProvider =
    StateNotifierProvider<FeedNotifier, FeedState>((ref) {
  return FeedNotifier(ref.watch(_feedServiceProvider), 'discover');
});

final followingFeedProvider =
    StateNotifierProvider<FeedNotifier, FeedState>((ref) {
  return FeedNotifier(ref.watch(_feedServiceProvider), 'following');
});
