import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/auth_provider.dart';

// ── Providers ─────────────────────────────────────────────────────────────────

final _twoFaStatusProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.dio.get('/2fa/status');
  return Map<String, dynamic>.from(res.data['data'] as Map);
});

// ── Screen ────────────────────────────────────────────────────────────────────

class SecurityScreen extends ConsumerStatefulWidget {
  const SecurityScreen({super.key});

  @override
  ConsumerState<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends ConsumerState<SecurityScreen> {
  bool _exportLoading = false;
  bool _deleteLoading = false;

  // ── 2FA ───────────────────────────────────────────────────────────────────

  Future<void> _setup2FA() async {
    final api = ref.read(apiClientProvider);
    try {
      final res = await api.dio.post('/2fa/setup');
      final data = res.data['data'] as Map;
      if (!mounted) return;
      await _showSetupSheet(data['secret'] as String, data['otpauthUri'] as String);
    } catch (e) {
      _snack('Setup failed: ${_parseError(e)}', error: true);
    }
  }

  Future<void> _showSetupSheet(String secret, String otpauthUri) async {
    final controller = TextEditingController();
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24, right: 24, top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 32,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    gradient: AppTheme.brandGradient,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.lock_rounded, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 12),
                const Text('Set up 2FA',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 20),
            Text('1. Open your authenticator app (Google Authenticator, Authy…)',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
            const SizedBox(height: 8),
            Text('2. Scan the QR code or enter this secret manually:',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: secret));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Secret copied!')),
                );
              },
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(secret,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 15,
                            letterSpacing: 2,
                            fontWeight: FontWeight.w600,
                          )),
                    ),
                    Icon(Icons.copy_rounded, size: 16, color: AppTheme.primary),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text('3. Enter the 6-digit code from your app:',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: InputDecoration(
                hintText: '000000',
                filled: true,
                fillColor: AppTheme.card,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                counterText: '',
                hintStyle: TextStyle(color: AppTheme.textHint),
              ),
              style: const TextStyle(fontSize: 22, letterSpacing: 8, fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () async {
                  Navigator.pop(ctx);
                  await _verify2FA(controller.text.trim());
                },
                child: const Text('Verify & Enable', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _verify2FA(String token) async {
    if (token.length != 6) {
      _snack('Enter the 6-digit code from your authenticator app.', error: true);
      return;
    }
    final api = ref.read(apiClientProvider);
    try {
      final res = await api.dio.post('/2fa/verify', data: {'token': token});
      final codes = (res.data['data']['backupCodes'] as List).cast<String>();
      ref.invalidate(_twoFaStatusProvider);
      if (mounted) _showBackupCodes(codes);
    } catch (e) {
      _snack('Verification failed: ${_parseError(e)}', error: true);
    }
  }

  void _showBackupCodes(List<String> codes) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('2FA Enabled! 🎉', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Save these backup codes in a safe place. Each can only be used once.',
                style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
            const SizedBox(height: 14),
            ...codes.map((c) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Text('• $c',
                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600)),
                )),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: codes.join('\n')));
              _snack('Codes copied!');
            },
            child: Text('Copy All', style: TextStyle(color: AppTheme.primary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Done', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<void> _disable2FA() async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Disable 2FA'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Enter your current OTP or a backup code to disable 2FA.',
                style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                hintText: '6-digit code',
                filled: true,
                fillColor: AppTheme.card,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Disable', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    final api = ref.read(apiClientProvider);
    try {
      await api.dio.post('/2fa/disable', data: {'token': controller.text.trim()});
      ref.invalidate(_twoFaStatusProvider);
      _snack('2FA disabled.');
    } catch (e) {
      _snack('Failed: ${_parseError(e)}', error: true);
    }
  }

  // ── Data export ───────────────────────────────────────────────────────────

  Future<void> _exportData() async {
    setState(() => _exportLoading = true);
    final api = ref.read(apiClientProvider);
    try {
      await api.dio.get('/account/export');
      _snack('Your data export has been prepared.');
    } catch (e) {
      _snack('Export failed: ${_parseError(e)}', error: true);
    } finally {
      if (mounted) setState(() => _exportLoading = false);
    }
  }

  // ── Delete account ────────────────────────────────────────────────────────

  Future<void> _deleteAccount() async {
    final passController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Delete Account', style: TextStyle(color: Colors.redAccent)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '⚠️ This will permanently delete your profile, matches, and all data. This cannot be undone.',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: passController,
              obscureText: true,
              decoration: InputDecoration(
                hintText: 'Confirm your password',
                filled: true,
                fillColor: AppTheme.card,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete Forever', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    setState(() => _deleteLoading = true);
    final api = ref.read(apiClientProvider);
    try {
      await api.dio.delete('/account', data: {'password': passController.text});
      ref.read(authStateProvider.notifier).logout();
    } catch (e) {
      if (mounted) {
        setState(() => _deleteLoading = false);
        _snack('Delete failed: ${_parseError(e)}', error: true);
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? Colors.redAccent : null,
      ),
    );
  }

  String _parseError(dynamic e) {
    return e.toString().replaceAll('Exception: ', '').replaceAll('DioException', '');
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final twoFaAsync = ref.watch(_twoFaStatusProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Security'),
        backgroundColor: AppTheme.bg,
        elevation: 0,
      ),
      body: ListView(
        children: [
          // ── Two-Factor Authentication ─────────────────────────────────────
          _SectionHeader(title: 'TWO-FACTOR AUTHENTICATION'),
          twoFaAsync.when(
            loading: () => const ListTile(
              leading: Icon(Icons.security_rounded),
              title: Text('Two-Factor Auth (2FA)'),
              trailing: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            error: (_, __) => ListTile(
              leading: const Icon(Icons.security_rounded),
              title: const Text('Two-Factor Auth (2FA)'),
              subtitle: Text('Failed to load status', style: TextStyle(color: AppTheme.textHint)),
            ),
            data: (status) {
              final enabled = status['isEnabled'] as bool? ?? false;
              return ListTile(
                leading: Icon(
                  Icons.security_rounded,
                  color: enabled ? AppTheme.primary : AppTheme.textSecondary,
                ),
                title: const Text('Two-Factor Auth (2FA)'),
                subtitle: Text(
                  enabled ? 'Enabled — your account is extra secure' : 'Add an extra layer of security',
                  style: TextStyle(
                    color: enabled ? const Color(0xFF4CAF50) : AppTheme.textSecondary,
                    fontSize: 12,
                  ),
                ),
                trailing: enabled
                    ? TextButton(
                        onPressed: _disable2FA,
                        child: const Text('Disable', style: TextStyle(color: Colors.redAccent)),
                      )
                    : ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                        onPressed: _setup2FA,
                        child: const Text('Enable'),
                      ),
              );
            },
          ),

          const Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Text(
              'After enabling 2FA, you\'ll need a code from your authenticator app each time you log in.',
              style: TextStyle(fontSize: 12, color: Color(0xFF6B5E7A), height: 1.4),
            ),
          ),

          const Divider(),

          // ── Active Devices / Sessions ─────────────────────────────────────
          _SectionHeader(title: 'ACTIVE SESSIONS'),
          ListTile(
            leading: const Icon(Icons.smartphone_rounded, color: Color(0xFF4CAF50)),
            title: const Text('This device'),
            subtitle: Text('Current session', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF4CAF50).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text('Active', style: TextStyle(fontSize: 11, color: Color(0xFF4CAF50), fontWeight: FontWeight.w600)),
            ),
          ),

          const Divider(),

          // ── Data & Privacy ────────────────────────────────────────────────
          _SectionHeader(title: 'DATA & PRIVACY'),
          ListTile(
            leading: const Icon(Icons.download_rounded, color: Color(0xFF2196F3)),
            title: const Text('Export My Data'),
            subtitle: Text('Download a copy of your profile & messages',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
            trailing: _exportLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.chevron_right_rounded),
            onTap: _exportLoading ? null : _exportData,
          ),

          const Divider(),

          // ── Danger Zone ───────────────────────────────────────────────────
          _SectionHeader(title: 'DANGER ZONE'),
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.redAccent.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.redAccent.withValues(alpha: 0.25), width: 1),
            ),
            child: ListTile(
              leading: const Icon(Icons.delete_forever_rounded, color: Colors.redAccent),
              title: const Text('Delete Account',
                  style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600)),
              subtitle: Text('Permanently remove all your data',
                  style: TextStyle(color: Colors.redAccent.withValues(alpha: 0.7), fontSize: 12)),
              trailing: _deleteLoading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.redAccent))
                  : const Icon(Icons.chevron_right_rounded, color: Colors.redAccent),
              onTap: _deleteLoading ? null : _deleteAccount,
            ),
          ),
          const SizedBox(height: 40),
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
