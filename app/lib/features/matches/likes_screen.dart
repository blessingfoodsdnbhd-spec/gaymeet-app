import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/likes_provider.dart';
import '../../core/providers/match_provider.dart';

class LikesScreen extends ConsumerStatefulWidget {
  const LikesScreen({super.key});

  @override
  ConsumerState<LikesScreen> createState() => _LikesScreenState();
}

class _LikesScreenState extends ConsumerState<LikesScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(likesProvider.notifier).fetchLikes());
  }

  Future<void> _swipe(String userId, String userName, String? avatarUrl,
      String direction) async {
    final isMatch =
        await ref.read(likesProvider.notifier).swipe(userId, direction);

    if (!mounted) return;

    if (isMatch && direction == 'like') {
      // Refresh matches so the new match appears in the list
      ref.read(matchesProvider.notifier).fetchMatches();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.favorite_rounded, color: AppTheme.primary),
              const SizedBox(width: 8),
              Text("It's a match with $userName!"),
            ],
          ),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(likesProvider);

    return Scaffold(
      appBar: AppBar(
        title: state.when(
          data: (users) => Text(
            users.isEmpty ? 'Who Liked You' : '${users.length} Likes',
          ),
          loading: () => const Text('Who Liked You'),
          error: (_, __) => const Text('Who Liked You'),
        ),
      ),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline_rounded,
                  size: 48, color: AppTheme.textHint),
              const SizedBox(height: 12),
              const Text('Failed to load likes'),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () =>
                    ref.read(likesProvider.notifier).fetchLikes(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (users) => users.isEmpty
            ? _buildEmpty()
            : _buildGrid(users),
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(Icons.favorite_border_rounded,
                  size: 36, color: AppTheme.textHint),
            ),
            const SizedBox(height: 20),
            const Text('No new likes yet',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(
              'Keep swiping — likes you receive\nwill show up here.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textSecondary, height: 1.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGrid(List users) {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 0.72,
      ),
      itemCount: users.length,
      itemBuilder: (_, i) {
        final user = users[i];
        return _LikeCard(
          user: user,
          onLike: () =>
              _swipe(user.id, user.nickname, user.avatarUrl, 'like'),
          onPass: () =>
              _swipe(user.id, user.nickname, user.avatarUrl, 'pass'),
        );
      },
    );
  }
}

// ── Like card ─────────────────────────────────────────────────────────────────

class _LikeCard extends StatelessWidget {
  final dynamic user;
  final VoidCallback onLike;
  final VoidCallback onPass;

  const _LikeCard({
    required this.user,
    required this.onLike,
    required this.onPass,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(20),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Photo
          if (user.avatarUrl != null)
            CachedNetworkImage(
              imageUrl: user.avatarUrl!,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(color: AppTheme.card),
              errorWidget: (_, __, ___) => Container(
                color: AppTheme.card,
                child: Icon(Icons.person_rounded,
                    size: 60, color: AppTheme.textHint),
              ),
            )
          else
            Container(
              color: AppTheme.card,
              child: Icon(Icons.person_rounded,
                  size: 60, color: AppTheme.textHint),
            ),

          // Gradient overlay at bottom
          Positioned.fill(
            child: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.transparent, Color(0xDD000000)],
                  stops: [0.0, 0.45, 1.0],
                ),
              ),
            ),
          ),

          // Name + action buttons
          Positioned(
            left: 10,
            right: 10,
            bottom: 10,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  user.nickname,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _RoundBtn(
                        icon: Icons.close_rounded,
                        color: AppTheme.error,
                        onTap: onPass,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _RoundBtn(
                        icon: Icons.favorite_rounded,
                        color: AppTheme.primary,
                        onTap: onLike,
                        gradient: true,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RoundBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final bool gradient;

  const _RoundBtn({
    required this.icon,
    required this.color,
    required this.onTap,
    this.gradient = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 38,
        decoration: BoxDecoration(
          gradient: gradient ? AppTheme.brandGradient : null,
          color: gradient ? null : AppTheme.surface.withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: gradient ? Colors.white : color, size: 20),
      ),
    );
  }
}
