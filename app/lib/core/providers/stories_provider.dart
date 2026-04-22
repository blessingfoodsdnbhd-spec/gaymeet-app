import 'package:gaymeet/core/providers/auth_provider.dart';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/stories_service.dart';
import '../models/story.dart';

// ── Dummy data for offline dev ─────────────────────────────────────────────────
final _dummyGroups = List.generate(6, (i) {
  final names = ['Marcus', 'Kenji', 'Daniel', 'Ryan', 'Tomás', 'James'];
  final avatars = [
    'https://i.pravatar.cc/150?img=12',
    'https://i.pravatar.cc/150?img=14',
    'https://i.pravatar.cc/150?img=53',
    'https://i.pravatar.cc/150?img=57',
    'https://i.pravatar.cc/150?img=59',
    'https://i.pravatar.cc/150?img=60',
  ];
  return StoryGroup(
    user: StoryAuthor(
      id: 'u${i + 1}',
      nickname: names[i],
      avatarUrl: avatars[i],
    ),
    stories: [
      StoryItem(
        id: 'story_${i}_0',
        mediaUrl: avatars[i],
        mediaType: 'image',
        caption: i % 2 == 0 ? 'Having a great day!' : '',
        viewCount: i * 12,
        isViewed: i % 3 == 2,
        createdAt: DateTime.now().subtract(Duration(hours: i + 1)),
        expiresAt: DateTime.now().add(Duration(hours: 23 - i)),
      ),
    ],
    hasUnviewed: i % 3 != 2,
  );
});

// ── State ─────────────────────────────────────────────────────────────────────

class StoriesState {
  final List<StoryGroup> groups;
  final bool isLoading;
  final String? error;

  const StoriesState({
    this.groups = const [],
    this.isLoading = false,
    this.error,
  });

  StoriesState copyWith({
    List<StoryGroup>? groups,
    bool? isLoading,
    String? error,
  }) =>
      StoriesState(
        groups: groups ?? this.groups,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

// ── Notifier ──────────────────────────────────────────────────────────────────

class StoriesNotifier extends StateNotifier<StoriesState> {
  final StoriesService _service;
  final String _feed; // 'discover' or 'following'

  StoriesNotifier(this._service, [this._feed = 'discover'])
      : super(const StoriesState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final groups = await _service.getFeed(feed: _feed);
      state = state.copyWith(groups: groups, isLoading: false);
    } catch (_) {
      state = state.copyWith(
        groups: _feed == 'discover' ? _dummyGroups : [],
        isLoading: false,
      );
    }
  }

  void markGroupViewed(String userId, String storyId) {
    state = state.copyWith(
      groups: state.groups.map((g) {
        if (g.user.id != userId) return g;
        final updated = g.stories.map((s) {
          if (s.id != storyId) return s;
          return StoryItem(
            id: s.id,
            mediaUrl: s.mediaUrl,
            mediaType: s.mediaType,
            caption: s.caption,
            viewCount: s.viewCount + 1,
            isViewed: true,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
          );
        }).toList();
        final stillHasUnviewed = updated.any((s) => !s.isViewed);
        return StoryGroup(
          user: g.user,
          stories: updated,
          hasUnviewed: stillHasUnviewed,
        );
      }).toList(),
    );
    // Fire-and-forget API call
    _service.markViewed(storyId).catchError((_) {});
  }

  Future<void> createStory({
    required File file,
    String caption = '',
    String visibility = 'followers',
  }) async {
    await _service.createStory(file: file, caption: caption, visibility: visibility);
    await fetch();
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

final _storiesServiceProvider = Provider<StoriesService>(
  (ref) => StoriesService(ref.watch(apiClientProvider)),
);

final storiesProvider =
    StateNotifierProvider<StoriesNotifier, StoriesState>((ref) {
  return StoriesNotifier(ref.watch(_storiesServiceProvider), 'discover');
});

final followingStoriesProvider =
    StateNotifierProvider<StoriesNotifier, StoriesState>((ref) {
  return StoriesNotifier(ref.watch(_storiesServiceProvider), 'following');
});
