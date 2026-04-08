import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/models/user.dart';
import '../../core/providers/likes_provider.dart';
import '../../core/providers/match_provider.dart';
import '../../core/providers/subscription_provider.dart';

class MatchesScreen extends ConsumerStatefulWidget {
  const MatchesScreen({super.key});

  @override
  ConsumerState<MatchesScreen> createState() => _MatchesScreenState();
}

class _MatchesScreenState extends ConsumerState<MatchesScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (!kUseDummyData) {
        ref.read(matchesProvider.notifier).fetchMatches();
      }
      ref.read(likesProvider.notifier).fetchLikes();
    });
  }

  @override
  Widget build(BuildContext context) {
    final matches = kUseDummyData
        ? DummyData.matches
        : ref.watch(matchesProvider).valueOrNull ?? [];

    final likesState = ref.watch(likesProvider);
    final likers = likesState.valueOrNull ?? [];
    final sub = ref.watch(subscriptionProvider);

    final likeCount = kUseDummyData ? DummyData.users.length : likers.length;
    // Preview avatars: use dummy users or real likers, capped at 4
    final previewUsers = kUseDummyData
        ? DummyData.users.take(4).toList()
        : likers.take(4).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Matches')),
      body: ListView(
        children: [
          // ── Who Liked You ─────────────────────────────────────────────────
          if (likeCount > 0 || kUseDummyData)
            _WhoLikedYouSection(
              likeCount: kUseDummyData ? DummyData.users.length : likeCount,
              previewUsers: previewUsers.cast<UserModel>(),
              isPremium: sub.isPremium,
              onTap: () => sub.isPremium
                  ? context.push('/likes')
                  : context.push('/premium'),
            ),

          // ── Matches list ──────────────────────────────────────────────────
          if (matches.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.favorite_border_rounded,
                        size: 56, color: AppTheme.textHint),
                    const SizedBox(height: 16),
                    const Text('No matches yet',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Text('Start swiping!',
                        style: TextStyle(color: AppTheme.textSecondary)),
                  ],
                ),
              ),
            )
          else
            ...matches.map((m) => ListTile(
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  leading: CircleAvatar(
                    radius: 26,
                    backgroundImage: m.user.avatarUrl != null
                        ? CachedNetworkImageProvider(m.user.avatarUrl!)
                        : null,
                    backgroundColor: AppTheme.card,
                  ),
                  title: Text(m.user.nickname,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    'Matched ${timeago.format(m.matchedAt)}',
                    style: TextStyle(
                        color: AppTheme.textSecondary, fontSize: 12),
                  ),
                  trailing: GestureDetector(
                    onTap: () => context.push('/chat/${m.matchId}', extra: {
                      'userId': m.user.id,
                      'userName': m.user.nickname,
                      'userAvatar': m.user.avatarUrl,
                    }),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: AppTheme.brandGradient,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.chat_rounded,
                          size: 16, color: Colors.white),
                    ),
                  ),
                )),
        ],
      ),
    );
  }
}

// ── Who Liked You section ─────────────────────────────────────────────────────

class _WhoLikedYouSection extends StatelessWidget {
  final int likeCount;
  final List<UserModel> previewUsers;
  final bool isPremium;
  final VoidCallback onTap;

  const _WhoLikedYouSection({
    required this.likeCount,
    required this.previewUsers,
    required this.isPremium,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppTheme.primary.withOpacity(0.15),
              AppTheme.accent.withOpacity(0.12),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: AppTheme.primary.withOpacity(0.3),
            width: 1,
          ),
        ),
        child: Row(
          children: [
            // Blurred avatar stack
            SizedBox(
              width: previewUsers.length * 28.0 + 12,
              height: 52,
              child: Stack(
                children: [
                  for (var i = 0; i < previewUsers.length; i++)
                    Positioned(
                      left: i * 28.0,
                      child: _BlurredAvatar(
                        avatarUrl: previewUsers[i].avatarUrl,
                        blur: !isPremium,
                      ),
                    ),
                  // Lock icon overlay for free users
                  if (!isPremium)
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 20,
                        height: 20,
                        decoration: const BoxDecoration(
                          color: AppTheme.primary,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.lock_rounded,
                            size: 12, color: Colors.white),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            // Text
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '👀 $likeCount ${likeCount == 1 ? 'person' : 'people'} liked you',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    isPremium
                        ? 'See who they are and like back'
                        : 'Upgrade to see who liked you',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: isPremium ? AppTheme.primary : AppTheme.textHint,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Blurred avatar circle ─────────────────────────────────────────────────────

class _BlurredAvatar extends StatelessWidget {
  final String? avatarUrl;
  final bool blur;

  const _BlurredAvatar({this.avatarUrl, required this.blur});

  @override
  Widget build(BuildContext context) {
    final circle = Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppTheme.surface, width: 2),
        color: AppTheme.card,
      ),
      child: ClipOval(
        child: avatarUrl != null
            ? CachedNetworkImage(
                imageUrl: avatarUrl!,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(color: AppTheme.card),
                errorWidget: (_, __, ___) => Icon(Icons.person_rounded,
                    color: AppTheme.textHint, size: 24),
              )
            : Icon(Icons.person_rounded, color: AppTheme.textHint, size: 24),
      ),
    );

    if (!blur) return circle;

    return ClipOval(
      child: ImageFiltered(
        imageFilter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: circle,
      ),
    );
  }
}
