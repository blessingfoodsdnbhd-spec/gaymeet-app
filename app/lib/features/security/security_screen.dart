import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/api/security_service.dart';
import '../../core/providers/auth_provider.dart';

final _securityServiceProvider = Provider<SecurityService>((ref) {
  return SecurityService(ref.watch(apiClientProvider));
});

final _twoFactorStatusProvider = FutureProvider<bool>((ref) async {
  final svc = ref.watch(_securityServiceProvider);
  return svc.getTwoFactorStatus();
});

class SecurityScreen extends ConsumerWidget {
  const SecurityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tfaStatus = ref.watch(_twoFactorStatusProvider);
    final svc = ref.watch(_securityServiceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('安全中心')),
      body: ListView(
        children: [
          // ── 双重验证 ────────────────────────────────────────────────────────
          _SectionHeader(title: '双重验证 (2FA)'),
          tfaStatus.when(
            loading: () => const ListTile(
              leading: Icon(Icons.lock_rounded),
              title: Text('双重验证'),
              subtitle: Text('加载中...'),
            ),
            error: (_, __) => ListTile(
              leading: const Icon(Icons.lock_rounded),
              title: const Text('双重验证'),
              subtitle: Text('加载失败', style: TextStyle(color: AppTheme.error)),
            ),
            data: (isEnabled) => ListTile(
              leading: Icon(
                Icons.lock_rounded,
                color: isEnabled ? Colors.green : AppTheme.textSecondary,
              ),
              title: const Text('双重验证'),
              subtitle: Text(
                isEnabled ? '已启用 — 账号受到保护' : '未启用 — 建议开启',
                style: TextStyle(
                  color: isEnabled ? Colors.green : AppTheme.textSecondary,
                ),
              ),
              trailing: Text(
                isEnabled ? '管理' : '开启',
                style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w600),
              ),
              onTap: () => context.push('/security/2fa'),
            ),
          ),

          const Divider(),

          // ── 设备管理 ────────────────────────────────────────────────────────
          _SectionHeader(title: '设备管理'),
          ListTile(
            leading: Icon(Icons.devices_rounded, color: AppTheme.primary),
            title: const Text('已登录设备'),
            subtitle: Text('查看并管理所有登录设备',
                style: TextStyle(color: AppTheme.textSecondary)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => context.push('/security/devices'),
          ),

          const Divider(),

          // ── 账号数据 ────────────────────────────────────────────────────────
          _SectionHeader(title: '账号数据'),
          ListTile(
            leading: Icon(Icons.download_rounded, color: AppTheme.accent),
            title: const Text('导出我的数据'),
            subtitle: Text('下载你的所有账号数据',
                style: TextStyle(color: AppTheme.textSecondary)),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () async {
              final messenger = ScaffoldMessenger.of(context);
              try {
                await svc.exportData();
                messenger.showSnackBar(
                  const SnackBar(content: Text('数据导出请求已发送')),
                );
              } catch (e) {
                messenger.showSnackBar(
                  SnackBar(content: Text('导出失败: $e')),
                );
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.delete_forever_rounded, color: Colors.red),
            title: const Text(
              '删除账号',
              style: TextStyle(color: Colors.red, fontWeight: FontWeight.w600),
            ),
            subtitle: const Text(
              '账号将在30天后永久删除，期间可取消',
              style: TextStyle(color: Colors.redAccent, fontSize: 12),
            ),
            trailing: const Icon(Icons.chevron_right_rounded, color: Colors.red),
            onTap: () => _showDeleteAccountDialog(context, ref, svc),
          ),
        ],
      ),
    );
  }

  void _showDeleteAccountDialog(
      BuildContext context, WidgetRef ref, SecurityService svc) {
    final passwordCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          '⚠️ 删除账号',
          style: TextStyle(color: Colors.red, fontWeight: FontWeight.w700),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '你的账号将在30天后永久删除。删除前可以登录取消。',
              style: TextStyle(fontSize: 14, height: 1.5),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: passwordCtrl,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: '确认密码',
                hintText: '输入你的密码',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () async {
              if (passwordCtrl.text.isEmpty) return;
              Navigator.pop(ctx);
              final messenger = ScaffoldMessenger.of(context);
              try {
                await svc.deleteAccount(passwordCtrl.text);
                messenger.showSnackBar(
                  const SnackBar(
                    content: Text('账号已申请删除，将在30天后永久删除'),
                    backgroundColor: Colors.orange,
                  ),
                );
                ref.read(authStateProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              } catch (e) {
                messenger.showSnackBar(
                  SnackBar(content: Text('删除失败: $e')),
                );
              }
            },
            child: const Text(
              '确认删除',
              style: TextStyle(color: Colors.red, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

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
