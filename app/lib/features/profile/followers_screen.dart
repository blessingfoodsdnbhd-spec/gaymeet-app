import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/follow_provider.dart';
import '../../shared/widgets/level_badge.dart';

class FollowersScreen extends ConsumerWidget {
  final String userId;
  final String type; // 'followers' or 'following'

  const FollowersScreen({
    super.key,
    required this.userId,
    required this.type,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(followListProvider((userId, type)));
    final isFollowers = type == 'followers';

    return Scaffold(
      appBar: AppBar(
        title: Text(isFollowers ? '粉丝' : '关注'),
        centerTitle: true,
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.error != null
              ? _ErrorView(
                  onRetry: () =>
                      ref.read(followListProvider((userId, type)).notifier).fetch(),
                )
              : state.items.isEmpty
                  ? _EmptyView(isFollowers: isFollowers)
                  : RefreshIndicator(
                      color: AppTheme.primary,
                      onRefresh: () =>
                          ref.read(followListProvider((userId, type)).notifier).fetch(),
                      child: ListView.builder(
                        itemCount: state.items.length,
                        itemBuilder: (_, i) {
                          final item = state.items[i];
                          return _UserTile(
                            item: item,
                            onFollowToggle: item.isSelf
                                ? null
                                : () => ref
                                    .read(followListProvider((userId, type)).notifier)
                                    .toggleFollow(item.id),
                          );
                        },
                      ),
                    ),
    );
  }
}

// ── User tile ─────────────────────────────────────────────────────────────────

class _UserTile extends StatelessWidget {
  final FollowListItem item;
  final VoidCallback? onFollowToggle;

  const _UserTile({required this.item, this.onFollowToggle});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: Stack(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: const BoxDecoration(shape: BoxShape.circle),
            clipBehavior: Clip.antiAlias,
            child: item.avatarUrl != null
                ? CachedNetworkImage(
                    imageUrl: item.avatarUrl!,
                    fit: BoxFit.cover,
                    placeholder: (_, __) => Container(color: AppTheme.card),
                    errorWidget: (_, __, ___) => _placeholder,
                  )
                : _placeholder,
          ),
          if (item.isOnline)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: AppTheme.online,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.surface, width: 2),
                ),
              ),
            ),
        ],
      ),
      title: Row(
        children: [
          Text(
            item.nickname,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
          ),
          if (item.isVerified) ...[
            const SizedBox(width: 4),
            const Icon(Icons.verified_rounded,
                size: 15, color: Color(0xFF42A5F5)),
          ],
          if (item.isPremium) ...[
            const SizedBox(width: 6),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                gradient: AppTheme.brandGradient,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text('VIP',
                  style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w800,
                      color: Colors.white)),
            ),
          ],
        ],
      ),
      subtitle: LevelBadge(level: item.level, size: 18, compact: true),
      trailing: item.isSelf
          ? null
          : _FollowButton(
              isFollowing: item.isFollowing,
              onTap: onFollowToggle,
            ),
    );
  }

  static final _placeholder = Container(
    color: AppTheme.card,
    child: const Icon(Icons.person_rounded,
        color: Color(0xFF3A3A3A), size: 24),
  );
}

// ── Follow button ─────────────────────────────────────────────────────────────

class _FollowButton extends StatelessWidget {
  final bool isFollowing;
  final VoidCallback? onTap;

  const _FollowButton({required this.isFollowing, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: isFollowing ? Colors.transparent : AppTheme.primary,
          borderRadius: BorderRadius.circular(20),
          border: isFollowing
              ? Border.all(color: AppTheme.primary.withValues(alpha: 0.5))
              : null,
        ),
        child: Text(
          isFollowing ? '已关注' : '关注',
          style: TextStyle(
            color: isFollowing ? AppTheme.primary : Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

// ── Empty / Error ─────────────────────────────────────────────────────────────

class _EmptyView extends StatelessWidget {
  final bool isFollowers;
  const _EmptyView({required this.isFollowers});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isFollowers ? Icons.people_outline_rounded : Icons.person_add_outlined,
            size: 48,
            color: AppTheme.textHint,
          ),
          const SizedBox(height: 12),
          Text(
            isFollowers ? '还没有粉丝' : '还没有关注任何人',
            style:
                TextStyle(color: AppTheme.textSecondary, fontSize: 15),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorView({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline_rounded,
              size: 40, color: AppTheme.textHint),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('重试'),
          ),
        ],
      ),
    );
  }
}
