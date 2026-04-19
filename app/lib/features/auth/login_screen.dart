import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../../config/theme.dart';
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

  Future<void> _loginWithGoogle() async {
    try {
      final googleSignIn = GoogleSignIn(
        // iOS client ID (ignored on Android; Android reads google-services.json)
        clientId: '208538145733-ccuidhniu111ssc70ri9kjrdv6095obs.apps.googleusercontent.com',
        // Web client — needed on Android to get an ID token the backend can verify
        serverClientId: '208538145733-r5ib29ovl992losq4hvpu4rt6lniv22a.apps.googleusercontent.com',
      );
      final account = await googleSignIn.signIn();
      if (account == null) return;
      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        if (mounted) _showSnack('Google sign-in failed: no ID token');
        return;
      }
      final ok = await ref.read(authStateProvider.notifier).loginWithGoogle(idToken);
      if (ok && mounted) context.go('/home');
    } catch (e) {
      if (mounted) _showSnack('Google sign-in error: $e');
    }
  }

  Future<void> _loginWithApple() async {
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
      );
      final name = [credential.givenName, credential.familyName]
          .where((s) => s != null && s.isNotEmpty)
          .join(' ');
      final ok = await ref.read(authStateProvider.notifier).loginWithApple(
            credential.identityToken!,
            name: name.isEmpty ? null : name,
          );
      if (ok && mounted) context.go('/home');
    } catch (e) {
      if (mounted) _showSnack('Apple sign-in error: $e');
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.error),
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
                        'Meyou - Social Media',
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

                  // ── Divider ───────────────────────────────────────────────
                  Row(children: [
                    Expanded(child: Divider(color: AppColors.textHint.withValues(alpha: 0.3))),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text('or', style: TextStyle(color: AppColors.textHint, fontSize: 13)),
                    ),
                    Expanded(child: Divider(color: AppColors.textHint.withValues(alpha: 0.3))),
                  ]),

                  const SizedBox(height: 16),

                  // ── Google button ─────────────────────────────────────────
                  GestureDetector(
                    onTap: _loginWithGoogle,
                    child: Container(
                      height: 50,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: AppRadius.lgRadius,
                        border: Border.all(color: const Color(0xFFDADADA)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _GoogleIcon(),
                          const SizedBox(width: 10),
                          const Text(
                            'Continue with Google',
                            style: TextStyle(
                              color: Colors.black87,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ── Apple button ──────────────────────────────────────────
                  GestureDetector(
                    onTap: _loginWithApple,
                    child: Container(
                      height: 50,
                      decoration: BoxDecoration(
                        color: Colors.black,
                        borderRadius: AppRadius.lgRadius,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.apple, color: Colors.white, size: 22),
                          const SizedBox(width: 8),
                          const Text(
                            'Continue with Apple',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
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

class _GoogleIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 20,
      height: 20,
      child: CustomPaint(painter: _GoogleGPainter()),
    );
  }
}

class _GoogleGPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    final center = Offset(r, r);

    final segments = [
      (0.0, 0.5, const Color(0xFF4285F4)),
      (0.5, 1.0, const Color(0xFF34A853)),
      (1.0, 1.5, const Color(0xFFFBBC05)),
      (1.5, 2.0, const Color(0xFFEA4335)),
    ];

    for (final (startT, endT, color) in segments) {
      final paint = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.width * 0.22;
      final startAngle = (startT - 0.25) * 3.14159 * 2;
      final sweepAngle = (endT - startT) * 3.14159 * 2;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: r * 0.78),
        startAngle,
        sweepAngle,
        false,
        paint,
      );
    }

    // horizontal bar for "G"
    final barPaint = Paint()
      ..color = const Color(0xFF4285F4)
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = size.width * 0.22;
    canvas.drawLine(
      Offset(r * 0.78, r),
      Offset(r * 1.78, r),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
