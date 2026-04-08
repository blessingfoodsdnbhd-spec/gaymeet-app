import 'dart:math';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../core/models/user.dart';
import '../../shared/widgets/gradient_button.dart';

class MatchSuccessScreen extends StatefulWidget {
  final dynamic matchedUser;
  final String? matchId;

  const MatchSuccessScreen({
    super.key,
    required this.matchedUser,
    this.matchId,
  });

  @override
  State<MatchSuccessScreen> createState() => _MatchSuccessScreenState();
}

class _MatchSuccessScreenState extends State<MatchSuccessScreen>
    with TickerProviderStateMixin {
  late AnimationController _heartCtrl;
  late AnimationController _textCtrl;
  late AnimationController _particleCtrl;
  late Animation<double> _heartScale;
  late Animation<double> _textFade;

  @override
  void initState() {
    super.initState();

    _heartCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _heartScale = CurvedAnimation(parent: _heartCtrl, curve: Curves.elasticOut);

    _textCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 500));
    _textFade = CurvedAnimation(parent: _textCtrl, curve: Curves.easeOut);

    _particleCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 2000))
      ..repeat();

    _heartCtrl.forward();
    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) _textCtrl.forward();
    });
  }

  @override
  void dispose() {
    _heartCtrl.dispose();
    _textCtrl.dispose();
    _particleCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.matchedUser;
    final name =
        user is UserModel ? user.nickname : (user?['nickname'] ?? 'Someone');
    final avatar =
        user is UserModel ? user.avatarUrl : user?['avatarUrl'];

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF1A0011),
              Color(0xFF0D0D0D),
              Color(0xFF110017),
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              children: [
                const Spacer(flex: 2),

                // Animated heart
                ScaleTransition(
                  scale: _heartScale,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Glow
                      Container(
                        width: 140,
                        height: 140,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.primary.withOpacity(0.4),
                              blurRadius: 60,
                              spreadRadius: 10,
                            ),
                          ],
                        ),
                      ),
                      // Heart icon
                      ShaderMask(
                        shaderCallback: (bounds) =>
                            AppTheme.brandGradient.createShader(bounds),
                        child: const Icon(
                          Icons.favorite_rounded,
                          size: 100,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 28),

                // "It's a Match!" text
                FadeTransition(
                  opacity: _textFade,
                  child: Column(
                    children: [
                      ShaderMask(
                        shaderCallback: (bounds) =>
                            AppTheme.brandGradient.createShader(bounds),
                        child: const Text(
                          "It's a Match!",
                          style: TextStyle(
                            fontSize: 38,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: -1,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'You and $name liked each other',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.white.withOpacity(0.6),
                        ),
                      ),
                    ],
                  ),
                ),

                // Avatars
                const SizedBox(height: 36),
                FadeTransition(
                  opacity: _textFade,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _buildAvatar('https://i.pravatar.cc/400?img=68'), // Current user
                      const SizedBox(width: 20),
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          gradient: AppTheme.brandGradient,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.favorite_rounded,
                            size: 18, color: Colors.white),
                      ),
                      const SizedBox(width: 20),
                      _buildAvatar(avatar),
                    ],
                  ),
                ),

                const Spacer(flex: 3),

                // Actions
                FadeTransition(
                  opacity: _textFade,
                  child: Column(
                    children: [
                      GradientButton(
                        text: 'Send a Message',
                        onPressed: () {
                          if (widget.matchId != null) {
                            context.go('/chat/${widget.matchId}', extra: {
                              'userName': name,
                              'userAvatar': avatar,
                            });
                          } else {
                            context.go('/home');
                          }
                        },
                      ),
                      const SizedBox(height: 14),
                      TextButton(
                        onPressed: () => context.go('/home'),
                        child: Text(
                          'Keep Swiping',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.5),
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar(String? url) {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: AppTheme.primary, width: 2),
        image: url != null
            ? DecorationImage(
                image: NetworkImage(url),
                fit: BoxFit.cover,
              )
            : null,
        color: AppTheme.card,
      ),
      child: url == null
          ? const Icon(Icons.person_rounded, size: 36, color: Colors.grey)
          : null,
    );
  }
}
