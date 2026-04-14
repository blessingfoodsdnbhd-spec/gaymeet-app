import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/providers/likes_provider.dart';
import '../../core/providers/subscription_provider.dart';
import '../../core/theme/design_system.dart';

// ── Product IDs ───────────────────────────────────────────────────────────────

const _kVip1Monthly = 'gaymeet_vip1_monthly';
const _kVip2Monthly = 'gaymeet_vip2_monthly';
const _kVip3Monthly = 'gaymeet_vip3_monthly';
const _kVip1Yearly = 'gaymeet_vip1_yearly';
const _kVip2Yearly = 'gaymeet_vip2_yearly';
const _kVip3Yearly = 'gaymeet_vip3_yearly';

// ── VIP tier data ─────────────────────────────────────────────────────────────

class _TierData {
  final int level;
  final String title;
  final String monthlyId;
  final String yearlyId;
  final String monthlyPrice;
  final String yearlyPrice;
  final String yearlySaving;
  final LinearGradient gradient;
  final Color shadowColor;
  final List<String> features;

  const _TierData({
    required this.level,
    required this.title,
    required this.monthlyId,
    required this.yearlyId,
    required this.monthlyPrice,
    required this.yearlyPrice,
    required this.yearlySaving,
    required this.gradient,
    required this.shadowColor,
    required this.features,
  });
}

const _tiers = [
  _TierData(
    level: 1,
    title: 'VIP 1',
    monthlyId: _kVip1Monthly,
    yearlyId: _kVip1Yearly,
    monthlyPrice: 'RM19',
    yearlyPrice: 'RM99',
    yearlySaving: '省56%',
    gradient: LinearGradient(
      colors: [Color(0xFF9E9E9E), Color(0xFFBDBDBD)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    shadowColor: Color(0xFF9E9E9E),
    features: ['无限滑动', '每日5个Super Like', '查看谁喜欢你', '撤回上次滑动', '无广告'],
  ),
  _TierData(
    level: 2,
    title: 'VIP 2',
    monthlyId: _kVip2Monthly,
    yearlyId: _kVip2Yearly,
    monthlyPrice: 'RM39',
    yearlyPrice: 'RM199',
    yearlySaving: '省57%',
    gradient: LinearGradient(
      colors: [Color(0xFFFFD700), Color(0xFFFFA726)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    shadowColor: Color(0xFFFFD700),
    features: [
      'VIP 1 所有功能',
      '每周资料加速曝光',
      '每日10个Super Like',
      '隐身模式',
      '查看谁访问了你',
      '专属金色徽章',
    ],
  ),
  _TierData(
    level: 3,
    title: 'VIP 3',
    monthlyId: _kVip3Monthly,
    yearlyId: _kVip3Yearly,
    monthlyPrice: 'RM69',
    yearlyPrice: 'RM349',
    yearlySaving: '省58%',
    gradient: AppColors.rainbowGradient,
    shadowColor: AppColors.hotPink,
    features: [
      'VIP 2 所有功能',
      '无限Super Like',
      '每日2次加速曝光',
      '专属彩虹皇冠徽章',
      '私人空间展示',
      'VIP专属活动',
    ],
  ),
];

// ── Screen ────────────────────────────────────────────────────────────────────

class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen> {
  int _selectedTierIndex = 1; // VIP2 default ("Most Popular")
  bool _yearly = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(likesProvider.notifier).fetchLikes());
  }

  Future<void> _purchase() async {
    final tier = _tiers[_selectedTierIndex];
    final productId = _yearly ? tier.yearlyId : tier.monthlyId;
    final ok =
        await ref.read(subscriptionProvider.notifier).purchase(productId);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('欢迎成为 ${tier.title}！')),
      );
      Navigator.of(context).pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('购买失败，请重试')),
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
                ? '已恢复购买！'
                : '未找到有效订阅')
            : '恢复失败，请重试'),
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
    final likers = kUseDummyData ? DummyData.users : likesState.valueOrNull ?? [];
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
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      const SizedBox(height: 12),

                      // ── Social proof ──────────────────────────────────────
                      if (likeCount > 0)
                        _LikesPreviewBanner(
                          likeCount: likeCount,
                          avatarUrls: previewAvatars.cast<String?>(),
                        ),

                      const SizedBox(height: 24),

                      // ── Billing toggle ────────────────────────────────────
                      _BillingToggle(
                        yearly: _yearly,
                        onChanged: (v) => setState(() => _yearly = v),
                      ),

                      const SizedBox(height: 20),

                      // ── Tier cards ────────────────────────────────────────
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: List.generate(_tiers.length, (i) {
                          final isPopular = i == 1;
                          return Expanded(
                            child: Padding(
                              padding: EdgeInsets.only(
                                right: i < _tiers.length - 1 ? 8 : 0,
                              ),
                              child: _TierCard(
                                tier: _tiers[i],
                                selected: _selectedTierIndex == i,
                                isPopular: isPopular,
                                yearly: _yearly,
                                onTap: () =>
                                    setState(() => _selectedTierIndex = i),
                              ),
                            ),
                          );
                        }),
                      ),

                      const SizedBox(height: 28),

                      // ── Feature comparison table ──────────────────────────
                      _ComparisonTable(currentTier: _selectedTierIndex),

                      const SizedBox(height: 28),

                      // ── CTA ───────────────────────────────────────────────
                      _GradientButton(
                        tier: _tiers[_selectedTierIndex],
                        yearly: _yearly,
                        onTap: _purchase,
                      ),

                      const SizedBox(height: 16),
                      Center(
                        child: TextButton(
                          onPressed: _restore,
                          child: Text('恢复购买',
                              style: TextStyle(
                                  color: AppTheme.textSecondary,
                                  fontSize: 13)),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: Text(
                          '随时取消 · 自动续费 · App Store 安全支付',
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
      expandedHeight: 200,
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
              ShaderMask(
                shaderCallback: (bounds) =>
                    AppColors.rainbowGradient.createShader(bounds),
                child: const Icon(Icons.workspace_premium,
                    size: 52, color: Colors.white),
              ),
              const SizedBox(height: 12),
              const Text(
                'GayMeet VIP',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '选择适合你的会员等级',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Billing toggle ────────────────────────────────────────────────────────────

class _BillingToggle extends StatelessWidget {
  final bool yearly;
  final ValueChanged<bool> onChanged;

  const _BillingToggle({required this.yearly, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _Tab(label: '按月', selected: !yearly, onTap: () => onChanged(false)),
        const SizedBox(width: 8),
        _Tab(
          label: '按年',
          selected: yearly,
          onTap: () => onChanged(true),
          badge: '省50%+',
        ),
      ],
    );
  }
}

class _Tab extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final String? badge;

  const _Tab({
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected ? AppTheme.brandGradient : null,
          color: selected ? null : AppTheme.card,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : AppTheme.textSecondary,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
            if (badge != null) ...[
              const SizedBox(width: 6),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  badge!,
                  style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Colors.white),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Tier card ─────────────────────────────────────────────────────────────────

class _TierCard extends StatelessWidget {
  final _TierData tier;
  final bool selected;
  final bool isPopular;
  final bool yearly;
  final VoidCallback onTap;

  const _TierCard({
    required this.tier,
    required this.selected,
    required this.isPopular,
    required this.yearly,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final price = yearly ? tier.yearlyPrice : tier.monthlyPrice;
    final period = yearly ? '/年' : '/月';

    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.fromLTRB(10, 16, 10, 12),
            decoration: BoxDecoration(
              color: selected
                  ? AppTheme.primary.withOpacity(0.08)
                  : AppTheme.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: selected ? AppTheme.primary : Colors.white12,
                width: selected ? 2 : 1,
              ),
              boxShadow: selected
                  ? [
                      BoxShadow(
                        color: tier.shadowColor.withOpacity(0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      )
                    ]
                  : null,
            ),
            child: Column(
              children: [
                // Icon / level
                ShaderMask(
                  shaderCallback: (b) => tier.gradient.createShader(b),
                  child: Icon(
                    tier.level == 3
                        ? Icons.auto_awesome
                        : Icons.workspace_premium,
                    size: 28,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  tier.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  price,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                Text(
                  period,
                  style: TextStyle(
                    color: AppTheme.textHint,
                    fontSize: 11,
                  ),
                ),
                if (yearly) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      gradient: tier.gradient,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      tier.yearlySaving,
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (isPopular)
            Positioned(
              top: -10,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    gradient: AppTheme.brandGradient,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    '最受欢迎',
                    style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: Colors.white),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Comparison table ──────────────────────────────────────────────────────────

class _ComparisonTable extends StatelessWidget {
  final int currentTier;
  const _ComparisonTable({required this.currentTier});

  static const _allFeatures = [
    ('无限滑动', true, true, true),
    ('查看谁喜欢你', true, true, true),
    ('撤回滑动', true, true, true),
    ('无广告', true, true, true),
    ('每日Super Like', '5', '10', '无限'),
    ('资料曝光加速', false, '每周1次', '每日2次'),
    ('隐身模式', false, true, true),
    ('查看访客', false, true, true),
    ('专属徽章', false, '金色', '彩虹皇冠'),
    ('VIP专属活动', false, false, true),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          // Header row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                const Expanded(
                  flex: 3,
                  child: Text('功能',
                      style: TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 13)),
                ),
                for (int i = 0; i < 3; i++)
                  Expanded(
                    child: ShaderMask(
                      shaderCallback: (b) =>
                          _tiers[i].gradient.createShader(b),
                      child: Text(
                        _tiers[i].title,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          ...List.generate(_allFeatures.length, (i) {
            final f = _allFeatures[i];
            return _FeatureRow(
              label: f.$1 as String,
              v1: f.$2,
              v2: f.$3,
              v3: f.$4,
              highlight: i % 2 == 0,
            );
          }),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  final String label;
  final dynamic v1, v2, v3;
  final bool highlight;

  const _FeatureRow({
    required this.label,
    required this.v1,
    required this.v2,
    required this.v3,
    required this.highlight,
  });

  @override
  Widget build(BuildContext context) {
    final vals = [v1, v2, v3];
    return Container(
      color: highlight ? Colors.white.withOpacity(0.03) : null,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(label,
                style: TextStyle(
                    color: AppTheme.textSecondary, fontSize: 12)),
          ),
          for (final v in vals)
            Expanded(child: _CellValue(value: v)),
        ],
      ),
    );
  }
}

class _CellValue extends StatelessWidget {
  final dynamic value;
  const _CellValue({required this.value});

  @override
  Widget build(BuildContext context) {
    if (value == false) {
      return const Center(
        child: Icon(Icons.remove_rounded, size: 16, color: Colors.white24),
      );
    }
    if (value == true) {
      return Center(
        child: Icon(Icons.check_circle_rounded,
            size: 16, color: AppTheme.primary),
      );
    }
    return Center(
      child: Text(
        value.toString(),
        textAlign: TextAlign.center,
        style: TextStyle(
          color: AppTheme.textPrimary,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ── CTA button ────────────────────────────────────────────────────────────────

class _GradientButton extends StatelessWidget {
  final _TierData tier;
  final bool yearly;
  final VoidCallback onTap;

  const _GradientButton({
    required this.tier,
    required this.yearly,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final price = yearly ? tier.yearlyPrice : tier.monthlyPrice;
    final period = yearly ? '/年' : '/月';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 56,
        decoration: BoxDecoration(
          gradient: tier.gradient,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: tier.shadowColor.withOpacity(0.4),
              blurRadius: 16,
              offset: const Offset(0, 6),
            )
          ],
        ),
        child: Center(
          child: Text(
            '立即解锁 ${tier.title}  $price$period',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: 0.3,
            ),
          ),
        ),
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
            AppTheme.accent.withOpacity(0.12),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: AppTheme.primary.withOpacity(0.3), width: 1),
      ),
      child: Row(
        children: [
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
                  '💬 $likeCount 人已喜欢你',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 14),
                ),
                const SizedBox(height: 3),
                Text(
                  '解锁VIP查看他们是谁',
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
                imageFilter:
                    ui.ImageFilter.blur(sigmaX: 9, sigmaY: 9),
                child: CachedNetworkImage(
                  imageUrl: avatarUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) =>
                      Container(color: AppTheme.card),
                  errorWidget: (_, __, ___) =>
                      Container(color: AppTheme.card),
                ),
              )
            : Icon(Icons.person_rounded,
                color: AppTheme.textHint, size: 22),
      ),
    );
  }
}
