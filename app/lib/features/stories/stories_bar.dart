import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/models/story.dart';
import '../../core/providers/stories_provider.dart';

/// Horizontal stories bar — shown at the top of the moments tabs.
///
/// Pass `provider` to pick which feed to show (discover = public + followed,
/// following = own + followed only).
class StoriesBar extends ConsumerWidget {
  final StateNotifierProvider<StoriesNotifier, StoriesState>? provider;

  const StoriesBar({super.key, this.provider});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(provider ?? storiesProvider);

    if (state.isLoading && state.groups.isEmpty) {
      return const SizedBox(
        height: 96,
        child: Center(child: CircularProgressIndicator()),
      );
    }

    final groups = state.groups;

    return SizedBox(
      height: 96,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: groups.length + 1, // +1 for "add story" tile
        itemBuilder: (context, i) {
          if (i == 0) return _AddStoryTile(onTap: () => context.push('/stories/create'));
          final group = groups[i - 1];
          return _StoryTile(
            group: group,
            onTap: () => context.push('/stories/view/${group.user.id}', extra: groups),
          );
        },
      ),
    );
  }
}

// ── Add story tile ────────────────────────────────────────────────────────────

class _AddStoryTile extends StatelessWidget {
  final VoidCallback onTap;
  const _AddStoryTile({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.only(right: 12),
        child: Column(
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 58,
                  height: 58,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppTheme.card,
                    border: Border.all(color: const Color(0xFF3A3A3A), width: 2),
                  ),
                  child: Icon(Icons.person_rounded, color: AppTheme.textHint, size: 28),
                ),
                Positioned(
                  right: -2,
                  bottom: -2,
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      gradient: AppTheme.brandGradient,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppTheme.bg, width: 2),
                    ),
                    child: const Icon(Icons.add_rounded, size: 13, color: Colors.white),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              '我的故事',
              style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Story circle tile ─────────────────────────────────────────────────────────

class _StoryTile extends StatelessWidget {
  final StoryGroup group;
  final VoidCallback onTap;

  const _StoryTile({required this.group, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.only(right: 12),
        child: Column(
          children: [
            _StoryRing(group: group),
            const SizedBox(height: 6),
            SizedBox(
              width: 62,
              child: Text(
                group.user.nickname,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  color: group.hasUnviewed
                      ? AppColors.textPrimary
                      : AppTheme.textSecondary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StoryRing extends StatelessWidget {
  final StoryGroup group;
  const _StoryRing({required this.group});

  @override
  Widget build(BuildContext context) {
    const totalSize = 62.0;
    const borderWidth = 2.5;
    const innerPadding = 3.0;
    const innerSize = totalSize - (borderWidth + innerPadding) * 2;

    Widget avatar = Container(
      width: innerSize,
      height: innerSize,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppTheme.card,
        image: group.user.avatarUrl != null
            ? DecorationImage(
                image: CachedNetworkImageProvider(group.user.avatarUrl!),
                fit: BoxFit.cover,
              )
            : null,
      ),
      child: group.user.avatarUrl == null
          ? Icon(Icons.person_rounded, color: AppTheme.textHint, size: 28)
          : null,
    );

    return Container(
      width: totalSize,
      height: totalSize,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: group.hasUnviewed
            ? AppColors.rainbowGradient
            : null,
        color: group.hasUnviewed ? null : const Color(0xFF3A3A3A),
      ),
      child: Padding(
        padding: const EdgeInsets.all(borderWidth + innerPadding),
        child: avatar,
      ),
    );
  }
}
