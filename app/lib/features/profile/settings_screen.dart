import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/privacy_provider.dart';
import '../../core/providers/referral_provider.dart';
import '../../core/providers/subscription_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  // Prevent toggling while a save is in flight
  bool _saving = false;

  Future<void> _toggle(Future<bool> Function() action) async {
    if (_saving) return;
    setState(() => _saving = true);
    final ok = await action();
    if (mounted) {
      setState(() => _saving = false);
      if (!ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to save. Check your connection.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).user;
    final privacy = ref.watch(privacyProvider);
    final notifier = ref.read(privacyProvider.notifier);
    final sub = ref.watch(subscriptionProvider);
    final subNotifier = ref.read(subscriptionProvider.notifier);
    final referral = ref.watch(referralProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          // ── Account ────────────────────────────────────────────────────────
          const _SectionHeader(title: 'ACCOUNT'),
          ListTile(
            leading: const Icon(Icons.email_outlined),
            title: const Text('Email'),
            subtitle: Text(user?.email ?? 'Not set',
                style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ListTile(
            leading: const Icon(Icons.workspace_premium),
            title: const Text('Subscription'),
            subtitle: Text(
              sub.isPremium ? 'Premium' : 'Free plan',
              style: TextStyle(color: AppTheme.textSecondary),
            ),
            trailing: sub.isPremium
                ? Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                          colors: [Color(0xFFFFD700), Color(0xFFFFA726)]),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text('PREMIUM',
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Colors.black)),
                  )
                : TextButton(
                    onPressed: () => context.push('/premium'),
                    child: Text('Upgrade',
                        style: TextStyle(color: AppTheme.primary)),
                  ),
          ),

          const Divider(),

          // ── Privacy ────────────────────────────────────────────────────────
          const _SectionHeader(title: 'PRIVACY'),

          _PrivacyTile(
            icon: Icons.location_off_outlined,
            title: 'Hide Distance',
            subtitle: 'Others won\'t see how far you are',
            value: privacy.hideDistance,
            enabled: !_saving,
            onChanged: (v) =>
                _toggle(() => notifier.setHideDistance(v)),
          ),

          _PrivacyTile(
            icon: Icons.visibility_off_outlined,
            title: 'Hide Online Status',
            subtitle: 'Don\'t show the green dot when you\'re active',
            value: privacy.hideOnlineStatus,
            enabled: !_saving,
            onChanged: (v) =>
                _toggle(() => notifier.setHideOnlineStatus(v)),
          ),

          _PrivacyTile(
            icon: Icons.person_off_outlined,
            title: 'Hide from Nearby',
            subtitle: 'Your profile won\'t appear in Nearby or Discover',
            value: privacy.hideFromNearby,
            enabled: !_saving,
            onChanged: (v) =>
                _toggle(() => notifier.setHideFromNearby(v)),
          ),

          // Contextual hint when any privacy setting is active
          if (privacy.hideFromNearby)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: AppTheme.primary.withValues(alpha: 0.3), width: 1),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline_rounded,
                        size: 16, color: AppTheme.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'You\'re hidden from discovery. You can still like others and message existing matches.',
                        style: TextStyle(
                            fontSize: 12,
                            color: AppTheme.textSecondary,
                            height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          const Divider(),

          const Divider(),

          // ── Security ───────────────────────────────────────────────────────
          const _SectionHeader(title: 'SECURITY'),
          ListTile(
            leading: const Icon(Icons.security_rounded, color: Color(0xFF7C4DFF)),
            title: const Text('Security & 2FA'),
            subtitle: Text('Two-factor auth, data export, account deletion',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/settings/security'),
          ),

          const Divider(),

          // ── Personalisation ────────────────────────────────────────────────
          const _SectionHeader(title: 'PERSONALISATION'),
          ListTile(
            leading: Icon(Icons.currency_exchange_rounded, color: AppTheme.accent),
            title: const Text('货币 / Currency'),
            subtitle: Text('Display prices in your currency',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/settings/currency'),
          ),
          ListTile(
            leading: const Icon(Icons.calendar_month_rounded, color: Color(0xFF2196F3)),
            title: const Text('Calendar / 日历'),
            subtitle: Text('Your dates and reminders',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/calendar'),
          ),
          ListTile(
            leading: Icon(Icons.translate_rounded, color: AppTheme.primary),
            title: const Text('语言 / Language'),
            subtitle: Text('切换应用语言',
                style: TextStyle(color: AppTheme.textSecondary)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/settings/language'),
          ),
          ListTile(
            leading: Icon(Icons.palette_rounded, color: AppTheme.accent),
            title: const Text('外观 / Theme'),
            subtitle: Text('深色 / 浅色 / 系统',
                style: TextStyle(color: AppTheme.textSecondary)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/settings/theme'),
          ),
          ListTile(
            leading: const Text('🩺', style: TextStyle(fontSize: 22)),
            title: const Text('健康提醒'),
            subtitle: Text('定期HIV检测提醒',
                style: TextStyle(color: AppTheme.textSecondary)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/health-reminder'),
          ),

          const Divider(),

          // ── Referral ───────────────────────────────────────────────────────
          const _SectionHeader(title: 'EARN MONEY'),
          ListTile(
            leading: Container(
              padding: const EdgeInsets.all(6),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFFFB300), Color(0xFFFF6D00)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
              ),
              child: const Text('💰', style: TextStyle(fontSize: 14)),
            ),
            title: const Text('邀请好友得奖励 🎁'),
            subtitle: Text(
              referral.walletBalance > 0
                  ? '已获得 ${(referral.walletBalance * 10).toInt()}🪙 金币奖励'
                  : '邀请好友注册，双方得金币奖励',
              style: TextStyle(color: AppTheme.textSecondary),
            ),
            trailing: referral.walletBalance > 0
                ? Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                          colors: [Color(0xFFFFB300), Color(0xFFFF6D00)]),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${(referral.walletBalance * 10).toInt()}🪙',
                      style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Colors.black),
                    ),
                  )
                : const Icon(Icons.chevron_right_rounded),
            onTap: () {
              ref.read(referralProvider.notifier).load();
              context.push('/referral');
            },
          ),

          const Divider(),

          // ── Features ───────────────────────────────────────────────────────
          const _SectionHeader(title: 'FEATURES'),
          ListTile(
            leading: const Icon(Icons.verified_user_rounded,
                color: Color(0xFF1976D2)),
            title: const Text('真人认证'),
            subtitle: Text(
              user?.isVerified == true ? '已认证 ✓' : '完成认证获得蓝色徽章',
              style: TextStyle(
                color: user?.isVerified == true
                    ? const Color(0xFF4CAF50)
                    : AppTheme.textSecondary,
              ),
            ),
            trailing: user?.isVerified == true
                ? null
                : const Icon(Icons.chevron_right_rounded),
            onTap: user?.isVerified == true
                ? null
                : () => context.push('/verification'),
          ),
          ListTile(
            leading: const Icon(Icons.mark_email_unread_rounded),
            title: const Text('私信箱'),
            subtitle:
                Text('收件箱', style: TextStyle(color: AppTheme.textSecondary)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/dm/inbox'),
          ),
          ListTile(
            leading: const Icon(Icons.call_rounded, color: Color(0xFF4CAF50)),
            title: const Text('通话记录'),
            subtitle: Text('语音/视频通话历史',
                style: TextStyle(color: AppTheme.textSecondary)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/call/history'),
          ),
          ListTile(
            leading: const Icon(Icons.emoji_emotions_rounded,
                color: Color(0xFFFFB300)),
            title: const Text('贴图商店'),
            subtitle: Text('获取更多表情贴图',
                style: TextStyle(color: AppTheme.textSecondary)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/stickers'),
          ),
          ListTile(
            leading:
                const Text('🔮', style: TextStyle(fontSize: 22)),
            title: const Text('暗号匹配'),
            subtitle: Text('用暗号找到你的缘分',
                style: TextStyle(color: AppTheme.textSecondary)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/secret-code'),
          ),

          const Divider(),

          // ── Danger zone ────────────────────────────────────────────────────
          const _SectionHeader(title: 'ACCOUNT ACTIONS'),
          if (!sub.isPremium)
            ListTile(
              leading: Icon(Icons.restore, color: AppTheme.textSecondary),
              title: Text('Restore Purchases',
                  style: TextStyle(color: AppTheme.textSecondary)),
              onTap: () async {
                final ok = await subNotifier.restore();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                    content: Text(ok
                        ? (ref.read(subscriptionProvider).isPremium
                            ? 'Premium restored!'
                            : 'No active subscription found.')
                        : 'Restore failed. Try again.'),
                  ));
                }
              },
            ),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.redAccent),
            title: const Text('Log Out',
                style: TextStyle(color: Colors.redAccent)),
            onTap: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  backgroundColor: AppTheme.surface,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16)),
                  title: const Text('Log Out'),
                  content: const Text('Are you sure you want to log out?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Cancel'),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        ref.read(authStateProvider.notifier).logout();
                        context.go('/login');
                      },
                      child: const Text('Log Out',
                          style: TextStyle(color: Colors.redAccent)),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
      child: Row(
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
            title,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textHint,
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Privacy toggle tile ───────────────────────────────────────────────────────

class _PrivacyTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  const _PrivacyTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      secondary: Icon(
        icon,
        color: value ? AppTheme.primary : AppTheme.textSecondary,
      ),
      title: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.w500,
          color: enabled ? AppTheme.textPrimary : AppTheme.textHint,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(fontSize: 12),
      ),
      value: value,
      onChanged: enabled ? onChanged : null,
      activeColor: AppTheme.primary,
      inactiveThumbColor: AppTheme.textHint,
      inactiveTrackColor: AppTheme.card,
    );
  }
}
