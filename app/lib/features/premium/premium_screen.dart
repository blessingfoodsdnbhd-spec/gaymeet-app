import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/subscription_provider.dart';
import '../../core/providers/currency_provider.dart';

// ── VIP tier data ─────────────────────────────────────────────────────────────

enum VipTier { aPlus, diamond, rainbow }

class _TierConfig {
  final VipTier tier;
  final String name;
  final String nameZh;
  final String emoji;
  final double monthlyMYR;
  final double yearlyMYR;
  final LinearGradient gradient;
  final Color accentColor;
  final String badge;
  final List<String> features;

  const _TierConfig({
    required this.tier,
    required this.name,
    required this.nameZh,
    required this.emoji,
    required this.monthlyMYR,
    required this.yearlyMYR,
    required this.gradient,
    required this.accentColor,
    required this.badge,
    required this.features,
  });
}

const _tiers = [
  _TierConfig(
    tier: VipTier.aPlus,
    name: 'A+',
    nameZh: 'A+ 会员',
    emoji: '⭐',
    monthlyMYR: 19,
    yearlyMYR: 99,
    gradient: LinearGradient(
      colors: [Color(0xFFFF1493), Color(0xFFE91E63)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    accentColor: Color(0xFFFF1493),
    badge: 'POPULAR',
    features: [
      'Unlimited Swipes',
      'See Who Liked You',
      '5 Super Likes / day',
      'Rewind Last Swipe',
      'Ad-Free Experience',
      'Read Receipts',
    ],
  ),
  _TierConfig(
    tier: VipTier.diamond,
    name: '钻石',
    nameZh: '钻石会员',
    emoji: '💎',
    monthlyMYR: 39,
    yearlyMYR: 199,
    gradient: LinearGradient(
      colors: [Color(0xFF2196F3), Color(0xFF7C4DFF)],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    accentColor: Color(0xFF2196F3),
    badge: 'BEST VALUE',
    features: [
      'All A+ Benefits',
      'Weekly Profile Boost',
      'Teleport Anywhere',
      'Priority in Discovery',
      'Stealth Mode',
      'Unlimited Likes Back',
    ],
  ),
  _TierConfig(
    tier: VipTier.rainbow,
    name: '彩虹',
    nameZh: '彩虹会员',
    emoji: '🌈',
    monthlyMYR: 69,
    yearlyMYR: 349,
    gradient: LinearGradient(
      colors: [
        Color(0xFFFF3B3B),
        Color(0xFFFF8C00),
        Color(0xFFFFD700),
        Color(0xFF00E676),
        Color(0xFF2196F3),
        Color(0xFF9C27B0),
      ],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
    accentColor: Color(0xFFFF1493),
    badge: 'ULTIMATE',
    features: [
      'All Diamond Benefits',
      'Rainbow Border Badge',
      'Daily Coin Reward',
      'Exclusive Stickers',
      'VIP Customer Support',
      'Early Feature Access',
    ],
  ),
];

// ── Comparison feature table ──────────────────────────────────────────────────

const _comparisonFeatures = [
  ('Unlimited Swipes',      true,  true,  true),
  ('See Who Liked You',     true,  true,  true),
  ('Super Likes / day',     false, true,  true),
  ('Rewind Last Swipe',     true,  true,  true),
  ('Ad-Free',               true,  true,  true),
  ('Read Receipts',         true,  true,  true),
  ('Profile Boost',         false, true,  true),
  ('Teleport',              false, true,  true),
  ('Stealth Mode',          false, true,  true),
  ('Priority Discovery',    false, true,  true),
  ('Rainbow Border',        false, false, true),
  ('Daily Coins',           false, false, true),
  ('Exclusive Stickers',    false, false, true),
  ('VIP Support',           false, false, true),
];

// ── Screen ────────────────────────────────────────────────────────────────────

class PremiumScreen extends ConsumerStatefulWidget {
  const PremiumScreen({super.key});

  @override
  ConsumerState<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends ConsumerState<PremiumScreen> {
  VipTier _selectedTier = VipTier.aPlus;
  bool _yearlyBilling = false;

  _TierConfig get _config => _tiers.firstWhere((t) => t.tier == _selectedTier);

  String get _productId {
    final tierSuffix = switch (_selectedTier) {
      VipTier.aPlus => 'aplus',
      VipTier.diamond => 'diamond',
      VipTier.rainbow => 'rainbow',
    };
    final billingCycle = _yearlyBilling ? 'yearly' : 'monthly';
    return 'gaymeet_vip_${tierSuffix}_$billingCycle';
  }

  Future<void> _purchase() async {
    final ok = await ref.read(subscriptionProvider.notifier).purchase(_productId);
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Welcome to ${_config.nameZh}! 🎉')),
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
    if (ok && ref.read(subscriptionProvider).isPremium) Navigator.of(context).pop();
  }

  void _showComparisonTable() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        builder: (_, controller) => Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Text('比较套餐 / Compare Plans',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            // Header row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const Expanded(flex: 3, child: SizedBox()),
                  ..._tiers.map((t) => Expanded(
                    child: Column(
                      children: [
                        Text(t.emoji, style: const TextStyle(fontSize: 20)),
                        const SizedBox(height: 2),
                        ShaderMask(
                          shaderCallback: (b) => t.gradient.createShader(b),
                          child: Text(t.name,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                                fontSize: 13,
                              )),
                        ),
                      ],
                    ),
                  )),
                ],
              ),
            ),
            const SizedBox(height: 10),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                controller: controller,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _comparisonFeatures.length,
                itemBuilder: (_, i) {
                  final f = _comparisonFeatures[i];
                  return Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: AppTheme.textHint.withValues(alpha: 0.15),
                          width: 1,
                        ),
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: Text(f.$1,
                              style: TextStyle(
                                fontSize: 12,
                                color: AppTheme.textSecondary,
                              )),
                        ),
                        ...[f.$2, f.$3, f.$4].map((has) => Expanded(
                          child: Center(
                            child: Icon(
                              has ? Icons.check_circle_rounded : Icons.remove_rounded,
                              size: 18,
                              color: has ? const Color(0xFF4CAF50) : AppTheme.textHint,
                            ),
                          ),
                        )),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sub = ref.watch(subscriptionProvider);
    final currency = ref.watch(currencyProvider);
    final currencyNotifier = ref.read(currencyProvider.notifier);

    return Scaffold(
      backgroundColor: AppTheme.bg,
      body: sub.isLoading
          ? const Center(child: CircularProgressIndicator())
          : CustomScrollView(
              slivers: [
                _buildHeader(),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      const SizedBox(height: 20),

                      // ── Billing toggle ─────────────────────────────────────
                      _BillingToggle(
                        yearly: _yearlyBilling,
                        onChanged: (v) => setState(() => _yearlyBilling = v),
                      ),

                      const SizedBox(height: 20),

                      // ── Section header ─────────────────────────────────────
                      _SectionHeader(label: '选择套餐 CHOOSE YOUR PLAN'),
                      const SizedBox(height: 12),

                      // ── Tier cards ─────────────────────────────────────────
                      ..._tiers.map((tier) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _TierCard(
                              config: tier,
                              selected: _selectedTier == tier.tier,
                              yearlyBilling: _yearlyBilling,
                              currencySymbol: currency.symbol,
                              formatPrice: currencyNotifier.formatPrice,
                              onTap: () => setState(() => _selectedTier = tier.tier),
                            ),
                          )),

                      const SizedBox(height: 16),

                      // ── Section header ─────────────────────────────────────
                      _SectionHeader(label: '套餐功能 PLAN FEATURES'),
                      const SizedBox(height: 12),

                      // ── Feature grid 2-column ─────────────────────────────
                      _FeatureGrid(config: _config),

                      const SizedBox(height: 16),

                      // ── Compare button ─────────────────────────────────────
                      GestureDetector(
                        onTap: _showComparisonTable,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: AppTheme.card,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: AppTheme.primary.withValues(alpha: 0.3),
                              width: 1,
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.compare_arrows_rounded,
                                  color: AppTheme.primary, size: 18),
                              const SizedBox(width: 8),
                              Text(
                                '比较所有套餐  Compare all plans',
                                style: TextStyle(
                                  color: AppTheme.primary,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // ── CTA ───────────────────────────────────────────────
                      _PurchaseButton(config: _config, onTap: _purchase),

                      const SizedBox(height: 14),
                      Center(
                        child: TextButton(
                          onPressed: _restore,
                          child: Text(
                            'Restore purchases',
                            style: TextStyle(
                                color: AppTheme.textSecondary, fontSize: 13),
                          ),
                        ),
                      ),
                      Center(
                        child: Text(
                          'Cancel anytime · Auto-renews · Secured by App Store',
                          style: TextStyle(fontSize: 11, color: AppTheme.textHint),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ]),
                  ),
                ),
              ],
            ),
    );
  }

  SliverAppBar _buildHeader() {
    final config = _config;
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
              const SizedBox(height: 48),
              // Animated tier icon
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: Container(
                  key: ValueKey(config.tier),
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: config.gradient,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: config.accentColor.withValues(alpha: 0.5),
                        blurRadius: 24,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(config.emoji,
                        style: const TextStyle(fontSize: 32)),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'GayMeet VIP',
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              ShaderMask(
                shaderCallback: (b) => AppColors.rainbowGradient.createShader(b),
                child: const Text(
                  '解锁你的全部潜能  Unlock your full potential',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
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
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.all(4),
      child: Row(
        children: [
          _Tab(label: '月付 Monthly', selected: !yearly, onTap: () => onChanged(false)),
          _Tab(
            label: '年付 Yearly',
            selected: yearly,
            onTap: () => onChanged(true),
            badge: 'Save ~40%',
          ),
        ],
      ),
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
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            gradient: selected ? AppTheme.brandGradient : null,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : AppTheme.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              if (badge != null)
                Container(
                  margin: const EdgeInsets.only(top: 3),
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: selected
                        ? Colors.white.withValues(alpha: 0.2)
                        : AppTheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    badge!,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: selected ? Colors.white : AppTheme.primary,
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

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 14,
          decoration: BoxDecoration(
            gradient: AppColors.pinkGradient,
            borderRadius: AppRadius.fullRadius,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppColors.textHint,
            letterSpacing: 1.2,
          ),
        ),
      ],
    );
  }
}

// ── Tier card ─────────────────────────────────────────────────────────────────

class _TierCard extends StatelessWidget {
  final _TierConfig config;
  final bool selected;
  final bool yearlyBilling;
  final String currencySymbol;
  final String Function(double) formatPrice;
  final VoidCallback onTap;

  const _TierCard({
    required this.config,
    required this.selected,
    required this.yearlyBilling,
    required this.currencySymbol,
    required this.formatPrice,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final amountMYR = yearlyBilling ? config.yearlyMYR : config.monthlyMYR;
    final priceStr = formatPrice(amountMYR);
    final period = yearlyBilling ? '/ year' : '/ month';

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected
              ? config.accentColor.withValues(alpha: 0.08)
              : AppTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? config.accentColor : const Color(0xFF3A3A3A),
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            // Radio
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected ? config.accentColor : AppTheme.textHint,
                  width: 2,
                ),
              ),
              child: selected
                  ? Center(
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: config.accentColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            // Emoji
            Text(config.emoji, style: const TextStyle(fontSize: 26)),
            const SizedBox(width: 10),
            // Name
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      ShaderMask(
                        shaderCallback: (b) => config.gradient.createShader(b),
                        child: Text(
                          config.nameZh,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          gradient: config.gradient,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          config.badge,
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    '${config.features.take(2).join(' · ')}…',
                    style: TextStyle(fontSize: 11, color: AppTheme.textHint),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            // Price
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  priceStr,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                    color: selected ? config.accentColor : AppTheme.textSecondary,
                  ),
                ),
                Text(
                  period,
                  style: TextStyle(fontSize: 10, color: AppTheme.textHint),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Feature grid (2-column) ───────────────────────────────────────────────────

class _FeatureGrid extends StatelessWidget {
  final _TierConfig config;
  const _FeatureGrid({required this.config});

  @override
  Widget build(BuildContext context) {
    final features = config.features;
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 2.6,
      ),
      itemCount: features.length,
      itemBuilder: (_, i) {
        final feature = features[i];
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: config.accentColor.withValues(alpha: 0.2),
              width: 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: config.accentColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  feature,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ── Purchase button ───────────────────────────────────────────────────────────

class _PurchaseButton extends StatelessWidget {
  final _TierConfig config;
  final VoidCallback onTap;
  const _PurchaseButton({required this.config, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 56,
        decoration: BoxDecoration(
          gradient: config.gradient,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: config.accentColor.withValues(alpha: 0.45),
              blurRadius: 18,
              offset: const Offset(0, 7),
            ),
          ],
        ),
        child: Center(
          child: Text(
            '${config.emoji}  立即解锁 Unlock Now',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: 0.3,
            ),
          ),
        ),
      ),
    );
  }
}
