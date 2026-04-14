import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/api/security_service.dart';
import '../../core/providers/auth_provider.dart';

final _securitySvcProvider = Provider<SecurityService>((ref) {
  return SecurityService(ref.watch(apiClientProvider));
});

class TwoFactorScreen extends ConsumerStatefulWidget {
  const TwoFactorScreen({super.key});

  @override
  ConsumerState<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends ConsumerState<TwoFactorScreen> {
  int _step = 0; // 0=setup/loading, 1=verify OTP, 2=success+backup codes
  bool _loading = true;
  String? _qrCode;
  String? _secret;
  String? _error;
  List<String> _backupCodes = [];
  final _codeCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _setup();
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _setup() async {
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(_securitySvcProvider);
      final data = await svc.setup2FA();
      setState(() {
        _qrCode = data['qrCode'] as String?;
        _secret = data['secret'] as String?;
        _step = 0;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _verify() async {
    if (_codeCtrl.text.trim().length < 6) return;
    setState(() { _loading = true; _error = null; });
    try {
      final svc = ref.read(_securitySvcProvider);
      final codes = await svc.verify2FA(_codeCtrl.text.trim());
      setState(() {
        _backupCodes = codes;
        _step = 2;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = '验证码无效，请重试';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_step == 2 ? '2FA 已启用' : '设置双重验证'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _step == 0
              ? _buildError()
              : _step == 0
                  ? _buildSetupStep()
                  : _step == 1
                      ? _buildVerifyStep()
                      : _buildSuccessStep(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, color: AppTheme.error, size: 48),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: _setup, child: const Text('重试')),
          ],
        ),
      ),
    );
  }

  Widget _buildSetupStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '步骤 1：扫描二维码',
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            '使用 Google Authenticator 或 Authy 扫描下方二维码',
            style: TextStyle(color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 24),
          if (_qrCode != null)
            Center(
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Image.memory(
                  base64Decode(_qrCode!.split(',').last),
                  width: 200,
                  height: 200,
                ),
              ),
            ),
          const SizedBox(height: 24),
          if (_secret != null) ...[
            Text(
              '或手动输入密钥：',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: _secret!));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('密钥已复制')),
                );
              },
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _secret!,
                        style: const TextStyle(
                            fontFamily: 'monospace', fontSize: 13),
                      ),
                    ),
                    Icon(Icons.copy, size: 16, color: AppTheme.textSecondary),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => setState(() => _step = 1),
              child: const Text('下一步：验证'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVerifyStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '步骤 2：输入验证码',
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            '打开 Authenticator App，输入6位验证码',
            style: TextStyle(color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _codeCtrl,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 24, letterSpacing: 8),
            decoration: const InputDecoration(
              hintText: '000000',
              counterText: '',
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: TextStyle(color: AppTheme.error, fontSize: 13),
            ),
          ],
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _verify,
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('验证并启用'),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => setState(() { _step = 0; _error = null; }),
              child: const Text('返回'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessStep() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Column(
              children: [
                const Icon(Icons.check_circle_rounded,
                    color: Colors.green, size: 64),
                const SizedBox(height: 12),
                Text(
                  '双重验证已启用！',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700, color: Colors.green),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.orange.withValues(alpha: 0.5)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.warning_rounded,
                        color: Colors.orange, size: 20),
                    const SizedBox(width: 8),
                    const Text(
                      '请保存备用码',
                      style: TextStyle(
                          fontWeight: FontWeight.w700, color: Colors.orange),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  '如果丢失手机，可用这些备用码登录。每个备用码只能使用一次。',
                  style: TextStyle(fontSize: 13, height: 1.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ..._backupCodes.map(
            (code) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: AppTheme.primary.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.key_rounded, size: 16, color: Colors.grey),
                    const SizedBox(width: 12),
                    Text(
                      code,
                      style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 2),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                final allCodes = _backupCodes.join('\n');
                Clipboard.setData(ClipboardData(text: allCodes));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('备用码已复制到剪贴板')),
                );
              },
              child: const Text('复制所有备用码'),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('完成'),
            ),
          ),
        ],
      ),
    );
  }
}
