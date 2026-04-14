import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/likes_provider.dart';
import '../../core/providers/subscription_provider.dart';
import '../../core/theme/design_system.dart';

// ── Tier definitions ──────────────────────────────────────────────────────────

class _Plan {
  final String id;
  final String label;
  final String original; // crossed-out
  final String price;
  final String period;
  final String? badge; // e.g. '限时7折'
  final bool isPopular;

  const _Plan({
    required this.id,
    required this.label,
    required this.original,
    required this.price,
    required this.period,
    this.badge,
    this.isPopular = false,
  });
}

class _Tier {
  final int index;
  final String name;
  final String tagline;
  final LinearGradient heroGradient;
  final LinearGradient badgeGradient;
  final Color shadow;
  final bool isDark;
  final List<_Plan> plans;

  const _Tier({
    required this.index,
    required this.name,
    required this.tagline,
    required this.heroGradient,
    required this.badgeGradient,
    required this.shadow,
    required this.isDark,
    required this.plans,
  });
}

const _tiers = [
  _Tier(
    index: 0,
    name: 'A+会员',
    tagline: '解锁基础特权，开启社交加速',
    heroGradient: LinearGradient(
      colors: [Color(0xFFFF6B9D), Color(0xFFFF9A9E)],
      begin: Alignment.topLeft, end: Alignment.bottomRight,
    ),
    badgeGradient: LinearGradient(
      colors: [Color(0xFFFF6B9D), Color(0xFFFF9A9E)],
    ),
    shadow: Color(0xFFFF6B9D),
    isDark: false,
    plans: [
      _Plan(id: 'aplus_yearly', label: '连续包年', original: 'RM228', price: 'RM159', period: '/年', badge: '限时7折', isPopular: false),
      _Plan(id: 'aplus_quarterly', label: '连续包季', original: 'RM69', price: 'RM49', period: '/季', badge: '限时7折', isPopular: true),
      _Plan(id: 'aplus_monthly', label: '连续包月', original: 'RM25', price: 'RM19', period: '/月'),
    ],
  ),
  _Tier(
    index: 1,
    name: '钻石A+',
    tagline: '全方位隐私保护，精准社交匹配',
    heroGradient: LinearGradient(
      colors: [Color(0xFF1A1A2E), Color(0xFF2D1B4E), Color(0xFF16213E)],
      begin: Alignment.topLeft, end: Alignment.bottomRight,
    ),
    badgeGradient: LinearGradient(
      colors: [Color(0xFFFFD700), Color(0xFFFFA726)],
    ),
    shadow: Color(0xFFFFD700),
    isDark: true,
    plans: [
      _Plan(id: 'diamond_yearly', label: '连续包年', original: 'RM468', price: 'RM299', period: '/年', badge: '限时6折', isPopular: false),
      _Plan(id: 'diamond_quarterly', label: '连续包季', original: 'RM138', price: 'RM99', period: '/季', badge: '限时7折', isPopular: true),
      _Plan(id: 'diamond_monthly', label: '连续包月', original: 'RM49', price: 'RM39', period: '/月'),
    ],
  ),
  _Tier(
    index: 2,
    name: '彩虹A+',
    tagline: '顶级专属特权，无限精彩体验',
    heroGradient: LinearGradient(
      colors: [Color(0xFFFF6B9D), Color(0xFFFF9A3C), Color(0xFFFFE066), Color(0xFF70E080), Color(0xFF60BBFF), Color(0xFFA78BFA)],
      begin: Alignment.topLeft, end: Alignment.bottomRight,
    ),
    badgeGradient: LinearGradient(
      colors: [Color(0xFFFF6B9D), Color(0xFFFF9A3C), Color(0xFFFFE066), Color(0xFF70E080), Color(0xFF60BBFF), Color(0xFFA78BFA)],
    ),
    shadow: Color(0xFFA78BFA),
    isDark: true,
    plans: [
      _Plan(id: 'rainbow_yearly', label: '连续包年', original: 'RM828', price: 'RM499', period: '/年', badge: '限时6折', isPopular: false),
      _Plan(id: 'rainbow_quarterly', label: '连续包季', original: 'RM249', price: 'RM169', period: '/季', badge: '限时7折', isPopular: true),
      _Plan(id: 'rainbow_monthly', label: '连续包月', original: 'RM89', price: 'RM69', period: '/月'),
    ],
  ),
];

// ── Feature definitions ───────────────────────────────────────────────────────

class _Feature {
  final String icon;
  final String title;
  final String? subtitle;
  // 0=A+, 1=钻石, 2=彩虹  (null means not available, String is shown, true means available)
  final dynamic v0, v1, v2;
  final bool hasToggle;

  const _Feature({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.v0,
    required this.v1,
    required this.v2,
    this.hasToggle = false,
  });

  bool availableFor(int tier) {
    final v = tier == 0 ? v0 : tier == 1 ? v1 : v2;
    if (v == false || v == null) return false;
    return true;
  }
}

const _socialFeatures = [
  _Feature(icon: '📍', title: '附近的人', v0: true, v1: true, v2: true),
  _Feature(icon: '❤️', title: '好友收藏上限', subtitle: '50名', v0: true, v1: true, v2: true),
  _Feature(icon: '🧰', title: '社交工具箱', v0: false, v1: true, v2: true),
  _Feature(icon: '🌏', title: '城市漫游/传送', v0: true, v1: true, v2: true),
  _Feature(icon: '🗺️', title: '地图找人', v0: false, v1: true, v2: true),
  _Feature(icon: '👻', title: '悄悄查看', v0: false, v1: true, v2: true),
  _Feature(icon: '🔍', title: '高级筛选', v0: false, v1: true, v2: true),
  _Feature(icon: '🎯', title: '精确筛选', v0: false, v1: true, v2: true),
  _Feature(icon: '✨', title: '专属标识', v0: true, v1: true, v2: true),
  _Feature(icon: '🌟', title: '精选推荐', v0: false, v1: true, v2: true),
  _Feature(icon: '💌', title: '小纸条/私信', v0: false, v1: '5次/月', v2: '无限'),
  _Feature(icon: '🤖', title: 'AI找天菜', v0: false, v1: true, v2: true),
];

const _privacyFeatures = [
  _Feature(icon: '👣', title: '隐藏足迹', v0: false, v1: true, v2: true, hasToggle: true),
  _Feature(icon: '🕐', title: '隐藏活跃时间', v0: true, v1: true, v2: true, hasToggle: true),
  _Feature(icon: '🥷', title: '自定义隐身', v0: false, v1: true, v2: true),
  _Feature(icon: '📏', title: '隐藏距离', v0: false, v1: true, v2: true, hasToggle: true),
  _Feature(icon: '🔥', title: '隐藏人气', v0: false, v1: true, v2: true),
  _Feature(icon: '🚫', title: '免广告', v0: true, v1: true, v2: true, hasToggle: true),
];

const _swipeFeatures = [
  _Feature(icon: '♾️', title: '解锁右滑限制', v0: true, v1: true, v2: true),
];

const _extraFeatures = [
  _Feature(icon: '📌', title: '动态置顶', v0: false, v1: true, v2: true),
  _Feature(icon: '🎨', title: '个性图标', v0: false, v1: true, v2: true),
  _Feature(icon: '🎭', title: '动态头像', v0: false, v1: true, v2: true),
  _Feature(icon: '🎭', title: '蒙面派对特权', v0: false, v1: '5次/日', v2: '无限'),
];

const _rainbowExclusives = [
  '专属流量曝光',
  '动态推广 2500次/月',
  '一键取关',
  '智能筛选',
  '无限小纸条',
  '专属卡片边框',
  '聊天气泡定制',
  '超级曝光 3次/月',
];

// ── Screen ────────────────────────────────────────────────────────────────────

class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen>
    with SingleTickerProviderStateMixin {
  late final PageController _pageCtrl;
  int _tierIndex = 1; // 钻石A+ default
  int _planIndex = 1; // quarterly default (popular)

  @override
  void initState() {
    super.initState();
    _pageCtrl = PageController(initialPage: _tierIndex);
    Future.microtask(() => ref.read(likesProvider.notifier).fetchLikes());
  }

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  void _goToTier(int index) {
    setState(() {
      _tierIndex = index;
      _planIndex = 1;
    });
    _pageCtrl.animateToPage(index,
        duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
  }

  Future<void> _purchase() async {
    final tier = _tiers[_tierIndex];
    final plan = tier.plans[_planIndex];
    final ok = await ref.read(subscriptionProvider.notifier).purchase(plan.id);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('欢迎成为 ${tier.name}！')),
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
            ? (ref.read(subscriptionProvider).isPremium ? '已恢复购买！' : '未找到有效订阅')
            : '恢复失败，请重试'),
      ),
    );
    if (ok && ref.read(subscriptionProvider).isPremium && mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final tier = _tiers[_tierIndex];
    final plan = tier.plans[_planIndex];
    final sub = ref.watch(subscriptionProvider);
    final likesState = ref.watch(likesProvider);
    final likers = kUseDummyData ? DummyData.users : likesState.valueOrNull ?? [];

    return Scaffold(
      backgroundColor: tier.isDark ? const Color(0xFF0D0D1A) : const Color(0xFFFFF5F8),
      body: Stack(
        children: [
          // ── Scrollable content ──────────────────────────────────────────────
          sub.isLoading
              ? const Center(child: CircularProgressIndicator())
              : CustomScrollView(
                  slivers: [
                    // ── Close button ──────────────────────────────────────────
                    SliverToBoxAdapter(
                      child: SafeArea(
                        child: Padding(
                          padding: const EdgeInsets.only(left: 8, top: 4, right: 8),
                          child: Row(
                            children: [
                              IconButton(
                                icon: Icon(Icons.close_rounded,
                                    color: tier.isDark ? Colors.white70 : Colors.black54),
                                onPressed: () => Navigator.of(context).pop(),
                              ),
                              const Spacer(),
                              TextButton(
                                onPressed: _restore,
                                child: Text('恢复购买',
                                    style: TextStyle(
                                        color: tier.isDark
                                            ? Colors.white38
                                            : Colors.black38,
                                        fontSize: 12)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 140),
                      sliver: SliverList(
                        delegate: SliverChildListDelegate([
                          // ── Tab headers ───────────────────────────────────
                          _TierTabBar(
                            currentIndex: _tierIndex,
                            onTap: _goToTier,
                          ),

                          const SizedBox(height: 16),

                          // ── PageView hero cards ───────────────────────────
                          SizedBox(
                            height: 180,
                            child: PageView.builder(
                              controller: _pageCtrl,
                              onPageChanged: (i) => setState(() {
                                _tierIndex = i;
                                _planIndex = 1;
                              }),
                              itemCount: _tiers.length,
                              itemBuilder: (_, i) => Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 4),
                                child: _HeroCard(
                                  tier: _tiers[i],
                                  likeCount: likers.length,
                                  user: ref.watch(authStateProvider).user,
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(height: 20),

                          // ── Pricing plans ─────────────────────────────────
                          _PricingRow(
                            plans: tier.plans,
                            selectedIndex: _planIndex,
                            tier: tier,
                            onSelect: (i) => setState(() => _planIndex = i),
                          ),

                          const SizedBox(height: 28),

                          // ── Rainbow exclusives banner ─────────────────────
                          if (_tierIndex == 2)
                            _RainbowExclusivesBanner(isDark: tier.isDark),

                          if (_tierIndex == 2) const SizedBox(height: 20),

                          // ── Feature sections ──────────────────────────────
                          _FeatureSection(
                            title: '辅助交友',
                            features: _socialFeatures,
                            tierIndex: _tierIndex,
                            isDark: tier.isDark,
                          ),

                          const SizedBox(height: 16),

                          _FeatureSection(
                            title: '隐私保护',
                            features: _privacyFeatures,
                            tierIndex: _tierIndex,
                            isDark: tier.isDark,
                          ),

                          const SizedBox(height: 16),

                          _FeatureSection(
                            title: '划卡特权',
                            features: _swipeFeatures,
                            tierIndex: _tierIndex,
                            isDark: tier.isDark,
                          ),

                          const SizedBox(height: 16),

                          _FeatureSection(
                            title: '更多服务',
                            features: _extraFeatures,
                            tierIndex: _tierIndex,
                            isDark: tier.isDark,
                          ),

                          const SizedBox(height: 16),

                          // ── Compare link ─────────────────────────────────
                          Center(
                            child: TextButton(
                              onPressed: () => _showCompareModal(context),
                              child: Text(
                                '对比权益 >',
                                style: TextStyle(
                                  color: tier.isDark
                                      ? Colors.white54
                                      : AppTheme.primary,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ),

                          Center(
                            child: Text(
                              '随时取消 · 自动续费 · 安全支付',
                              style: TextStyle(
                                  fontSize: 11,
                                  color: tier.isDark
                                      ? Colors.white24
                                      : Colors.black26),
                            ),
                          ),
                        ]),
                      ),
                    ),
                  ],
                ),

          // ── Fixed bottom bar ────────────────────────────────────────────────
          Positioned(
            left: 0, right: 0, bottom: 0,
            child: _BottomBar(
              tier: tier,
              plan: plan,
              onPurchase: _purchase,
            ),
          ),
        ],
      ),
    );
  }

  void _showCompareModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _CompareModal(),
    );
  }
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

class _TierTabBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const _TierTabBar({required this.currentIndex, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.black12,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: List.generate(_tiers.length, (i) {
          final selected = i == currentIndex;
          return Expanded(
            child: GestureDetector(
              onTap: () => onTap(i),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: selected
                    ? BoxDecoration(
                        gradient: _tiers[i].badgeGradient,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: [
                          BoxShadow(
                            color: _tiers[i].shadow.withOpacity(0.4),
                            blurRadius: 8,
                          )
                        ],
                      )
                    : BoxDecoration(borderRadius: BorderRadius.circular(10)),
                child: Text(
                  _tiers[i].name,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: selected ? Colors.white : Colors.white54,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ── Hero card ─────────────────────────────────────────────────────────────────

class _HeroCard extends StatelessWidget {
  final _Tier tier;
  final int likeCount;
  final dynamic user;

  const _HeroCard({required this.tier, required this.likeCount, required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: tier.heroGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: tier.shadow.withOpacity(0.35), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      padding: const EdgeInsets.all(20),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Tier badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    tier.name,
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  tier.tagline,
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14, height: 1.4),
                ),
                const SizedBox(height: 10),
                if (likeCount > 0)
                  Text(
                    '已有 $likeCount 人喜欢你 ❤️',
                    style: const TextStyle(
                        color: Colors.white70, fontSize: 12),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          // Avatar with glow
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white54, width: 2.5),
              boxShadow: [BoxShadow(color: Colors.white24, blurRadius: 12, spreadRadius: 2)],
            ),
            child: ClipOval(
              child: user?.avatarUrl != null
                  ? CachedNetworkImage(
                      imageUrl: user!.avatarUrl!,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => _defaultAvatar(),
                    )
                  : _defaultAvatar(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _defaultAvatar() {
    return Container(
      color: Colors.white12,
      child: const Icon(Icons.person_rounded, color: Colors.white54, size: 36),
    );
  }
}

// ── Pricing row ───────────────────────────────────────────────────────────────

class _PricingRow extends StatelessWidget {
  final List<_Plan> plans;
  final int selectedIndex;
  final _Tier tier;
  final ValueChanged<int> onSelect;

  const _PricingRow({
    required this.plans,
    required this.selectedIndex,
    required this.tier,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(plans.length, (i) {
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: i < plans.length - 1 ? 8 : 0),
            child: _PlanCard(
              plan: plans[i],
              selected: i == selectedIndex,
              tier: tier,
              onTap: () => onSelect(i),
            ),
          ),
        );
      }),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final _Plan plan;
  final bool selected;
  final _Tier tier;
  final VoidCallback onTap;

  const _PlanCard({
    required this.plan,
    required this.selected,
    required this.tier,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cardBg = tier.isDark
        ? (selected ? Colors.white.withOpacity(0.12) : Colors.white.withOpacity(0.05))
        : (selected ? AppTheme.primary.withOpacity(0.08) : Colors.black.withOpacity(0.04));
    final borderColor = selected ? tier.shadow : Colors.transparent;

    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.fromLTRB(8, 14, 8, 12),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: borderColor, width: 1.5),
              boxShadow: selected
                  ? [BoxShadow(color: tier.shadow.withOpacity(0.25), blurRadius: 10)]
                  : null,
            ),
            child: Column(
              children: [
                Text(
                  plan.label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: tier.isDark ? Colors.white70 : Colors.black54,
                  ),
                ),
                const SizedBox(height: 6),
                // Original price (crossed out)
                Text(
                  plan.original,
                  style: TextStyle(
                    fontSize: 11,
                    color: tier.isDark ? Colors.white30 : Colors.black26,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  plan.price,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: selected
                        ? (tier.isDark ? Colors.white : AppTheme.primary)
                        : (tier.isDark ? Colors.white70 : Colors.black87),
                  ),
                ),
                Text(
                  plan.period,
                  style: TextStyle(
                    fontSize: 10,
                    color: tier.isDark ? Colors.white38 : Colors.black38,
                  ),
                ),
              ],
            ),
          ),
          // Popular badge
          if (plan.isPopular)
            Positioned(
              top: -9,
              left: 0, right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    gradient: tier.badgeGradient,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text('推荐',
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
            ),
          // Discount badge
          if (plan.badge != null)
            Positioned(
              top: -8,
              right: 4,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.red.shade600,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(plan.badge!,
                    style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Colors.white)),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Rainbow exclusives banner ─────────────────────────────────────────────────

class _RainbowExclusivesBanner extends StatelessWidget {
  final bool isDark;
  const _RainbowExclusivesBanner({required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0x33FF6B9D), Color(0x33A78BFA)],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white24, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Text('🌈', style: TextStyle(fontSize: 16)),
            const SizedBox(width: 6),
            const Text('彩虹A+ 专属特权',
                style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 14)),
          ]),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: _rainbowExclusives.map((e) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.white12,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(e,
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w500)),
            )).toList(),
          ),
        ],
      ),
    );
  }
}

// ── Feature section ───────────────────────────────────────────────────────────

class _FeatureSection extends StatelessWidget {
  final String title;
  final List<_Feature> features;
  final int tierIndex;
  final bool isDark;

  const _FeatureSection({
    required this.title,
    required this.features,
    required this.tierIndex,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 2, bottom: 10),
          child: Text(
            title,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: isDark ? Colors.white70 : Colors.black87,
              letterSpacing: 0.5,
            ),
          ),
        ),
        GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 2.8,
          children: features.map((f) => _FeatureCard(
            feature: f,
            tierIndex: tierIndex,
            isDark: isDark,
          )).toList(),
        ),
      ],
    );
  }
}

class _FeatureCard extends StatelessWidget {
  final _Feature feature;
  final int tierIndex;
  final bool isDark;

  const _FeatureCard({
    required this.feature,
    required this.tierIndex,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final available = feature.availableFor(tierIndex);
    final v = tierIndex == 0
        ? feature.v0
        : tierIndex == 1
            ? feature.v1
            : feature.v2;

    final cardBg = isDark
        ? (available ? Colors.white.withOpacity(0.07) : Colors.white.withOpacity(0.03))
        : (available ? Colors.white : Colors.black.withOpacity(0.03));

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(12),
        border: available && isDark
            ? Border.all(color: Colors.white12, width: 0.5)
            : null,
      ),
      child: Row(
        children: [
          Text(
            feature.icon,
            style: TextStyle(fontSize: 16, color: available ? null : null),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  feature.title,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: available
                        ? (isDark ? Colors.white : Colors.black87)
                        : (isDark ? Colors.white24 : Colors.black26),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (v is String)
                  Text(v,
                      style: TextStyle(
                          fontSize: 10,
                          color: isDark ? Colors.white38 : Colors.black38)),
                if (feature.subtitle != null)
                  Text(feature.subtitle!,
                      style: TextStyle(
                          fontSize: 10,
                          color: isDark ? Colors.white38 : Colors.black38)),
              ],
            ),
          ),
          if (available && feature.hasToggle)
            Transform.scale(
              scale: 0.65,
              child: Switch(
                value: true,
                onChanged: null,
                activeColor: AppTheme.primary,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            )
          else if (available && v == true)
            Icon(Icons.check_circle_rounded,
                size: 14,
                color: isDark ? Colors.greenAccent.withOpacity(0.8) : Colors.green)
          else if (!available)
            Icon(Icons.lock_rounded,
                size: 12,
                color: isDark ? Colors.white24 : Colors.black26),
        ],
      ),
    );
  }
}

// ── Bottom bar ────────────────────────────────────────────────────────────────

class _BottomBar extends StatelessWidget {
  final _Tier tier;
  final _Plan plan;
  final VoidCallback onPurchase;

  const _BottomBar({
    required this.tier,
    required this.plan,
    required this.onPurchase,
  });

  @override
  Widget build(BuildContext context) {
    // Calculate savings
    final originalPriceStr = plan.original.replaceAll(RegExp(r'[^0-9]'), '');
    final currentPriceStr = plan.price.replaceAll(RegExp(r'[^0-9]'), '');
    final savings = (int.tryParse(originalPriceStr) ?? 0) -
        (int.tryParse(currentPriceStr) ?? 0);

    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: tier.isDark ? const Color(0xFF0D0D1A) : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 16,
            offset: const Offset(0, -4),
          )
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Text(
                      plan.price,
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: tier.isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    Text(
                      plan.period,
                      style: TextStyle(
                          fontSize: 12,
                          color: tier.isDark ? Colors.white54 : Colors.black38),
                    ),
                  ]),
                  if (savings > 0)
                    Text(
                      '已优惠 RM$savings',
                      style: const TextStyle(
                          fontSize: 11, color: Colors.greenAccent),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: onPurchase,
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: tier.heroGradient,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: tier.shadow.withOpacity(0.4),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        )
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        '确认协议并支付',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.white),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Compare modal ─────────────────────────────────────────────────────────────

class _CompareModal extends StatelessWidget {
  const _CompareModal();

  static const _rows = [
    ('无限右滑', true, true, true),
    ('每日Super Like', '5次', '10次', '无限'),
    ('资料曝光加速', '无', '每周1次', '每日2次'),
    ('城市漫游/传送', true, true, true),
    ('隐藏距离', false, true, true),
    ('隐藏活跃时间', true, true, true),
    ('隐藏足迹', false, true, true),
    ('自定义隐身', false, true, true),
    ('地图找人', false, true, true),
    ('悄悄查看', false, true, true),
    ('高级筛选', false, true, true),
    ('小纸条/私信', '无', '5次/月', '无限'),
    ('AI找天菜', false, true, true),
    ('免广告', true, true, true),
    ('动态置顶', false, true, true),
    ('蒙面派对', '无', '5次/日', '无限'),
    ('专属流量曝光', false, false, true),
    ('专属卡片边框', false, false, true),
    ('聊天气泡定制', false, false, true),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Color(0xFF0D0D1A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Handle
          Padding(
            padding: const EdgeInsets.all(12),
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const Text('权益对比',
              style: TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
          const SizedBox(height: 12),
          // Header
          _CompareRow(
            label: '功能',
            v1: 'A+', v2: '钻石A+', v3: '彩虹A+',
            isHeader: true,
          ),
          const Divider(color: Colors.white12, height: 1),
          Expanded(
            child: ListView.separated(
              padding: EdgeInsets.zero,
              itemCount: _rows.length,
              separatorBuilder: (_, __) => const Divider(color: Colors.white12, height: 1),
              itemBuilder: (_, i) {
                final row = _rows[i];
                return _CompareRow(
                  label: row.$1,
                  v1: row.$2,
                  v2: row.$3,
                  v3: row.$4,
                  highlight: i % 2 == 0,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _CompareRow extends StatelessWidget {
  final String label;
  final dynamic v1, v2, v3;
  final bool isHeader;
  final bool highlight;

  const _CompareRow({
    required this.label,
    required this.v1, required this.v2, required this.v3,
    this.isHeader = false,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: highlight && !isHeader ? Colors.white.withOpacity(0.03) : null,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(label,
                style: TextStyle(
                    color: isHeader ? Colors.white70 : Colors.white54,
                    fontSize: isHeader ? 12 : 12,
                    fontWeight: isHeader ? FontWeight.w700 : FontWeight.w400)),
          ),
          for (final v in [v1, v2, v3])
            Expanded(child: _CompareCell(value: v, isHeader: isHeader)),
        ],
      ),
    );
  }
}

class _CompareCell extends StatelessWidget {
  final dynamic value;
  final bool isHeader;
  const _CompareCell({required this.value, required this.isHeader});

  @override
  Widget build(BuildContext context) {
    if (isHeader) {
      return Center(
        child: Text(value.toString(),
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
      );
    }
    if (value == false) {
      return const Center(child: Icon(Icons.remove_rounded, size: 14, color: Colors.white24));
    }
    if (value == true) {
      return const Center(child: Icon(Icons.check_circle_rounded, size: 14, color: Colors.greenAccent));
    }
    return Center(
      child: Text(value.toString(),
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}
