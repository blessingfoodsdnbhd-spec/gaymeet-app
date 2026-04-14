import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/providers/likes_provider.dart';
import '../../core/providers/subscription_provider.dart';

// ── Plan IDs (must match backend) ─────────────────────────────────────────────

const _kWeeklyId  = 'weekly';
const _kMonthlyId = 'monthly';
const _kYearlyId  = 'yearly';

class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen>
    with SingleTickerProviderStateMixin {
  String _selectedPlan = _kMonthlyId;
  late final AnimationController _shimmer;

  @override
  void initState() {
    super.initState();
    _shimmer = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
    Future.microtask(() => ref.read(likesProvider.notifier).fetchLikes());
  }

  @override
  void dispose() {
    _shimmer.dispose();
    super.dispose();
  }

  Future<void> _purchase() async {
    final ok =
        await ref.read(subscriptionProvider.notifier).purchase(_selectedPlan);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok
            ? 'Welcome to Premium! ✨'
            : 'Purchase failed. Please try again.'),
        backgroundColor: ok ? AppTheme.primary : AppColors.error,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
    if (ok && mounted) Navigator.of(context).pop();
  }

  Future<void> _restore() async {
    final ok = await ref.read(subscriptionProvider.notifier).restore();
    if (!mounted) return;
    final isPremium = ref.read(subscriptionProvider).isPremium;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok
            ? (isPremium ? 'Premium restored! ✅' : 'No active subscription found.')
            : 'Restore failed. Try again.'),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
    if (ok && isPremium && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final sub = ref.watch(subscriptionProvider);
    final likesState = ref.watch(likesProvider);
    final likers = kUseDummyData ? DummyData.users : (likesState.valueOrNull ?? []);
    final likeCount = likers.length;
    final previewAvatars = likers.take(5).map((u) => u.avatarUrl).toList();

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: sub.isLoading
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                _buildAppBar(context, sub.isPremium),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // ── Already premium card ─────────────────────────────
                        if (sub.isPremium) ...[
                          const SizedBox(height: 20),
                          _ActivePremiumCard(sub: sub),
                        ],

                        // ── Blurred likes preview ────────────────────────────
                        if (likeCount > 0 && !sub.isPremium) ...[
                          const SizedBox(height: 20),
                          _LikesPreviewBanner(
                            likeCount: likeCount,
                            avatarUrls: previewAvatars.cast<String?>(),
                          ),
                        ],

                        const SizedBox(height: 24),

                        // ── Benefits ─────────────────────────────────────────
                        const _SectionLabel('What you unlock'),
                        const SizedBox(height: 12),
                        ..._benefits.map((b) => _BenefitRow(
                              icon: b.$1,
                              title: b.$2,
                              subtitle: b.$3,
                            )),

                        const SizedBox(height: 28),

                        // ── Plan selector ─────────────────────────────────────
                        const _SectionLabel('Choose your plan'),
                        const SizedBox(height: 12),
                        _PlanCard(
                          id: _kYearlyId,
                          title: 'Yearly',
                          price: 'RM99.90',
                          period: 'per year',
                          badge: 'Save 58%',
                          subtext: 'RM8.33 / month',
                          selected: _selectedPlan == _kYearlyId,
                          highlighted: false,
                          onTap: () => setState(() => _selectedPlan = _kYearlyId),
                        ),
                        const SizedBox(height: 10),
                        _PlanCard(
                          id: _kMonthlyId,
                          title: 'Monthly',
                          price: 'RM19.90',
                          period: 'per month',
                          badge: 'Most Popular',
                          subtext: null,
                          selected: _selectedPlan == _kMonthlyId,
                          highlighted: true,
                          onTap: () => setState(() => _selectedPlan = _kMonthlyId),
                        ),
                        const SizedBox(height: 10),
                        _PlanCard(
                          id: _kWeeklyId,
                          title: 'Weekly',
                          price: 'RM9.90',
                          period: 'per week',
                          badge: null,
                          subtext: 'Try it out',
                          selected: _selectedPlan == _kWeeklyId,
                          highlighted: false,
                          onTap: () => setState(() => _selectedPlan = _kWeeklyId),
                        ),

                        const SizedBox(height: 28),

                        // ── CTA ───────────────────────────────────────────────
                        _GradientCTAButton(
                          label: sub.isPremium
                              ? 'Extend Subscription'
                              : 'Unlock Premium ✨',
                          onTap: _purchase,
                          shimmer: _shimmer,
                        ),

                        const SizedBox(height: 14),
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
                        const SizedBox(height: 4),
                        const Center(
                          child: Text(
                            'Cancel anytime  ·  Auto-renews  ·  Secured by App Store',
                            style: TextStyle(
                              fontSize: 11,
                              color: AppColors.textHint,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  SliverAppBar _buildAppBar(BuildContext context, bool isPremium) {
    return SliverAppBar(
      expandedHeight: 230,
      pinned: true,
      backgroundColor: AppTheme.bg,
      leading: IconButton(
        icon: const Icon(Icons.close_rounded),
        onPressed: () => Navigator.of(context).pop(),
      ),
      flexibleSpace: FlexibleSpaceBar(
        background: _PremiumHeader(isPremium: isPremium, shimmer: _shimmer),
      ),
    );
  }
}

// ── Premium header ────────────────────────────────────────────────────────────

class _PremiumHeader extends StatelessWidget {
  final bool isPremium;
  final AnimationController shimmer;

  const _PremiumHeader({required this.isPremium, required this.shimmer});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1E0A2E), Color(0xFF0D0D1A), Color(0xFF1A0730)],
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 56),
          // Animated ring around crown
          _RainbowRingIcon(shimmer: shimmer),
          const SizedBox(height: 16),
          Text(
            isPremium ? 'You\'re Premium ✨' : 'GayMeet Premium',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          ShaderMask(
            shaderCallback: (b) =>
                AppColors.rainbowGradient.createShader(b),
            child: const Text(
              'Unlimited connections · Zero limits',
              style: TextStyle(
                fontSize: 13,
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RainbowRingIcon extends StatelessWidget {
  final AnimationController shimmer;
  const _RainbowRingIcon({required this.shimmer});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: shimmer,
      builder: (_, __) {
        return CustomPaint(
          painter: _RainbowRingPainter(progress: shimmer.value),
          child: Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFFD700), Color(0xFFFFA726)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFFFD700).withOpacity(0.35),
                  blurRadius: 24,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Icon(
              Icons.workspace_premium_rounded,
              color: Colors.black,
              size: 42,
            ),
          ),
        );
      },
    );
  }
}

class _RainbowRingPainter extends CustomPainter {
  final double progress;
  _RainbowRingPainter({required this.progress});

  static const _colors = [
    AppColors.rainbowRed,
    AppColors.rainbowOrange,
    AppColors.rainbowYellow,
    AppColors.rainbowGreen,
    AppColors.rainbowBlue,
    AppColors.rainbowViolet,
    AppColors.rainbowRed,
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 + 6;
    final rect = Rect.fromCircle(center: center, radius: radius);

    final gradient = SweepGradient(
      colors: _colors,
      startAngle: progress * 2 * math.pi,
      endAngle: progress * 2 * math.pi + 2 * math.pi,
    );

    final paint = Paint()
      ..shader = gradient.createShader(rect)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
            center: center,
            width: size.width + 12,
            height: size.height + 12),
        const Radius.circular(24),
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(_RainbowRingPainter old) => old.progress != progress;
}

// ── Active premium card ───────────────────────────────────────────────────────

class _ActivePremiumCard extends StatelessWidget {
  final SubscriptionState sub;
  const _ActivePremiumCard({required this.sub});

  @override
  Widget build(BuildContext context) {
    // sub.isPremium is true here
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.premium.withOpacity(0.15),
            AppColors.premium.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: AppColors.premium.withOpacity(0.4), width: 1),
      ),
      child: Row(
        children: [
          const Text('👑', style: TextStyle(fontSize: 28)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Active Premium',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: AppColors.premium,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'All features unlocked · Enjoying GayMeet Premium',
                  style: TextStyle(
                      color: AppTheme.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          Icon(Icons.check_circle_rounded,
              color: AppColors.premium, size: 22),
        ],
      ),
    );
  }
}

// ── Blurred likes banner ──────────────────────────────────────────────────────

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
            AppTheme.accent.withOpacity(0.10),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: AppTheme.primary.withOpacity(0.3), width: 1),
      ),
      child: Row(
        children: [
          SizedBox(
            width: avatarUrls.length * 24.0 + 16,
            height: 44,
            child: Stack(
              children: [
                for (var i = 0; i < avatarUrls.length; i++)
                  Positioned(
                    left: i * 24.0,
                    child: _BlurredAvatar(url: avatarUrls[i]),
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
                  '$likeCount ${likeCount == 1 ? 'person' : 'people'} liked you 👀',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 14),
                ),
                const SizedBox(height: 2),
                Text(
                  'Unlock Premium to see who they are',
                  style: TextStyle(
                      fontSize: 11, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BlurredAvatar extends StatelessWidget {
  final String? url;
  const _BlurredAvatar({this.url});

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: AppTheme.surface, width: 2),
          color: AppTheme.card,
        ),
        child: url != null
            ? ImageFiltered(
                imageFilter:
                    ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                child: CachedNetworkImage(
                  imageUrl: url!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) =>
                      Container(color: AppTheme.card),
                  errorWidget: (_, __, ___) =>
                      Container(color: AppTheme.card),
                ),
              )
            : Icon(Icons.person_rounded,
                color: AppTheme.textHint, size: 20),
      ),
    );
  }
}

// ── Benefits ──────────────────────────────────────────────────────────────────

const _benefits = [
  (Icons.all_inclusive_rounded,
      'Unlimited Swipes',
      'No daily cap — explore everyone around you'),
  (Icons.star_rounded,
      '5 Super Likes / Day',
      'Stand out and get noticed instantly'),
  (Icons.visibility_rounded,
      'See Who Liked You',
      'Know your admirers without guessing'),
  (Icons.bolt_rounded,
      'Weekly Profile Boost',
      'Reach 3× more people for 30 minutes'),
  (Icons.replay_rounded,
      'Rewind Last Swipe',
      'Changed your mind? Take back a pass'),
  (Icons.card_giftcard_rounded,
      '3 Free Gifts / Day',
      'Send gifts to crushes without spending coins'),
  (Icons.block_rounded,
      'Ad-Free',
      'Zero interruptions — pure connections'),
];

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: AppColors.textHint,
        letterSpacing: 0.8,
      ),
    );
  }
}

class _BenefitRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _BenefitRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              gradient: AppTheme.brandGradient,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, color: Colors.white, size: 19),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13)),
                Text(subtitle,
                    style: TextStyle(
                        fontSize: 11, color: AppTheme.textSecondary)),
              ],
            ),
          ),
          Icon(Icons.check_circle_rounded,
              color: AppTheme.primary, size: 18),
        ],
      ),
    );
  }
}

// ── Plan card ─────────────────────────────────────────────────────────────────

class _PlanCard extends StatelessWidget {
  final String id;
  final String title;
  final String price;
  final String period;
  final String? badge;
  final String? subtext;
  final bool selected;
  final bool highlighted;
  final VoidCallback onTap;

  const _PlanCard({
    required this.id,
    required this.title,
    required this.price,
    required this.period,
    required this.badge,
    required this.subtext,
    required this.selected,
    required this.highlighted,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: selected
              ? AppTheme.primary.withOpacity(0.10)
              : highlighted
                  ? AppTheme.primary.withOpacity(0.05)
                  : AppTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected
                ? AppTheme.primary
                : highlighted
                    ? AppTheme.primary.withOpacity(0.35)
                    : AppColors.textHint.withOpacity(0.15),
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            // Radio dot
            _RadioDot(selected: selected),
            const SizedBox(width: 12),

            // Title + subtext
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: selected
                              ? AppTheme.textPrimary
                              : AppTheme.textSecondary,
                        ),
                      ),
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
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  if (subtext != null)
                    Text(
                      subtext!,
                      style: TextStyle(
                          fontSize: 11, color: AppTheme.textHint),
                    ),
                ],
              ),
            ),

            // Price
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  price,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                    color: selected
                        ? AppTheme.textPrimary
                        : AppTheme.textSecondary,
                  ),
                ),
                Text(
                  period,
                  style: TextStyle(
                      fontSize: 10, color: AppTheme.textHint),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RadioDot extends StatelessWidget {
  final bool selected;
  const _RadioDot({required this.selected});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
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
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppTheme.primary,
                  shape: BoxShape.circle,
                ),
              ),
            )
          : null,
    );
  }
}

// ── Gradient CTA button ───────────────────────────────────────────────────────

class _GradientCTAButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  final AnimationController shimmer;

  const _GradientCTAButton({
    required this.label,
    required this.onTap,
    required this.shimmer,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedBuilder(
        animation: shimmer,
        builder: (_, __) {
          return Container(
            height: 58,
            decoration: BoxDecoration(
              gradient: AppTheme.brandGradient,
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primary.withOpacity(0.45),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Stack(
              children: [
                // Moving sheen
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: AnimatedBuilder(
                      animation: shimmer,
                      builder: (_, __) => Transform.translate(
                        offset: Offset(
                          (shimmer.value * 2 - 1) * 300,
                          0,
                        ),
                        child: Container(
                          width: 60,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.white.withOpacity(0),
                                Colors.white.withOpacity(0.12),
                                Colors.white.withOpacity(0),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Center(
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
