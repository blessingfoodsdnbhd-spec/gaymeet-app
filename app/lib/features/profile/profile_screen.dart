import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/models/user.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/boost_provider.dart';
import '../../core/providers/follow_provider.dart';
import '../../core/providers/subscription_provider.dart';
import '../../shared/widgets/design_system/rainbow_border.dart';
import '../../shared/widgets/looking_for_badge.dart';
import 'package:dio/dio.dart';
import '../../core/providers/conversations_provider.dart';
import 'looking_for_sheet.dart';
import 'private_photos_section.dart';
import 'public_qa_section.dart';

class ProfileScreen extends ConsumerWidget {
  /// When null, shows the current logged-in user's own profile.
  /// When provided, shows another user's profile with follow/action buttons.
  final UserModel? viewedUser;

  const ProfileScreen({super.key, this.viewedUser});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentUser = kUseDummyData
        ? DummyData.currentUser
        : ref.watch(authStateProvider).user;

    final user = viewedUser ?? currentUser;
    if (user == null) return const Center(child: CircularProgressIndicator());

    final isOwnProfile =
        viewedUser == null || user.id == (currentUser?.id ?? '');
    final sub = ref.watch(subscriptionProvider);
    final boost = ref.watch(boostProvider);

    // Follow state (only relevant when viewing others)
    final followState =
        !isOwnProfile ? ref.watch(followProvider(user.id)) : null;

    return Scaffold(
      appBar: AppBar(
        title: Text(isOwnProfile ? 'Profile' : user.nickname),
        actions: isOwnProfile
            ? [
                IconButton(
                  icon: const Icon(Icons.settings_rounded, size: 22),
                  onPressed: () => context.push('/settings'),
                ),
              ]
            : null,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Photo strip / avatar ─────────────────────────────────────────
            if (user.photos.isNotEmpty) ...[
              _PhotoStrip(photos: user.photos),
              const SizedBox(height: 20),
            ] else ...[
              Center(
                child: RainbowBorder(
                  borderWidth: 3,
                  borderRadius: 60,
                  child: CircleAvatar(
                    radius: 52,
                    backgroundImage: user.avatarUrl != null
                        ? CachedNetworkImageProvider(user.avatarUrl!)
                        : null,
                    backgroundColor: AppColors.bgSurface,
                    child: user.avatarUrl == null
                        ? const Icon(Icons.person_rounded,
                            size: 48, color: AppColors.textHint)
                        : null,
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // ── Name + verified + level + boost ──────────────────────────────
            Center(
              child: Column(
                children: [
                  if (isOwnProfile && boost.isBoostActive) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFFD740), Color(0xFFFF9800)],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.boost.withValues(alpha: 0.4),
                            blurRadius: 12,
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.bolt_rounded,
                              size: 14, color: Colors.black),
                          SizedBox(width: 4),
                          Text('BOOSTED 🔥',
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.black)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(user.nickname,
                          style: const TextStyle(
                              fontSize: 24, fontWeight: FontWeight.w800)),
                      if (user.isVerified) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.verified_rounded,
                            size: 22, color: Color(0xFF1976D2)),
                      ],
                    ],
                  ),
                  if (isOwnProfile) ...[
                    if (user.lookingFor != null) ...[
                      const SizedBox(height: 8),
                      GestureDetector(
                        onTap: () => showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) =>
                              LookingForSheet(current: user.lookingFor),
                        ),
                        child: LookingForBadge(status: user.lookingFor!),
                      ),
                    ] else ...[
                      const SizedBox(height: 8),
                      GestureDetector(
                        onTap: () => showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          backgroundColor: Colors.transparent,
                          builder: (_) => const LookingForSheet(),
                        ),
                        child: Text('+ 设置正在找',
                            style: TextStyle(
                                color: AppTheme.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ] else if (user.lookingFor != null) ...[
                    const SizedBox(height: 8),
                    LookingForBadge(status: user.lookingFor!),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ── Stats row ─────────────────────────────────────────────────────
            _StatsRow(user: user, isOwnProfile: isOwnProfile),

            const SizedBox(height: 16),

            // ── VIP Banner ────────────────────────────────────────────────────
            _VipBanner(
              isPremium: isOwnProfile ? sub.isPremium : user.isPremium,
              premiumExpiresAt: user.premiumExpiresAt,
            ),

            // ── Bio ───────────────────────────────────────────────────────────
            if (user.bio != null && user.bio!.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(user.bio!,
                    style: const TextStyle(fontSize: 15, height: 1.5)),
              ),
            ],

            // ── Tags ──────────────────────────────────────────────────────────
            if (user.tags.isNotEmpty) ...[
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: user.tags.map((tag) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(tag,
                        style: TextStyle(
                            fontSize: 13,
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w500)),
                  );
                }).toList(),
              ),
            ],

            const SizedBox(height: 28),

            // ── Action buttons ─────────────────────────────────────────────────
            if (isOwnProfile)
              _OwnProfileActions()
            else
              _OtherProfileActions(
                user: user,
                followState: followState,
                onFollowTap: () =>
                    ref.read(followProvider(user.id).notifier).toggle(),
              ),


            // ── Private Photos (own profile only) ─────────────────────────────
            const SizedBox(height: 32),
            PrivatePhotosSection(
              userId: user.id,
              isOwnProfile: isOwnProfile,
              privatePhotoCount: user.privatePhotos.length,
            ),

            // ── Public Q&A ────────────────────────────────────────────────────
            const SizedBox(height: 24),
            PublicQASection(userId: user.id),
          ],
        ),
      ),
    );
  }
}

// ── Stats row ─────────────────────────────────────────────────────────────────

class _StatsRow extends ConsumerWidget {
  final UserModel user;
  final bool isOwnProfile;
  const _StatsRow({required this.user, required this.isOwnProfile});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    String fmtNum(int n) {
      if (n >= 10000) return '${(n / 10000).toStringAsFixed(1)}w';
      if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}k';
      return n.toString();
    }

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          _StatBox(
            value: fmtNum(user.followingCount),
            label: '关注',
            onTap: () => context.push('/following/${user.id}'),
          ),
          _StatDivider(),
          _StatBox(
            value: fmtNum(user.followersCount),
            label: '粉丝',
            onTap: () => context.push('/followers/${user.id}'),
          ),
          _StatDivider(),
          _StatBox(
            value: fmtNum(user.totalLikesReceived),
            label: '获赞',
          ),
          _StatDivider(),
          _StatBox(
            value: fmtNum(user.profileViews),
            label: isOwnProfile ? '访客' : '人气',
          ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String value;
  final String label;
  final VoidCallback? onTap;
  const _StatBox({required this.value, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: onTap != null ? AppTheme.primary : AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: AppTheme.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 28,
      color: AppColors.bgCard,
    );
  }
}

// ── VIP banner ────────────────────────────────────────────────────────────────

class _VipBanner extends StatelessWidget {
  final bool isPremium;
  final DateTime? premiumExpiresAt;
  const _VipBanner({required this.isPremium, this.premiumExpiresAt});

  @override
  Widget build(BuildContext context) {
    if (isPremium) {
      // Show active VIP badge with expiry
      String expiryLabel = 'VIP会员';
      if (premiumExpiresAt != null) {
        final d = premiumExpiresAt!;
        expiryLabel =
            'VIP会员 · 到期 ${d.year}/${d.month.toString().padLeft(2, '0')}/${d.day.toString().padLeft(2, '0')}';
      }
      return Container(
        width: double.infinity,
        padding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF2A1F00), Color(0xFF3D2E00)],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: const Color(0xFFFFD700).withValues(alpha: 0.4), width: 1),
        ),
        child: Row(
          children: [
            const Text('👑', style: TextStyle(fontSize: 18)),
            const SizedBox(width: 10),
            Text(
              expiryLabel,
              style: const TextStyle(
                color: Color(0xFFFFD700),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    // Non-premium: upgrade CTA
    return GestureDetector(
      onTap: () => context.push('/premium'),
      child: Container(
        width: double.infinity,
        padding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFB8860B), Color(0xFFFFD700), Color(0xFFB8860B)],
            stops: [0.0, 0.5, 1.0],
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFFFD700).withValues(alpha: 0.25),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            const Text('👑', style: TextStyle(fontSize: 20)),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '升级VIP，解锁更多特权',
                    style: TextStyle(
                      color: Colors.black,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    '无限滑动 · 超级喜欢 · 隐身模式',
                    style: TextStyle(
                      color: Colors.black54,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded,
                size: 14, color: Colors.black54),
          ],
        ),
      ),
    );
  }
}

// ── Own profile actions ───────────────────────────────────────────────────────

class _OwnProfileActions extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _ActionBtn(
            icon: Icons.edit_rounded,
            label: '编辑资料',
            onTap: () => context.push('/profile/edit'),
            primary: true,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ActionBtn(
            icon: Icons.account_balance_wallet_rounded,
            label: '我的钱包',
            onTap: () => context.push('/wallet'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _ActionBtn(
            icon: Icons.settings_rounded,
            label: '设置',
            onTap: () => context.push('/settings'),
          ),
        ),
      ],
    );
  }
}

// ── Other user profile actions ────────────────────────────────────────────────

class _OtherProfileActions extends ConsumerWidget {
  final UserModel user;
  final FollowState? followState;
  final VoidCallback onFollowTap;

  const _OtherProfileActions({
    required this.user,
    required this.followState,
    required this.onFollowTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFollowing = followState?.isFollowing ?? false;
    final isLoadingFollow = followState?.isLoading ?? false;

    return Column(
      children: [
        Row(
          children: [
            // Follow / Unfollow (wider)
            Expanded(
              flex: 2,
              child: _FollowBtn(
                isFollowing: isFollowing,
                isLoading: isLoadingFollow,
                onTap: onFollowTap,
              ),
            ),
            const SizedBox(width: 8),
            // Private message
            Expanded(
              child: _ActionBtn(
                icon: Icons.chat_bubble_rounded,
                label: '私信',
                onTap: () => _openDm(context, ref, user),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ── Open DM conversation ──────────────────────────────────────────────────────

Future<void> _openDm(
    BuildContext context, WidgetRef ref, UserModel user) async {
  try {
    final result = await ref
        .read(conversationsProvider.notifier)
        .openConversation(user.id);

    if (!context.mounted) return;

    context.push('/chat/${result.matchId}', extra: {
      'userId': user.id,
      'userName': user.nickname,
      'userAvatar': user.avatarUrl,
    });
  } on DioException catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('操作失败，请重试')));
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('操作失败，请重试')));
  }
}

// ── Follow button ─────────────────────────────────────────────────────────────

class _FollowBtn extends StatelessWidget {
  final bool isFollowing;
  final bool isLoading;
  final VoidCallback onTap;

  const _FollowBtn({
    required this.isFollowing,
    required this.isLoading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: isLoading ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isFollowing ? Colors.transparent : AppTheme.primary,
          borderRadius: BorderRadius.circular(12),
          border: isFollowing
              ? Border.all(color: AppTheme.primary.withValues(alpha: 0.6))
              : null,
        ),
        child: isLoading
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color:
                        isFollowing ? AppTheme.primary : Colors.white),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isFollowing
                        ? Icons.person_remove_rounded
                        : Icons.person_add_rounded,
                    size: 16,
                    color: isFollowing ? AppTheme.primary : Colors.white,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    isFollowing ? '已关注' : '关注',
                    style: TextStyle(
                      color:
                          isFollowing ? AppTheme.primary : Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

// ── Generic action button ─────────────────────────────────────────────────────

class _ActionBtn extends StatelessWidget {
  final IconData? icon;
  final String label;
  final VoidCallback? onTap;
  final bool primary;

  const _ActionBtn({
    this.icon,
    required this.label,
    required this.onTap,
    this.primary = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: primary
              ? AppTheme.primary.withValues(alpha: 0.12)
              : AppTheme.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.bgCard, width: 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null)
              Icon(icon!, size: 16, color: primary ? AppTheme.primary : AppTheme.textPrimary),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: primary ? AppTheme.primary : AppTheme.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Photo strip ───────────────────────────────────────────────────────────────

class _PhotoStrip extends StatefulWidget {
  final List<String> photos;
  const _PhotoStrip({required this.photos});

  @override
  State<_PhotoStrip> createState() => _PhotoStripState();
}

class _PhotoStripState extends State<_PhotoStrip> {
  late final PageController _pageController;
  int _current = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final photos = widget.photos;

    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: AspectRatio(
            aspectRatio: 3 / 4,
            child: PageView.builder(
              controller: _pageController,
              itemCount: photos.length,
              onPageChanged: (i) => setState(() => _current = i),
              itemBuilder: (_, i) => CachedNetworkImage(
                imageUrl: photos[i],
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(color: AppTheme.card),
                errorWidget: (_, __, ___) => Container(
                  color: AppTheme.card,
                  child: const Icon(Icons.person_rounded,
                      size: 80, color: Color(0xFF3A3A3A)),
                ),
              ),
            ),
          ),
        ),
        if (photos.length > 1) ...[
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(photos.length, (i) {
              final active = i == _current;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: active ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(3),
                  color: active
                      ? AppTheme.primary
                      : AppTheme.primary.withValues(alpha: 0.25),
                ),
              );
            }),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 60,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: photos.length,
              itemBuilder: (_, i) {
                final selected = i == _current;
                return GestureDetector(
                  onTap: () {
                    _pageController.animateToPage(
                      i,
                      duration: const Duration(milliseconds: 250),
                      curve: Curves.easeInOut,
                    );
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 60,
                    height: 60,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: selected
                            ? AppTheme.primary
                            : Colors.transparent,
                        width: 2,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: photos[i],
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}
