import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/providers/likes_provider.dart';
import '../../core/providers/subscription_provider.dart';

// ── Plan product IDs ──────────────────────────────────────────────────────────

const _kWeeklyId = 'gaymeet_premium_weekly';
const _kMonthlyId = 'gaymeet_premium_monthly';
const _kYearlyId = 'gaymeet_premium_yearly';

class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen> {
  String _selectedPlan = _kMonthlyId; // RM19/month is primary

  @override
  void initState() {
    super.initState();
    // Fetch likes count for the social proof section
    Future.microtask(() => ref.read(likesProvider.notifier).fetchLikes());
  }

  Future<void> _purchase() async {
    final ok =
        await ref.read(subscriptionProvider.notifier).purchase(_selectedPlan);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Welcome to Premium! 🎉')),
      );
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Purchase failed. Please try again.')),
      );
    }
  }

  Future<void> _restore() async {
    final ok = await ref.read(subscriptionProvider.notifier).restore();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok
            ? (ref.read(subscriptionProvider).isPremium
                ? 'Premium restored!'
                : 'No active subscription found.')
            : 'Restore failed. Try again.'),
      ),
    );
    if (ok && ref.read(subscriptionProvider).isPremium) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final sub = ref.watch(subscriptionProvider);
    final likesState = ref.watch(likesProvider);
    final likers = kUseDummyData
        ? DummyData.users
        : likesState.valueOrNull ?? [];
    final likeCount = likers.length;
    final previewAvatars = likers.take(4).map((u) => u.avatarUrl).toList();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: sub.isLoading
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                _buildHeader(context),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      const SizedBox(height: 12),

                      // ── Social proof: blurred likes preview ───────────────
                      if (likeCount > 0)
                        _LikesPreviewBanner(
                          likeCount: likeCount,
                          avatarUrls: previewAvatars.cast<String?>(),
                        ),

                      const SizedBox(height: 20),

                      // ── Benefits ──────────────────────────────────────────
                      ..._benefits.map((b) => _BenefitTile(
                            icon: b.$1,
                            title: b.$2,
                            subtitle: b.$3,
                          )),

                      const SizedBox(height: 28),

                      // ── Plan selector ─────────────────────────────────────
                      // Monthly (primary, highlighted)
                      _PlanCard(
                        productId: _kMonthlyId,
                        title: 'Monthly',
                        price: 'RM19',
                        period: 'per month',
                        badge: null,
                        strikethrough: 'RM39',
                        perMonth: null,
                        selected: _selectedPlan == _kMonthlyId,
                        highlighted: true,
                        onTap: () =>
                            setState(() => _selectedPlan = _kMonthlyId),
                      ),
                      const SizedBox(height: 10),
                      // Yearly (save 60%)
                      _PlanCard(
                        productId: _kYearlyId,
                        title: 'Yearly',
                        price: 'RM99',
                        period: 'per year',
                        badge: 'Save 60%',
                        strikethrough: null,
                        perMonth: 'RM8.25 / mo',
                        selected: _selectedPlan == _kYearlyId,
                        highlighted: false,
                        onTap: () =>
                            setState(() => _selectedPlan = _kYearlyId),
                      ),
                      const SizedBox(height: 10),
                      // Weekly (impulse)
                      _PlanCard(
                        productId: _kWeeklyId,
                        title: 'Weekly',
                        price: 'RM9.90',
                        period: 'per week',
                        badge: null,
                        strikethrough: null,
                        perMonth: 'Try it out',
                        selected: _selectedPlan == _kWeeklyId,
                        highlighted: false,
                        onTap: () =>
                            setState(() => _selectedPlan = _kWeeklyId),
                      ),

                      const SizedBox(height: 28),

                      // ── CTA ───────────────────────────────────────────────
                      _GradientButton(
                        label: 'Unlock Now 🔥',
                        onTap: _purchase,
                      ),

                      const SizedBox(height: 16),
                      Center(
                        child: TextButton(
                          onPressed: _restore,
                          child: Text(
                            'Restore purchases',
                            style: TextStyle(
                              color: AppTheme.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: Text(
                          'Cancel anytime · Auto-renews · Secured by App Store',
                          style: TextStyle(
                              fontSize: 11, color: AppTheme.textHint),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      const SizedBox(height: 32),
                    ]),
                  ),
                ),
              ],
            ),
    );
  }

  SliverAppBar _buildHeader(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 220,
      pinned: true,
      backgroundColor: AppTheme.bg,
      leading: IconButton(
        icon: const Icon(Icons.close),
        onPressed: () => Navigator.of(context).pop(),
      ),
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF1E0A2E), Color(0xFF0D0D1A), Color(0xFF1A0B1E)],
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(height: 56),
              Container(
                width: 68,
                height: 68,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFFD700), Color(0xFFFFA726)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFFD700).withOpacity(0.4),
                      blurRadius: 20,
                      spreadRadius: 2,
                    )
                  ],
                ),
                child: const Icon(Icons.workspace_premium,
                    color: Colors.black, size: 38),
              ),
              const SizedBox(height: 14),
              const Text(
                'GayMeet Premium',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              ShaderMask(
                shaderCallback: (bounds) =>
                    AppColors.rainbowGradient.createShader(bounds),
                child: const Text(
                  'Unlock your full potential',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Blurred likes preview banner ──────────────────────────────────────────────

class _LikesPreviewBanner extends StatelessWidget {
  final int likeCount;
  final List<String?> avatarUrls;

  const _LikesPreviewBanner({
    required this.likeCount,
    required this.avatarUrls,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppTheme.primary.withOpacity(0.15),
            AppTheme.accent.withOpacity(0.12),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: AppTheme.primary.withOpacity(0.3), width: 1),
      ),
      child: Row(
        children: [
          // Blurred avatar stack
          SizedBox(
            width: avatarUrls.length * 26.0 + 14,
            height: 46,
            child: Stack(
              children: [
                for (var i = 0; i < avatarUrls.length; i++)
                  Positioned(
                    left: i * 26.0,
                    child: _BlurredCircle(avatarUrl: avatarUrls[i]),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '💬 $likeCount ${likeCount == 1 ? 'person' : 'people'} already liked you',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Unlock Premium to see who they are',
                  style: TextStyle(
                      fontSize: 12, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BlurredCircle extends StatelessWidget {
  final String? avatarUrl;

  const _BlurredCircle({this.avatarUrl});

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: AppTheme.surface, width: 2),
          color: AppTheme.card,
        ),
        child: avatarUrl != null
            ? ImageFiltered(
                imageFilter: ui.ImageFilter.blur(sigmaX: 9, sigmaY: 9),
                child: CachedNetworkImage(
                  imageUrl: avatarUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(color: AppTheme.card),
                  errorWidget: (_, __, ___) => Container(color: AppTheme.card),
                ),
              )
            : Icon(Icons.person_rounded, color: AppTheme.textHint, size: 22),
      ),
    );
  }
}

// ── Benefits data ─────────────────────────────────────────────────────────────

const _benefits = [
  (Icons.all_inclusive_rounded, 'Unlimited Swipes',
      'No daily limits — discover everyone around you'),
  (Icons.star_rounded, 'Super Likes',
      '5 Super Likes per day to stand out instantly'),
  (Icons.visibility_rounded, 'See Who Liked You',
      'Skip the guessing — see your admirers now'),
  (Icons.bolt_rounded, 'Weekly Profile Boost',
      'Be seen by 3× more people for 30 minutes'),
  (Icons.replay_rounded, 'Rewind Last Swipe',
      'Changed your mind? Take back your last pass'),
  (Icons.block_rounded, 'Ad-Free Experience',
      'Zero interruptions — pure connections'),
];

// ── Widgets ───────────────────────────────────────────────────────────────────

class _BenefitTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _BenefitTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              gradient: AppTheme.brandGradient,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14)),
                Text(subtitle,
                    style: TextStyle(
                        fontSize: 12, color: AppTheme.textSecondary)),
              ],
            ),
          ),
          Icon(Icons.check_circle_rounded,
              color: AppTheme.primary, size: 20),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final String productId;
  final String title;
  final String price;
  final String period;
  final String? badge;
  final String? strikethrough;
  final String? perMonth;
  final bool selected;
  final bool highlighted;
  final VoidCallback onTap;

  const _PlanCard({
    required this.productId,
    required this.title,
    required this.price,
    required this.period,
    required this.badge,
    required this.strikethrough,
    required this.perMonth,
    required this.selected,
    required this.highlighted,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected
              ? AppTheme.primary.withOpacity(0.12)
              : highlighted
                  ? AppTheme.primary.withOpacity(0.06)
                  : AppTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected
                ? AppTheme.primary
                : highlighted
                    ? AppTheme.primary.withOpacity(0.4)
                    : const Color(0xFF3A3A3A),
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            // Radio dot
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? AppTheme.primary : AppTheme.textHint,
                  width: 2,
                ),
              ),
              child: selected
                  ? Center(
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: const BoxDecoration(
                          color: AppTheme.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            // Plan info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(title,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                            color: selected
                                ? AppTheme.textPrimary
                                : AppTheme.textSecondary,
                          )),
                      if (badge != null) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            gradient: AppTheme.brandGradient,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            badge!,
                            style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: Colors.white),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (perMonth != null)
                    Text(perMonth!,
                        style: TextStyle(
                            fontSize: 11, color: AppTheme.textHint)),
                ],
              ),
            ),
            // Price + strikethrough
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    if (strikethrough != null) ...[
                      Text(
                        strikethrough!,
                        style: TextStyle(
                          fontSize: 12,
                          color: AppTheme.textHint,
                          decoration: TextDecoration.lineThrough,
                          decorationColor: AppTheme.textHint,
                        ),
                      ),
                      const SizedBox(width: 5),
                    ],
                    Text(price,
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                          color: selected
                              ? AppTheme.textPrimary
                              : AppTheme.textSecondary,
                        )),
                  ],
                ),
                Text(period,
                    style: TextStyle(
                        fontSize: 10, color: AppTheme.textHint)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _GradientButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _GradientButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 56,
        decoration: BoxDecoration(
          gradient: AppTheme.brandGradient,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primary.withOpacity(0.4),
              blurRadius: 16,
              offset: const Offset(0, 6),
            )
          ],
        ),
        child: const Center(
          child: Text(
            'Unlock Now 🔥',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ),
    );
  }
}
