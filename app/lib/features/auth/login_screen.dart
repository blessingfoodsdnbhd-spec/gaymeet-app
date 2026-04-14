import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../config/theme.dart';
import '../../config/constants.dart';
import '../../core/providers/auth_provider.dart';
import '../../shared/widgets/design_system/rainbow_border.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _emailC = TextEditingController();
  final _passC = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscure = true;
  late AnimationController _fadeCtrl;
  late Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _fadeCtrl.forward();
  }

  @override
  void dispose() {
    _emailC.dispose();
    _passC.dispose();
    _fadeCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await ref
        .read(authStateProvider.notifier)
        .login(_emailC.text.trim(), _passC.text);
    if (ok && mounted) context.go('/home');
  }

  void _showForgotPasswordSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _ForgotPasswordSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authStateProvider);
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: FadeTransition(
        opacity: _fadeAnim,
        child: SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(24, 40, 24, bottom + 24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 32),

                  // ── Logo with rainbow border ──────────────────────────────────
                  Center(
                    child: RainbowBorder(
                      borderWidth: 2.5,
                      borderRadius: 28,
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: const BoxDecoration(
                          gradient: AppColors.pinkPurpleGradient,
                        ),
                        child: const Icon(Icons.favorite_rounded,
                            size: 44, color: Colors.white),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // ── App name ──────────────────────────────────────────────────
                  Center(
                    child: ShaderMask(
                      shaderCallback: (bounds) =>
                          AppColors.rainbowGradient.createShader(bounds),
                      child: const Text(
                        'Meetup Nearby',
                        style: TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Center(
                    child: Text(
                      'Find your people.',
                      style: TextStyle(
                        fontSize: 16,
                        color: AppColors.textSecondary,
                        height: 1.4,
                      ),
                    ),
                  ),

                  const SizedBox(height: 48),

                  // ── Glass card ────────────────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.bgCard,
                      borderRadius: AppRadius.lgRadius,
                      border: Border.all(
                          color: AppColors.pink500.withValues(alpha: 0.15), width: 1),
                    ),
                    child: Column(
                      children: [
                        // Email
                        TextFormField(
                          controller: _emailC,
                          keyboardType: TextInputType.emailAddress,
                          style: AppTypography.body,
                          decoration: const InputDecoration(
                            hintText: 'Email address',
                            prefixIcon:
                                Icon(Icons.mail_outline_rounded, size: 20),
                          ),
                          validator: (v) => v == null || !v.contains('@')
                              ? 'Valid email required'
                              : null,
                        ),
                        const SizedBox(height: 14),

                        // Password
                        TextFormField(
                          controller: _passC,
                          obscureText: _obscure,
                          style: AppTypography.body,
                          decoration: InputDecoration(
                            hintText: 'Password',
                            prefixIcon: const Icon(
                                Icons.lock_outline_rounded,
                                size: 20),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscure
                                    ? Icons.visibility_off
                                    : Icons.visibility,
                                size: 20,
                                color: AppColors.textHint,
                              ),
                              onPressed: () =>
                                  setState(() => _obscure = !_obscure),
                            ),
                          ),
                          validator: (v) => v == null || v.length < 6
                              ? 'Min 6 characters'
                              : null,
                        ),
                      ],
                    ),
                  ),

                  // ── Forgot password ───────────────────────────────────────────
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => _showForgotPasswordSheet(context),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(
                        '忘记密码?',
                        style: TextStyle(
                          color: AppColors.hotPink,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),

                  // ── Error ─────────────────────────────────────────────────────
                  if (auth.error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.1),
                        borderRadius: AppRadius.mdRadius,
                        border: Border.all(
                            color: AppColors.error.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline,
                              color: AppColors.error, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(auth.error!,
                                style: const TextStyle(
                                    color: AppColors.error, fontSize: 13)),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 28),

                  // ── Login button ──────────────────────────────────────────────
                  GestureDetector(
                    onTap: auth.isLoading ? null : _login,
                    child: Container(
                      height: 54,
                      decoration: BoxDecoration(
                        gradient: AppColors.pinkPurpleGradient,
                        borderRadius: AppRadius.lgRadius,
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.hotPink.withValues(alpha: 0.4),
                            blurRadius: 18,
                            offset: const Offset(0, 6),
                          )
                        ],
                      ),
                      child: Center(
                        child: auth.isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2),
                              )
                            : const Text(
                                'Log In',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                  letterSpacing: 0.3,
                                ),
                              ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),

                  // ── Divider ───────────────────────────────────────────────────
                  Row(
                    children: [
                      Expanded(child: Divider(color: AppColors.pink500.withValues(alpha: 0.2))),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text('or',
                            style: TextStyle(
                                color: AppColors.textHint, fontSize: 13)),
                      ),
                      Expanded(child: Divider(color: AppColors.pink500.withValues(alpha: 0.2))),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // ── Social buttons ────────────────────────────────────────────
                  OutlinedButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.g_mobiledata_rounded, size: 24),
                    label: const Text('Continue with Google'),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.apple_rounded, size: 20),
                    label: const Text('Continue with Apple'),
                  ),

                  const SizedBox(height: 32),

                  // ── Register link ─────────────────────────────────────────────
                  Center(
                    child: GestureDetector(
                      onTap: () => context.go('/register'),
                      child: RichText(
                        text: TextSpan(
                          style: TextStyle(
                              color: AppColors.textSecondary, fontSize: 14),
                          children: [
                            const TextSpan(text: "Don't have an account? "),
                            TextSpan(
                              text: 'Sign Up',
                              style: TextStyle(
                                color: AppColors.hotPink,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Forgot Password Bottom Sheet ─────────────────────────────────────────────

class _ForgotPasswordSheet extends StatefulWidget {
  const _ForgotPasswordSheet();

  @override
  State<_ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends State<_ForgotPasswordSheet> {
  // Steps: 0 = enter email, 1 = enter code + new password
  int _step = 0;
  bool _loading = false;
  String? _error;
  String? _email;

  final _emailC = TextEditingController();
  final _codeC = TextEditingController();
  final _newPassC = TextEditingController();
  bool _obscureNew = true;

  @override
  void dispose() {
    _emailC.dispose();
    _codeC.dispose();
    _newPassC.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final email = _emailC.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = 'Enter a valid email');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final dio = Dio();
      await dio.post(
        '${AppConstants.apiBaseUrl}/auth/forgot-password',
        data: {'email': email},
      );
      setState(() { _step = 1; _email = email; });
    } on DioException catch (e) {
      final msg = e.response?.data?['error'];
      setState(() => _error = msg ?? 'Failed to send code');
    } catch (_) {
      setState(() => _error = 'Network error — check connection');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _resetPassword() async {
    final code = _codeC.text.trim();
    final newPass = _newPassC.text;
    if (code.length != 6) {
      setState(() => _error = 'Enter the 6-digit code');
      return;
    }
    if (newPass.length < 6) {
      setState(() => _error = 'Password must be at least 6 characters');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final dio = Dio();
      await dio.post(
        '${AppConstants.apiBaseUrl}/auth/reset-password',
        data: {'email': _email, 'code': code, 'newPassword': newPass},
      );
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password reset successfully — please log in')),
        );
      }
    } on DioException catch (e) {
      final msg = e.response?.data?['error'];
      setState(() => _error = msg ?? 'Failed to reset password');
    } catch (_) {
      setState(() => _error = 'Network error — check connection');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, bottom + 24),
      decoration: const BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: AppColors.textHint.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            _step == 0 ? '忘记密码' : '重置密码',
            style: const TextStyle(
              fontSize: 20, fontWeight: FontWeight.w700, color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            _step == 0
                ? '输入您的电子邮件，我们将发送验证码'
                : '输入验证码和新密码',
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
                hintText: 'Email address',
                prefixIcon: Icon(Icons.mail_outline_rounded, size: 20),
              ),
            ),
          ] else ...[
            TextField(
              controller: _codeC,
              keyboardType: TextInputType.number,
              autofocus: true,
              maxLength: 6,
              style: AppTypography.body,
              decoration: const InputDecoration(
                hintText: '6-digit code',
                prefixIcon: Icon(Icons.pin_outlined, size: 20),
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _newPassC,
              obscureText: _obscureNew,
              style: AppTypography.body,
              decoration: InputDecoration(
                hintText: 'New password',
                prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscureNew ? Icons.visibility_off : Icons.visibility,
                    size: 20, color: AppColors.textHint,
                  ),
                  onPressed: () => setState(() => _obscureNew = !_obscureNew),
                ),
              ),
            ),
          ],

          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
          ],

          const SizedBox(height: 20),

          GestureDetector(
            onTap: _loading ? null : (_step == 0 ? _sendCode : _resetPassword),
            child: Container(
              height: 50,
              decoration: BoxDecoration(
                gradient: AppColors.pinkPurpleGradient,
                borderRadius: AppRadius.lgRadius,
              ),
              child: Center(
                child: _loading
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : Text(
                        _step == 0 ? '发送验证码' : '重置密码',
                        style: const TextStyle(
                          color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600,
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
