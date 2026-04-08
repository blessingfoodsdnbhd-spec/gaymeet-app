import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_card_swiper/flutter_card_swiper.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/providers/boost_provider.dart';
import '../../core/providers/filter_provider.dart';
import '../../core/providers/match_provider.dart';
import '../../core/providers/subscription_provider.dart';
import '../../core/providers/user_provider.dart';
import '../../core/models/user.dart';
import '../../core/providers/promotion_provider.dart';
import '../../shared/widgets/filter_sheet.dart';
import '../../shared/widgets/promo_banner.dart';
import 'widgets/user_card.dart';

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  final CardSwiperController _swipeCtrl = CardSwiperController();
  late List<UserModel> _users;
  String? _matchOverlayName;

  @override
  void initState() {
    super.initState();
    if (kUseDummyData) {
      _users = List.from(DummyData.users);
    } else {
      Future.microtask(() {
        final filter = ref.read(filterProvider);
        ref
            .read(discoverUsersProvider.notifier)
            .fetchDiscoverUsers(filter: filter);
      });
    }
  }

  @override
  void dispose() {
    _swipeCtrl.dispose();
    super.dispose();
  }

  // ── Swipe handler ─────────────────────────────────────────────────────────

  bool _onSwipe(int index, CardSwiperDirection dir) {
    if (index >= _users.length) return true;

    final sub = ref.read(subscriptionProvider);

    // Super-like gate (top swipe)
    if (dir == CardSwiperDirection.top) {
      if (!sub.canSuperLike) {
        _showSuperLikeUpsellSheet();
        return false;
      }
      ref.read(subscriptionProvider.notifier).recordSuperLike();
    } else {
      // Like / pass gate
      if (!sub.canSwipe) {
        _showSwipeLimitSheet();
        return false;
      }
      ref.read(subscriptionProvider.notifier).recordSwipe();

      // Check if this was the last free swipe → full-screen modal
      final updated = ref.read(subscriptionProvider);
      if (!updated.isPremium && !updated.canSwipe) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _showSwipeLimitFullScreen();
        });
      }
    }

    final user = _users[index];
    final direction = dir == CardSwiperDirection.right
        ? 'like'
        : dir == CardSwiperDirection.top
            ? 'super_like'
            : 'pass';

    if (!kUseDummyData) {
      ref.read(matchesProvider.notifier).swipe(user.id, direction);
    }

    // Simulate match on 3rd like (for demo)
    if (kUseDummyData && direction == 'like' && index == 1) {
      setState(() => _matchOverlayName = user.nickname);
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) setState(() => _matchOverlayName = null);
      });
    }

    return true;
  }

  // ── Boost sheet ───────────────────────────────────────────────────────────

  void _handleBoostTap() {
    final sub = ref.read(subscriptionProvider);
    final boost = ref.read(boostProvider);

    if (!sub.isPremium) {
      _showBoostUpsellSheet();
      return;
    }
    if (boost.isBoostActive) {
      _showBoostActiveSheet();
      return;
    }
    if (!boost.weeklyBoostAvailable) {
      _showBoostUsedSheet();
      return;
    }
    _showBoostConfirmSheet();
  }

  void _showBoostUpsellSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => _BottomSheetBody(
        icon: Icons.bolt_rounded,
        iconColor: AppTheme.boost,
        title: 'Boost is Premium only',
        subtitle:
            'Boost your profile to be seen by\n3× more people for 30 minutes.',
        primaryLabel: 'Unlock Boost',
        onPrimary: () {
          Navigator.pop(ctx);
          context.push('/premium');
        },
        onSecondary: () => Navigator.pop(ctx),
      ),
    );
  }

  void _showBoostConfirmSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => _BottomSheetBody(
        icon: Icons.bolt_rounded,
        iconColor: AppTheme.boost,
        title: 'Boost your profile',
        subtitle:
            'You\'ll be shown to 3× more people\nfor 30 minutes. Use your free weekly boost?',
        primaryLabel: 'Boost Now 🔥',
        onPrimary: () {
          Navigator.pop(ctx);
          ref.read(boostProvider.notifier).activateBoost();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Profile boosted for 30 minutes! 🔥'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        },
        onSecondary: () => Navigator.pop(ctx),
      ),
    );
  }

  void _showBoostActiveSheet() {
    final boost = ref.read(boostProvider);
    final remaining = boost.remaining;
    final mins = remaining != null ? remaining.inMinutes : 0;
    final secs = remaining != null ? remaining.inSeconds % 60 : 0;

    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => _BottomSheetBody(
        icon: Icons.bolt_rounded,
        iconColor: AppTheme.boost,
        title: 'Boost Active! 🔥',
        subtitle:
            'Your profile is boosted for ${mins}m ${secs}s more.\nSit back and watch the likes roll in.',
        primaryLabel: 'Got it',
        onPrimary: () => Navigator.pop(ctx),
        onSecondary: null,
      ),
    );
  }

  void _showBoostUsedSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => _BottomSheetBody(
        icon: Icons.bolt_rounded,
        iconColor: AppTheme.textHint,
        title: 'Boost used this week',
        subtitle:
            'Your free weekly boost resets every 7 days.\nCheck back next week!',
        primaryLabel: 'Got it',
        onPrimary: () => Navigator.pop(ctx),
        onSecondary: null,
      ),
    );
  }

  // ── Swipe limit sheets ────────────────────────────────────────────────────

  void _showSwipeLimitSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => _BottomSheetBody(
        icon: Icons.lock_rounded,
        iconColor: AppTheme.primary,
        title: "You've used all your free swipes",
        subtitle:
            'Free users get $kFreeSwipesPerDay swipes per day.\nUpgrade for unlimited swipes.',
        primaryLabel: 'Upgrade to Premium',
        onPrimary: () {
          Navigator.pop(ctx);
          context.push('/premium');
        },
        onSecondary: () => Navigator.pop(ctx),
      ),
    );
  }

  void _showSwipeLimitFullScreen() {
    showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black87,
      transitionDuration: const Duration(milliseconds: 350),
      transitionBuilder: (ctx, animation, _, child) {
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 1),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          )),
          child: child,
        );
      },
      pageBuilder: (ctx, _, __) => _SwipeLimitFullScreen(
        onUpgrade: () {
          Navigator.pop(ctx);
          context.push('/premium');
        },
        onDismiss: () => Navigator.pop(ctx),
      ),
    );
  }

  void _showSuperLikeUpsellSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => _BottomSheetBody(
        icon: Icons.star_rounded,
        iconColor: AppTheme.boost,
        title: 'Super Likes are Premium only',
        subtitle:
            'Stand out from the crowd with up to\n$kPremiumSuperLikesPerDay Super Likes per day.',
        primaryLabel: 'Unlock Super Likes',
        onPrimary: () {
          Navigator.pop(ctx);
          context.push('/premium');
        },
        onSecondary: () => Navigator.pop(ctx),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    // Re-fetch whenever the active filter changes
    ref.listen<DiscoveryFilter>(filterProvider, (_, filter) {
      if (!kUseDummyData) {
        ref
            .read(discoverUsersProvider.notifier)
            .fetchDiscoverUsers(filter: filter);
      }
    });

    final users = kUseDummyData
        ? _users
        : ref.watch(discoverUsersProvider).valueOrNull ?? [];

    final sub = ref.watch(subscriptionProvider);
    final boost = ref.watch(boostProvider);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                gradient: AppTheme.brandGradient,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.favorite_rounded,
                  size: 16, color: Colors.white),
            ),
            const SizedBox(width: 8),
            const Text('Discover'),
          ],
        ),
        actions: [
          // Secret code button
          IconButton(
            icon: const Text('🔮', style: TextStyle(fontSize: 18)),
            tooltip: '暗号匹配',
            onPressed: () => context.push('/secret-code'),
          ),
          // Boost button
          _BoostButton(
            isActive: boost.isBoostActive,
            isPremium: sub.isPremium,
            onTap: _handleBoostTap,
          ),
          FilterIconButton(
            onTap: () => showFilterSheet(context),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Stack(
        children: [
          if (users.isEmpty)
            _buildEmpty()
          else
            Column(
              children: [
                // Active boost indicator
                if (boost.isBoostActive)
                  _BoostCountdownBar(expiresAt: boost.boostExpiresAt!),

                // Free swipe counter
                if (!sub.isPremium && !boost.isBoostActive)
                  _SwipeCounterBar(
                    used: sub.swipesUsedToday,
                    total: kFreeSwipesPerDay,
                    onUpgrade: () => context.push('/premium'),
                  ),

                // Swipe area
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                    child: CardSwiper(
                      controller: _swipeCtrl,
                      cardsCount: users.length,
                      numberOfCardsDisplayed: users.length.clamp(1, 2),
                      backCardOffset: const Offset(0, -30),
                      scale: 0.95,
                      padding: EdgeInsets.zero,
                      onSwipe: (prev, curr, dir) => _onSwipe(prev, dir),
                      cardBuilder: (context, index, percentX, percentY) {
                        return UserCard(
                          user: users[index],
                          swipeProgress: percentX / 100,
                        );
                      },
                    ),
                  ),
                ),

                // Promo banner (shown when active promotion exists)
                if (ref.watch(promotionProvider).bannerPromotions.isNotEmpty)
                  const PromoBanner(),

                // Action buttons
                Padding(
                  padding: const EdgeInsets.fromLTRB(40, 16, 40, 24),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _ActionBtn(
                        icon: Icons.close_rounded,
                        color: AppTheme.error,
                        size: 56,
                        locked: !sub.canSwipe,
                        onTap: () {
                          if (!sub.canSwipe) {
                            _showSwipeLimitSheet();
                          } else {
                            _swipeCtrl.swipe(CardSwiperDirection.left);
                          }
                        },
                      ),
                      _ActionBtn(
                        icon: Icons.star_rounded,
                        color: AppTheme.boost,
                        size: 44,
                        locked: !sub.isPremium,
                        onTap: () {
                          if (!sub.isPremium) {
                            _showSuperLikeUpsellSheet();
                          } else if (!sub.canSuperLike) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text(
                                      'No Super Likes remaining today.')),
                            );
                          } else {
                            _swipeCtrl.swipe(CardSwiperDirection.top);
                          }
                        },
                      ),
                      _ActionBtn(
                        icon: Icons.favorite_rounded,
                        color: AppTheme.primary,
                        size: 56,
                        locked: !sub.canSwipe,
                        onTap: () {
                          if (!sub.canSwipe) {
                            _showSwipeLimitSheet();
                          } else {
                            _swipeCtrl.swipe(CardSwiperDirection.right);
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),

          // Match overlay
          if (_matchOverlayName != null) _buildMatchOverlay(),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    final filterActive = ref.watch(filterProvider).activeCount > 0;

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
              child: Icon(Icons.explore_off_rounded,
                  size: 36, color: AppTheme.textHint),
            ),
            const SizedBox(height: 20),
            const Text('No one found',
                style:
                    TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(
              filterActive
                  ? 'Try adjusting your filters\nor expanding your search radius.'
                  : 'Try expanding your search radius\nor check back later.',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 14,
                  height: 1.5),
            ),
            if (filterActive) ...[
              const SizedBox(height: 20),
              OutlinedButton.icon(
                onPressed: () =>
                    ref.read(filterProvider.notifier).reset(),
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Reset filters'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildMatchOverlay() {
    return AnimatedOpacity(
      opacity: 1.0,
      duration: const Duration(milliseconds: 300),
      child: Container(
        color: Colors.black87,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.favorite_rounded,
                  size: 80, color: AppTheme.primary),
              const SizedBox(height: 16),
              ShaderMask(
                shaderCallback: (bounds) =>
                    AppTheme.brandGradient.createShader(bounds),
                child: const Text(
                  "It's a Match!",
                  style: TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'You and $_matchOverlayName liked each other',
                style: const TextStyle(
                    color: Colors.white70, fontSize: 16),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Boost button (AppBar) ─────────────────────────────────────────────────────

class _BoostButton extends StatelessWidget {
  final bool isActive;
  final bool isPremium;
  final VoidCallback onTap;

  const _BoostButton({
    required this.isActive,
    required this.isPremium,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            gradient: isActive ? const LinearGradient(
              colors: [Color(0xFFFFD740), Color(0xFFFF9800)],
            ) : null,
            color: isActive ? null : AppTheme.card,
            borderRadius: BorderRadius.circular(10),
            border: isActive
                ? null
                : Border.all(
                    color: isPremium
                        ? AppTheme.boost.withOpacity(0.5)
                        : AppTheme.textHint.withOpacity(0.3),
                    width: 1,
                  ),
          ),
          child: Icon(
            Icons.bolt_rounded,
            size: 20,
            color: isActive
                ? Colors.black
                : isPremium
                    ? AppTheme.boost
                    : AppTheme.textHint,
          ),
        ),
      ),
    );
  }
}

// ── Boost countdown bar ───────────────────────────────────────────────────────

class _BoostCountdownBar extends StatefulWidget {
  final DateTime expiresAt;
  const _BoostCountdownBar({required this.expiresAt});

  @override
  State<_BoostCountdownBar> createState() => _BoostCountdownBarState();
}

class _BoostCountdownBarState extends State<_BoostCountdownBar> {
  late Timer _timer;
  late Duration _remaining;

  @override
  void initState() {
    super.initState();
    _remaining = widget.expiresAt.difference(DateTime.now());
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _remaining = widget.expiresAt.difference(DateTime.now());
        if (_remaining.isNegative) {
          _remaining = Duration.zero;
          _timer.cancel();
        }
      });
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mins = _remaining.inMinutes;
    final secs = _remaining.inSeconds % 60;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2A1F00), Color(0xFF1A1000)],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.boost.withOpacity(0.4), width: 1),
      ),
      child: Row(
        children: [
          const Icon(Icons.bolt_rounded, color: AppTheme.boost, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'BOOSTED 🔥 — Profile visible to 3× more people',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppTheme.boost,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppTheme.boost.withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppTheme.boost,
                fontFeatures: [ui.FontFeature.tabularFigures()],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Swipe counter bar ─────────────────────────────────────────────────────────

class _SwipeCounterBar extends StatelessWidget {
  final int used;
  final int total;
  final VoidCallback onUpgrade;

  const _SwipeCounterBar({
    required this.used,
    required this.total,
    required this.onUpgrade,
  });

  @override
  Widget build(BuildContext context) {
    final remaining = (total - used).clamp(0, total);
    final fraction = remaining / total;
    final isLow = remaining <= 5;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$remaining swipes left today',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color:
                        isLow ? AppTheme.error : AppTheme.textSecondary,
                  ),
                ),
                const SizedBox(height: 5),
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: fraction,
                    backgroundColor: AppTheme.surface,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      isLow ? AppTheme.error : AppTheme.primary,
                    ),
                    minHeight: 4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: onUpgrade,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                gradient: AppTheme.brandGradient,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'Upgrade',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Action button ─────────────────────────────────────────────────────────────

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;
  final bool locked;
  final VoidCallback onTap;

  const _ActionBtn({
    required this.icon,
    required this.color,
    this.size = 52,
    this.locked = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppTheme.card,
              border: Border.all(
                color: locked
                    ? AppTheme.textHint.withOpacity(0.3)
                    : color.withOpacity(0.4),
                width: 2,
              ),
              boxShadow: locked
                  ? []
                  : [
                      BoxShadow(
                        color: color.withOpacity(0.15),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
            ),
            child: Icon(
              icon,
              color: locked ? AppTheme.textHint : color,
              size: size * 0.45,
            ),
          ),
          if (locked)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 18,
                height: 18,
                decoration: const BoxDecoration(
                  color: AppTheme.card,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.lock_rounded,
                    size: 11, color: AppTheme.textHint),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Reusable bottom sheet body ────────────────────────────────────────────────

class _BottomSheetBody extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String primaryLabel;
  final VoidCallback onPrimary;
  final VoidCallback? onSecondary;

  const _BottomSheetBody({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.primaryLabel,
    required this.onPrimary,
    required this.onSecondary,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 5,
            decoration: BoxDecoration(
              color: AppTheme.textHint,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(height: 24),
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(icon, color: iconColor, size: 32),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: TextStyle(color: AppTheme.textSecondary, height: 1.5),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 28),
          _GradientButton(label: primaryLabel, onTap: onPrimary),
          if (onSecondary != null) ...[
            const SizedBox(height: 12),
            TextButton(
              onPressed: onSecondary,
              child: Text('Maybe later',
                  style: TextStyle(color: AppTheme.textSecondary)),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Full-screen swipe limit modal ─────────────────────────────────────────────

class _SwipeLimitFullScreen extends StatelessWidget {
  final VoidCallback onUpgrade;
  final VoidCallback onDismiss;

  const _SwipeLimitFullScreen({
    required this.onUpgrade,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppTheme.bg,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Sad emoji / icon
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      AppTheme.primary.withOpacity(0.15),
                      AppTheme.accent.withOpacity(0.1),
                    ],
                  ),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Text('😢', style: TextStyle(fontSize: 48)),
                ),
              ),
              const SizedBox(height: 32),
              const Text(
                'No more swipes today',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'You\'ve used all $kFreeSwipesPerDay free swipes for today.\nUpgrade to Premium for unlimited swipes and keep finding your person.',
                style: TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 15,
                  height: 1.6,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              // Benefits callouts
              ...[
                ('♾️', 'Unlimited swipes every day'),
                ('⭐', 'Super Likes to stand out'),
                ('👀', 'See who already liked you'),
                ('⚡', 'Weekly profile boost'),
              ].map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        Text(item.$1,
                            style: const TextStyle(fontSize: 22)),
                        const SizedBox(width: 14),
                        Text(item.$2,
                            style: const TextStyle(fontSize: 15)),
                      ],
                    ),
                  )),
              const SizedBox(height: 32),
              _GradientButton(
                label: 'Unlock Now 🔥',
                onTap: onUpgrade,
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: onDismiss,
                child: Text(
                  'Come back tomorrow',
                  style: TextStyle(color: AppTheme.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Gradient button (shared) ──────────────────────────────────────────────────

class _GradientButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _GradientButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        height: 52,
        decoration: BoxDecoration(
          gradient: AppTheme.brandGradient,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primary.withOpacity(0.35),
              blurRadius: 14,
              offset: const Offset(0, 5),
            )
          ],
        ),
        child: Center(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}

