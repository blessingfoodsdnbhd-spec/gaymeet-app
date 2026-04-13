import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/models/user.dart';
import '../../core/providers/filter_provider.dart';
import '../../core/providers/promotion_provider.dart';
import '../../core/providers/user_provider.dart';
import '../../shared/widgets/design_system/app_avatar.dart';
import '../../shared/widgets/promo_banner.dart';

class NearbyListScreen extends ConsumerStatefulWidget {
  const NearbyListScreen({super.key});

  @override
  ConsumerState<NearbyListScreen> createState() => _NearbyListScreenState();
}

class _NearbyListScreenState extends ConsumerState<NearbyListScreen> {
  @override
  void initState() {
    super.initState();
    if (!kUseDummyData) {
      Future.microtask(() {
        final filter = ref.read(filterProvider);
        ref.read(nearbyUsersProvider.notifier).fetchNearby(filter: filter);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<DiscoveryFilter>(filterProvider, (_, filter) {
      if (!kUseDummyData) {
        ref.read(nearbyUsersProvider.notifier).fetchNearby(filter: filter);
      }
    });

    final filter = ref.watch(filterProvider);
    final allUsers = kUseDummyData
        ? DummyData.users
        : ref.watch(nearbyUsersProvider).valueOrNull ?? [];

    // Apply local filter when in dummy mode
    final users = kUseDummyData
        ? allUsers.where((u) => filter.matchesUser(
              height: u.height,
              weight: u.weight,
              age: u.age,
            )).toList()
        : allUsers;

    if (users.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.location_off_rounded,
                size: 48, color: AppTheme.textHint),
            const SizedBox(height: 12),
            Text('附近没有人',
                style: TextStyle(
                    color: AppTheme.textSecondary, fontSize: 15)),
            if (filter.filtersEnabled && filter.activeCount > 0) ...[
              const SizedBox(height: 12),
              TextButton(
                onPressed: () =>
                    ref.read(filterProvider.notifier).reset(),
                child: const Text('重置过滤'),
              ),
            ],
          ],
        ),
      );
    }

    final hasBannerPromo =
        ref.watch(promotionProvider).bannerPromotions.isNotEmpty;

    // Build a flat list interleaving promo banners every 5 user rows.
    // Items at indices that are multiples of 6 (0-based: 5, 11, 17…) are
    // promo banners when a banner promotion is active.
    const _promoEvery = 5; // insert banner after every N users
    int _totalItems(int userCount) {
      if (!hasBannerPromo) return userCount;
      return userCount + (userCount ~/ _promoEvery);
    }

    Widget _itemAt(int index, List<UserModel> users) {
      if (!hasBannerPromo) return _NearbyRow(user: users[index]);
      // Every (_promoEvery + 1) items the banner slot appears.
      final slot = _promoEvery + 1;
      final rem = index % slot;
      if (rem == _promoEvery) return const PromoBanner();
      final userIdx = (index ~/ slot) * _promoEvery + rem;
      if (userIdx >= users.length) return const SizedBox.shrink();
      return _NearbyRow(user: users[userIdx]);
    }

    final total = _totalItems(users.length);

    return RefreshIndicator(
      color: AppTheme.primary,
      onRefresh: () async {
        if (!kUseDummyData) {
          ref.read(nearbyUsersProvider.notifier).fetchNearby(
                filter: ref.read(filterProvider),
              );
        }
      },
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: total,
        separatorBuilder: (_, i) {
          // No divider before/after a promo banner slot
          final slot = _promoEvery + 1;
          final rem = i % slot;
          if (!hasBannerPromo || (rem != _promoEvery - 1 && rem != _promoEvery)) {
            return Divider(
              height: 1,
              thickness: 0.5,
              color: const Color(0xFF2A2A2A),
              indent: 84,
            );
          }
          return const SizedBox.shrink();
        },
        itemBuilder: (_, i) => _itemAt(i, users),
      ),
    );
  }
}

// ── Row widget ────────────────────────────────────────────────────────────────

class _NearbyRow extends StatelessWidget {
  final UserModel user;
  const _NearbyRow({required this.user});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/user/${user.id}', extra: user),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Avatar with online dot
            _Avatar(user: user),
            const SizedBox(width: 14),

            // Middle info
            Expanded(child: _UserInfo(user: user)),

            // Three-dot menu
            _MenuButton(user: user),
          ],
        ),
      ),
    );
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

class _Avatar extends StatelessWidget {
  final UserModel user;
  const _Avatar({required this.user});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        AppAvatar(
          imageUrl: user.avatarUrl,
          size: 62,
          isOnline: user.isOnline,
          isPremium: user.isPremium,
        ),

        // Boosted badge
        if (user.isBoosted)
          Positioned(
            top: 0,
            left: 0,
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(
                color: AppColors.warning,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(10),
                  bottomRight: Radius.circular(6),
                ),
              ),
              child: const Icon(Icons.bolt_rounded,
                  size: 10, color: Colors.black),
            ),
          ),
      ],
    );
  }
}

// ── User info ─────────────────────────────────────────────────────────────────

class _UserInfo extends StatelessWidget {
  final UserModel user;
  const _UserInfo({required this.user});

  @override
  Widget build(BuildContext context) {
    // Build body stats string
    final stats = <String>[
      if (user.height != null) '${user.height} cm',
      if (user.weight != null) '${user.weight} kg',
      if (user.age != null) '${user.age}岁',
    ];

    // Build distance + time string
    final meta = <String>[
      if (user.distanceLabel != null) user.distanceLabel!,
      if (user.lastActive != null) _timeAgo(user.lastActive!),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Row 1: Nickname + flag
        Row(
          children: [
            Flexible(
              child: Text(
                user.nickname,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (user.countryCode != null) ...[
              const SizedBox(width: 5),
              Text(
                _flagEmoji(user.countryCode!),
                style: const TextStyle(fontSize: 14),
              ),
            ],
            if (user.isPremium) ...[
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  gradient: AppTheme.brandGradient,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'VIP',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ],
        ),

        // Row 2: Height / weight / age
        if (stats.isNotEmpty) ...[
          const SizedBox(height: 3),
          Text(
            stats.join('  '),
            style: TextStyle(
              color: AppTheme.textSecondary,
              fontSize: 12,
            ),
          ),
        ],

        // Row 3: Distance · time ago
        if (meta.isNotEmpty) ...[
          const SizedBox(height: 3),
          Row(
            children: [
              Icon(Icons.location_on_rounded,
                  size: 11, color: AppTheme.textHint),
              const SizedBox(width: 2),
              Text(
                meta.join('  ·  '),
                style: TextStyle(
                  color: AppTheme.textHint,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  String _flagEmoji(String code) {
    if (code.length != 2) return '';
    final base = 0x1F1E6 - 0x41;
    return String.fromCharCode(base + code.codeUnitAt(0)) +
        String.fromCharCode(base + code.codeUnitAt(1));
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    return '${diff.inDays}天前';
  }
}

// ── Three-dot menu ────────────────────────────────────────────────────────────

class _MenuButton extends StatelessWidget {
  final UserModel user;
  const _MenuButton({required this.user});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<_UserAction>(
      icon: Icon(Icons.more_vert_rounded,
          color: AppTheme.textHint, size: 20),
      color: AppTheme.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      onSelected: (action) {
        switch (action) {
          case _UserAction.viewProfile:
            context.push('/user/${user.id}', extra: user);
          case _UserAction.block:
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('已屏蔽 ${user.nickname}'),
                backgroundColor: AppTheme.surface,
              ),
            );
          case _UserAction.report:
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('已举报 ${user.nickname}'),
                backgroundColor: AppTheme.surface,
              ),
            );
        }
      },
      itemBuilder: (_) => [
        PopupMenuItem(
          value: _UserAction.viewProfile,
          child: Row(
            children: [
              Icon(Icons.person_rounded,
                  size: 18, color: AppTheme.textSecondary),
              const SizedBox(width: 10),
              Text('查看资料',
                  style: TextStyle(color: AppTheme.textPrimary)),
            ],
          ),
        ),
        PopupMenuItem(
          value: _UserAction.block,
          child: Row(
            children: [
              Icon(Icons.block_rounded, size: 18, color: AppTheme.error),
              const SizedBox(width: 10),
              Text('屏蔽',
                  style: TextStyle(color: AppTheme.textPrimary)),
            ],
          ),
        ),
        PopupMenuItem(
          value: _UserAction.report,
          child: Row(
            children: [
              Icon(Icons.flag_rounded, size: 18, color: AppTheme.error),
              const SizedBox(width: 10),
              Text('举报',
                  style: TextStyle(color: AppTheme.textPrimary)),
            ],
          ),
        ),
      ],
    );
  }
}

enum _UserAction { viewProfile, block, report }
