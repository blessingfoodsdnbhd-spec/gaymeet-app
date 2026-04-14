import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/privacy_provider.dart';
import '../../core/providers/subscription_provider.dart';

class StealthSettingsScreen extends ConsumerStatefulWidget {
  const StealthSettingsScreen({super.key});

  @override
  ConsumerState<StealthSettingsScreen> createState() =>
      _StealthSettingsScreenState();
}

class _StealthSettingsScreenState
    extends ConsumerState<StealthSettingsScreen> {
  Timer? _countdownTimer;
  Duration? _remaining;

  @override
  void initState() {
    super.initState();
    _startCountdownIfNeeded();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startCountdownIfNeeded() {
    final priv = ref.read(privacyProvider);
    if (priv.stealthOption == StealthOption.timed &&
        priv.stealthUntil != null &&
        !priv.isTimedStealthExpired) {
      _remaining = priv.stealthUntil!.difference(DateTime.now());
      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        final priv = ref.read(privacyProvider);
        if (priv.stealthUntil == null) {
          _countdownTimer?.cancel();
          return;
        }
        final r = priv.stealthUntil!.difference(DateTime.now());
        if (r.isNegative) {
          // Timed stealth expired — auto-deactivate
          ref.read(privacyProvider.notifier).setHideFromNearby(false);
          _countdownTimer?.cancel();
          if (mounted) setState(() => _remaining = null);
        } else {
          if (mounted) setState(() => _remaining = r);
        }
      });
    }
  }

  void _onMasterToggle(bool value, bool isPremium) async {
    if (value) {
      final priv = ref.read(privacyProvider);
      if (!isPremium && !priv.canActivateStealth) {
        _showLimitSheet();
        return;
      }
      await ref.read(privacyProvider.notifier).setHideFromNearby(true);
      _startCountdownIfNeeded();
    } else {
      await ref.read(privacyProvider.notifier).setHideFromNearby(false);
      _countdownTimer?.cancel();
      setState(() => _remaining = null);
    }
  }

  void _onOptionSelected(StealthOption opt, bool isPremium) async {
    if (!isPremium && opt != StealthOption.complete) {
      _showPremiumGate('仅好友可见 / 自定义时间是高级功能');
      return;
    }
    ref.read(privacyProvider.notifier).setStealthOption(opt);
  }

  void _onTimedActivate(int hours, bool isPremium) async {
    final success = await ref
        .read(privacyProvider.notifier)
        .activateTimedStealth(hours, isPremium: isPremium);
    if (!success) {
      _showLimitSheet();
      return;
    }
    _countdownTimer?.cancel();
    _startCountdownIfNeeded();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('隐身已开启 $hours 小时'),
          backgroundColor: AppTheme.primary,
        ),
      );
    }
  }

  void _showLimitSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            const Text('👻', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text('今日免费隐身已用完',
                style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(
              '免费用户每天可激活1次隐身。升级高级会员享无限隐身。',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/premium');
                },
                child: const Text('升级高级会员 🔥'),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showPremiumGate(String msg) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Icon(Icons.lock_rounded, color: AppTheme.primary, size: 48),
            const SizedBox(height: 12),
            Text('高级功能',
                style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(msg,
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 13,
                    height: 1.5)),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/premium');
                },
                child: const Text('升级高级会员 🔥'),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String _formatRemaining(Duration d) {
    if (d.inHours > 0) {
      return '${d.inHours}h ${d.inMinutes.remainder(60)}m 后关闭';
    }
    if (d.inMinutes > 0) {
      return '${d.inMinutes}m ${d.inSeconds.remainder(60)}s 后关闭';
    }
    return '${d.inSeconds}s 后关闭';
  }

  @override
  Widget build(BuildContext context) {
    final priv = ref.watch(privacyProvider);
    final isPremium = ref.watch(subscriptionProvider).isPremium;
    final stealthOn = priv.hideFromNearby;

    return Scaffold(
      backgroundColor: AppTheme.bg,
      appBar: AppBar(
        backgroundColor: AppTheme.bg,
        title: const Text('隐身遮蔽',
            style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Shield hero ──────────────────────────────────────────────
            Center(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 400),
                curve: Curves.easeInOut,
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: stealthOn ? AppTheme.brandGradient : null,
                  color: stealthOn ? null : AppTheme.card,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  stealthOn
                      ? Icons.shield_rounded
                      : Icons.shield_outlined,
                  size: 52,
                  color: stealthOn ? Colors.white : AppTheme.textHint,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Center(
              child: Text(
                stealthOn ? '隐身已开启' : '隐身已关闭',
                style: TextStyle(
                  color: stealthOn ? AppTheme.primary : AppTheme.textSecondary,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
            ),
            if (stealthOn && _remaining != null) ...[
              const SizedBox(height: 4),
              Center(
                child: Text(
                  _formatRemaining(_remaining!),
                  style: TextStyle(
                      color: AppTheme.textHint, fontSize: 12),
                ),
              ),
            ],
            const SizedBox(height: 20),

            // ── Explanation ───────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded,
                      color: AppTheme.textHint, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '开启后，你不会出现在附近列表中，但仍可主动查看和聊天。',
                      style: TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 13,
                          height: 1.5),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Free user limit ───────────────────────────────────────────
            if (!isPremium)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: priv.canActivateStealth
                      ? AppTheme.primary.withValues(alpha: 0.08)
                      : AppTheme.error.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: priv.canActivateStealth
                        ? AppTheme.primary.withValues(alpha: 0.25)
                        : AppTheme.error.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      priv.canActivateStealth
                          ? Icons.info_rounded
                          : Icons.warning_rounded,
                      color: priv.canActivateStealth
                          ? AppTheme.primary
                          : AppTheme.error,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        priv.canActivateStealth
                            ? '免费用户每天可激活1次隐身'
                            : '今日免费隐身已用完 — 升级高级会员享无限隐身',
                        style: TextStyle(
                          color: priv.canActivateStealth
                              ? AppTheme.primary
                              : AppTheme.error,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // ── Master toggle ─────────────────────────────────────────────
            _ToggleCard(
              icon: Icons.shield_rounded,
              title: '隐身模式',
              subtitle: stealthOn ? '已开启 — 你在附近列表中不可见' : '关闭 — 其他用户可以看到你',
              value: stealthOn,
              onChanged: (v) => _onMasterToggle(v, isPremium),
            ),
            const SizedBox(height: 16),

            // ── Stealth options ───────────────────────────────────────────
            _SectionLabel('隐身方式'),
            const SizedBox(height: 8),
            _OptionCard(
              icon: Icons.visibility_off_rounded,
              title: '完全隐身',
              subtitle: '所有人都无法在附近看到你',
              selected: priv.stealthOption == StealthOption.complete,
              isPremiumRequired: false,
              onTap: () => _onOptionSelected(StealthOption.complete, isPremium),
            ),
            const SizedBox(height: 8),
            _OptionCard(
              icon: Icons.favorite_rounded,
              title: '仅好友可见',
              subtitle: '只有已配对的用户可以看到你',
              selected: priv.stealthOption == StealthOption.friendsOnly,
              isPremiumRequired: !isPremium,
              onTap: () =>
                  _onOptionSelected(StealthOption.friendsOnly, isPremium),
            ),

            const SizedBox(height: 16),
            _SectionLabel('自定义时间'),
            const SizedBox(height: 8),

            // Timed options
            Row(
              children: [1, 3, 6, 24].map((h) {
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      if (!isPremium && !priv.canActivateStealth) {
                        _showLimitSheet();
                        return;
                      }
                      _onTimedActivate(h, isPremium);
                    },
                    child: Container(
                      margin: EdgeInsets.only(
                          right: h == 24 ? 0 : 8),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: priv.stealthOption == StealthOption.timed &&
                                priv.stealthUntil != null &&
                                priv.hideFromNearby
                            ? AppTheme.primary.withValues(alpha: 0.15)
                            : AppTheme.card,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: priv.stealthOption == StealthOption.timed &&
                                  priv.hideFromNearby
                              ? AppTheme.primary.withValues(alpha: 0.4)
                              : const Color(0xFF2A2A2A),
                        ),
                      ),
                      child: Column(
                        children: [
                          Text('${h}h',
                              style: TextStyle(
                                color: AppTheme.textPrimary,
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              )),
                          Text(
                            h == 1 ? '1小时' : h == 24 ? '1天' : '$h小时',
                            style: TextStyle(
                                color: AppTheme.textHint, fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Helper widgets ────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        color: AppTheme.textSecondary,
        fontSize: 12,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.4,
      ),
    );
  }
}

class _ToggleCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: value
            ? Border.all(color: AppTheme.primary.withValues(alpha: 0.3))
            : null,
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              gradient: value ? AppTheme.brandGradient : null,
              color: value ? null : AppTheme.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon,
                color: value ? Colors.white : AppTheme.textHint, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        color: AppTheme.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14)),
                Text(subtitle,
                    style: TextStyle(
                        color: AppTheme.textHint, fontSize: 12)),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged, activeThumbColor: AppTheme.primary),
        ],
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final bool isPremiumRequired;
  final VoidCallback onTap;

  const _OptionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.isPremiumRequired,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected
              ? AppTheme.primary.withValues(alpha: 0.1)
              : AppTheme.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected
                ? AppTheme.primary.withValues(alpha: 0.4)
                : const Color(0xFF2A2A2A),
          ),
        ),
        child: Row(
          children: [
            Icon(icon,
                color: selected ? AppTheme.primary : AppTheme.textHint,
                size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: TextStyle(
                        color: selected
                            ? AppTheme.primary
                            : AppTheme.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      )),
                  Text(subtitle,
                      style:
                          TextStyle(color: AppTheme.textHint, fontSize: 12)),
                ],
              ),
            ),
            if (isPremiumRequired)
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  gradient: AppTheme.brandGradient,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('VIP',
                    style: TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w800)),
              )
            else if (selected)
              Icon(Icons.check_circle_rounded,
                  color: AppTheme.primary, size: 20),
          ],
        ),
      ),
    );
  }
}
