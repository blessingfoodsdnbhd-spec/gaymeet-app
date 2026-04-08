import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../core/providers/auth_provider.dart';
import '../../shared/widgets/gradient_button.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _emailC = TextEditingController();
  final _nickC = TextEditingController();
  final _passC = TextEditingController();
  final _confirmC = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _emailC.dispose();
    _nickC.dispose();
    _passC.dispose();
    _confirmC.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await ref.read(authStateProvider.notifier).register(
          _emailC.text.trim(),
          _passC.text,
          _nickC.text.trim(),
        );
    if (ok && mounted) context.go('/onboarding');
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authStateProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, size: 20),
          onPressed: () => context.go('/login'),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Create\nAccount',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Join the community.',
                  style: TextStyle(
                    fontSize: 15,
                    color: AppTheme.textSecondary,
                  ),
                ),
                const SizedBox(height: 36),

                _buildField(
                  controller: _nickC,
                  hint: 'Nickname',
                  icon: Icons.person_outline_rounded,
                  validator: (v) =>
                      v == null || v.length < 2 ? 'Min 2 characters' : null,
                ),
                const SizedBox(height: 14),
                _buildField(
                  controller: _emailC,
                  hint: 'Email address',
                  icon: Icons.mail_outline_rounded,
                  keyboard: TextInputType.emailAddress,
                  validator: (v) =>
                      v == null || !v.contains('@') ? 'Valid email required' : null,
                ),
                const SizedBox(height: 14),
                _buildField(
                  controller: _passC,
                  hint: 'Password',
                  icon: Icons.lock_outline_rounded,
                  obscure: true,
                  validator: (v) =>
                      v == null || v.length < 6 ? 'Min 6 characters' : null,
                ),
                const SizedBox(height: 14),
                _buildField(
                  controller: _confirmC,
                  hint: 'Confirm password',
                  icon: Icons.lock_outline_rounded,
                  obscure: true,
                  validator: (v) =>
                      v != _passC.text ? 'Passwords don\'t match' : null,
                ),

                if (auth.error != null) ...[
                  const SizedBox(height: 14),
                  Text(auth.error!,
                      style: const TextStyle(color: AppTheme.error, fontSize: 13)),
                ],

                const SizedBox(height: 32),

                GradientButton(
                  text: 'Create Account',
                  isLoading: auth.isLoading,
                  onPressed: auth.isLoading ? null : _register,
                ),

                const SizedBox(height: 20),
                Center(
                  child: GestureDetector(
                    onTap: () => context.go('/login'),
                    child: RichText(
                      text: TextSpan(
                        style: TextStyle(
                            color: AppTheme.textSecondary, fontSize: 14),
                        children: [
                          const TextSpan(text: 'Already have an account? '),
                          TextSpan(
                            text: 'Log In',
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
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    TextInputType? keyboard,
    bool obscure = false,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboard,
      obscureText: obscure,
      style: const TextStyle(fontSize: 15),
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: Icon(icon, size: 20),
      ),
      validator: validator,
    );
  }
}
