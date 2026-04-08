import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../core/providers/auth_provider.dart';
import '../../shared/widgets/gradient_button.dart';

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
      duration: const Duration(milliseconds: 800),
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

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authStateProvider);
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Scaffold(
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

                  // Logo
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      gradient: AppTheme.brandGradient,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: const Icon(Icons.favorite_rounded,
                        size: 44, color: Colors.white),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'GayMeet',
                    style: TextStyle(
                      fontSize: 34,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Find your people.',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppTheme.textSecondary,
                      height: 1.4,
                    ),
                  ),

                  const SizedBox(height: 48),

                  // Email
                  TextFormField(
                    controller: _emailC,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(fontSize: 15),
                    decoration: const InputDecoration(
                      hintText: 'Email address',
                      prefixIcon: Icon(Icons.mail_outline_rounded, size: 20),
                    ),
                    validator: (v) =>
                        v == null || !v.contains('@') ? 'Valid email required' : null,
                  ),
                  const SizedBox(height: 14),

                  // Password
                  TextFormField(
                    controller: _passC,
                    obscureText: _obscure,
                    style: const TextStyle(fontSize: 15),
                    decoration: InputDecoration(
                      hintText: 'Password',
                      prefixIcon:
                          const Icon(Icons.lock_outline_rounded, size: 20),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscure ? Icons.visibility_off : Icons.visibility,
                          size: 20,
                          color: AppTheme.textHint,
                        ),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    validator: (v) =>
                        v == null || v.length < 6 ? 'Min 6 characters' : null,
                  ),

                  // Error
                  if (auth.error != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.error.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline,
                              color: AppTheme.error, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(auth.error!,
                                style: const TextStyle(
                                    color: AppTheme.error, fontSize: 13)),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 28),

                  // Login button
                  GradientButton(
                    text: 'Log In',
                    isLoading: auth.isLoading,
                    onPressed: auth.isLoading ? null : _login,
                  ),

                  const SizedBox(height: 20),

                  // Divider
                  Row(
                    children: [
                      const Expanded(child: Divider()),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Text('or',
                            style: TextStyle(
                                color: AppTheme.textHint, fontSize: 13)),
                      ),
                      const Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // Social buttons (stubs)
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

                  // Register link
                  Center(
                    child: GestureDetector(
                      onTap: () => context.go('/register'),
                      child: RichText(
                        text: TextSpan(
                          style: TextStyle(
                              color: AppTheme.textSecondary, fontSize: 14),
                          children: [
                            const TextSpan(text: "Don't have an account? "),
                            TextSpan(
                              text: 'Sign Up',
                              style: TextStyle(
                                color: AppTheme.primary,
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
