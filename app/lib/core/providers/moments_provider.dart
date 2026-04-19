import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/moments_service.dart';
import '../models/moment.dart';
import 'auth_provider.dart';

// ── Dummy data ─────────────────────────────────────────────────────────────────
final _dummyMoments = List.generate(6, (i) {
  final users = [
    ('Hafiz', 'MY'), ('Wei Zhen', 'MY'), ('Arjun', 'MY'),
    ('Taichi', 'JP'), ('Kevin Tan', 'SG'), ('Brendan', 'MY'),
  ];
  final contents = [
    '今天天气真好，在KLCC散步 ☀️ #KL #weekend',
    '刚健身完！感觉很棒 💪 #gym #fitness',
    '在Bangsar发现了超好吃的咖啡厅 ☕ 推荐大家来！',
    '有人想一起去Broga Hill徒步吗？下周末 🏔️',
    '新加坡的朋友们，我下个月会回去！',
    '好久没出来玩了，找人吃饭 🍜',
  ];
  return Moment(
    id: 'dummy_$i',
    user: MomentUser(
      id: 'u$i',
      nickname: users[i].$1,
      countryCode: users[i].$2,
    ),
    content: contents[i],
    images: [],
    likeCount: (i + 1) * 3,
    isLiked: i % 3 == 0,
    commentsCount: i + 1,
    createdAt: DateTime.now().subtract(Duration(hours: i * 4 + 1)),
  );
});

// ── State ─────────────────────────────────────────────────────────────────────

class MomentsState {
  final List<Moment> moments;
  final bool isLoading;
  final bool isLoadingMore;
  final bool hasMore;
  final int page;
  final String? error;

  const MomentsState({
    this.moments = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.hasMore = true,
    this.page = 1,
    this.error,
  });

  MomentsState copyWith({
    List<Moment>? moments,
    bool? isLoading,
    bool? isLoadingMore,
    bool? hasMore,
    int? page,
    String? error,
  }) =>
      MomentsState(
        moments: moments ?? this.moments,
        isLoading: isLoading ?? this.isLoading,
        isLoadingMore: isLoadingMore ?? this.isLoadingMore,
        hasMore: hasMore ?? this.hasMore,
        page: page ?? this.page,
        error: error,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class MomentsNotifier extends StateNotifier<MomentsState> {
  final MomentsService _service;
  final String _feed; // 'discover' or 'following'

  MomentsNotifier(this._service, [this._feed = 'discover'])
      : super(const MomentsState()) {
    fetchFeed();
  }

  Future<void> fetchFeed({String? userId}) async {
    state = state.copyWith(isLoading: true, page: 1, error: null);
    try {
      final moments =
          await _service.getFeed(page: 1, userId: userId, feed: _feed);
      state = state.copyWith(
        moments: moments,
        isLoading: false,
        page: 2,
        hasMore: moments.length >= 20,
      );
    } catch (_) {
      // Only fall back to dummy data on first load; keep existing state on refresh
      state = state.copyWith(
        moments: state.moments.isEmpty
            ? (_feed == 'discover' ? _dummyMoments : [])
            : state.moments,
        isLoading: false,
        hasMore: false,
      );
    }
  }

  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final more = await _service.getFeed(page: state.page, feed: _feed);
      state = state.copyWith(
        moments: [...state.moments, ...more],
        isLoadingMore: false,
        page: state.page + 1,
        hasMore: more.length >= 20,
      );
    } catch (_) {
      state = state.copyWith(isLoadingMore: false, hasMore: false);
    }
  }

  Future<void> toggleLike(String momentId) async {
    // Optimistic update
    final idx = state.moments.indexWhere((m) => m.id == momentId);
    if (idx == -1) return;

    final m = state.moments[idx];
    final updated = m.copyWith(
      isLiked: !m.isLiked,
      likeCount: m.isLiked ? m.likeCount - 1 : m.likeCount + 1,
    );
    final newList = [...state.moments];
    newList[idx] = updated;
    state = state.copyWith(moments: newList);

    try {
      await _service.toggleLike(momentId);
    } catch (_) {
      // Revert
      newList[idx] = m;
      state = state.copyWith(moments: [...newList]);
    }
  }

  Future<bool> createMoment({
    required String content,
    required List<String> images,
    required String visibility,
  }) async {
    try {
      final moment = await _service.createMoment(
        content: content,
        images: images,
        visibility: visibility,
      );
      state = state.copyWith(moments: [moment, ...state.moments]);
      return true;
    } catch (e, st) {
      debugPrint('createMoment error: $e\n$st');
      return false;
    }
  }

  Future<void> deleteMoment(String id) async {
    try {
      await _service.deleteMoment(id);
      state = state.copyWith(
          moments: state.moments.where((m) => m.id != id).toList());
    } catch (_) {}
  }

  void addCommentToMoment(String momentId, MomentComment comment) {
    final idx = state.moments.indexWhere((m) => m.id == momentId);
    if (idx == -1) return;
    final m = state.moments[idx];
    final updated = m.copyWith(commentsCount: m.commentsCount + 1);
    final newList = [...state.moments];
    newList[idx] = updated;
    state = state.copyWith(moments: newList);
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

final _momentsServiceProvider = Provider<MomentsService>(
  (ref) => MomentsService(ref.watch(apiClientProvider)),
);

// Default provider — 'discover' feed (used by create/detail screens)
final momentsProvider =
    StateNotifierProvider<MomentsNotifier, MomentsState>((ref) {
  return MomentsNotifier(ref.watch(_momentsServiceProvider), 'discover');
});

// Separate state for the 'following' feed tab
final followingMomentsProvider =
    StateNotifierProvider<MomentsNotifier, MomentsState>((ref) {
  return MomentsNotifier(ref.watch(_momentsServiceProvider), 'following');
});
