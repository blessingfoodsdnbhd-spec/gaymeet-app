import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../core/providers/auth_provider.dart';

class OtpLoginSheet extends ConsumerStatefulWidget {
  const OtpLoginSheet({super.key});

  @override
  ConsumerState<OtpLoginSheet> createState() => _OtpLoginSheetState();
}

class _OtpLoginSheetState extends ConsumerState<OtpLoginSheet> {
  int _step = 0; // 0 = enter email, 1 = enter OTP
  bool _loading = false;
  String? _error;
  String? _email;

  final _emailC = TextEditingController();
  final _codeC = TextEditingController();

  @override
  void dispose() {
    _emailC.dispose();
    _codeC.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final email = _emailC.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = '请输入有效的邮箱地址');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = Dio();
      await dio.post(
        '${AppConstants.apiBaseUrl}/auth/send-otp',
        data: {'email': email},
      );
      setState(() {
        _step = 1;
        _email = email;
      });
    } on DioException catch (e) {
      final msg = e.response?.data?['error'];
      setState(() => _error = msg ?? '发送失败，请稍后再试');
    } catch (_) {
      setState(() => _error = '网络错误，请检查连接');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyOtp() async {
    final code = _codeC.text.trim();
    if (code.length != 6) {
      setState(() => _error = '请输入6位验证码');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final ok = await ref
        .read(authStateProvider.notifier)
        .loginWithOtp(_email!, code);
    if (!mounted) return;
    if (ok) {
      Navigator.pop(context);
      context.go('/home');
    } else {
      setState(() {
        _loading = false;
        _error = ref.read(authStateProvider).error ?? '验证失败';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, bottom + 28),
      decoration: const BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textHint.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Title
          Text(
            _step == 0 ? '邮箱验证码登录' : '输入验证码',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _step == 0
                ? '输入邮箱，我们将发送6位验证码'
                : '验证码已发送至 $_email',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
          ),
          const SizedBox(height: 20),

          if (_step == 0) ...[
            TextField(
              controller: _emailC,
              keyboardType: TextInputType.emailAddress,
              autofocus: true,
              style: AppTypography.body,
              decoration: const InputDecoration(
                hintText: '邮箱地址',
                prefixIcon: Icon(Icons.mail_outline_rounded, size: 20),
              ),
            ),
          ] else ...[
            TextField(
              controller: _codeC,
              keyboardType: TextInputType.number,
              autofocus: true,
              maxLength: 6,
              style: AppTypography.body.copyWith(
                fontSize: 24,
                letterSpacing: 6,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
              decoration: const InputDecoration(
                hintText: '──────',
                hintStyle: TextStyle(letterSpacing: 6),
                counterText: '',
              ),
            ),
            const SizedBox(height: 8),
            // Resend link
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _loading
                    ? null
                    : () => setState(() {
                          _step = 0;
                          _codeC.clear();
                          _error = null;
                        }),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  '重新发送',
                  style: TextStyle(
                    color: AppColors.hotPink,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ],

          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.error, fontSize: 13),
            ),
          ],

          const SizedBox(height: 20),

          // Action button
          GestureDetector(
            onTap: _loading ? null : (_step == 0 ? _sendOtp : _verifyOtp),
            child: Container(
              height: 50,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFAB5CF7)],
                ),
                borderRadius: AppRadius.lgRadius,
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF7C3AED).withValues(alpha: 0.4),
                    blurRadius: 14,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Center(
                child: _loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2),
                      )
                    : Text(
                        _step == 0 ? '发送验证码' : '登录 / 注册',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
