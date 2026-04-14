import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/secret_code_provider.dart';

class SecretCodeScreen extends ConsumerStatefulWidget {
  const SecretCodeScreen({super.key});

  @override
  ConsumerState<SecretCodeScreen> createState() => _SecretCodeScreenState();
}

class _SecretCodeScreenState extends ConsumerState<SecretCodeScreen>
    with SingleTickerProviderStateMixin {
  final _ctrl = TextEditingController();
  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);
    _pulseAnim = Tween(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final code = _ctrl.text.trim();
    if (code.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('暗号至少2个字符')),
      );
      return;
    }
    _ctrl.clear();
    await ref.read(secretCodeProvider.notifier).submitCode(code);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(secretCodeProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF080810),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text('暗号匹配'),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Star decorations
            const _StarsDecoration(),
            const SizedBox(height: 8),

            // Title
            const Text('🔮',
                style: TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            const Text(
              '暗号匹配',
              style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: Colors.white),
            ),
            const SizedBox(height: 8),

            // Explanation card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A2E),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color: const Color(0xFF6C3CE1).withValues(alpha: 0.4)),
              ),
              child: const Text(
                '和朋友约定一个暗号，输入相同暗号即可匹配！暗号24小时后过期。',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Colors.white70, fontSize: 13, height: 1.6),
              ),
            ),
            const SizedBox(height: 32),

            // Content based on status
            if (state.status == SecretCodeStatus.matched)
              _MatchFoundWidget(
                state: state,
                onStartChat: () {
                  ref.read(secretCodeProvider.notifier).resetMatch();
                  if (state.matchId != null) {
                    final user = state.matchedUser;
                    context.push('/chat/${state.matchId}', extra: {
                      'userId': user?['id'] ?? '',
                      'userName': user?['nickname'] ?? '',
                      'userAvatar': user?['avatarUrl'],
                    });
                  }
                },
                onClose: () =>
                    ref.read(secretCodeProvider.notifier).resetMatch(),
              )
            else if (state.status == SecretCodeStatus.waiting)
              _WaitingWidget(
                state: state,
                pulseAnim: _pulseAnim,
                onCancel: () =>
                    ref.read(secretCodeProvider.notifier).cancelCode(),
              )
            else
              _InputWidget(
                ctrl: _ctrl,
                isLoading: state.isLoading,
                onSubmit: _submit,
              ),

            const SizedBox(height: 32),

            // History
            if (state.history.isNotEmpty) _HistorySection(history: state.history),
          ],
        ),
      ),
    );
  }
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _InputWidget extends StatelessWidget {
  final TextEditingController ctrl;
  final bool isLoading;
  final VoidCallback onSubmit;
  const _InputWidget(
      {required this.ctrl, required this.isLoading, required this.onSubmit});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A2E),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
                color: const Color(0xFF6C3CE1).withValues(alpha: 0.6), width: 1.5),
          ),
          child: TextField(
            controller: ctrl,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 20,
              letterSpacing: 4,
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
            decoration: const InputDecoration(
              hintText: '输入你们约定的暗号...',
              hintStyle: TextStyle(
                  color: Colors.white38, fontSize: 14, letterSpacing: 1),
              border: InputBorder.none,
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            ),
            maxLength: 30,
            buildCounter: (_, {required currentLength, required isFocused, maxLength}) =>
                null,
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6C3CE1), Color(0xFFB44AE8)],
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: ElevatedButton(
              onPressed: isLoading ? null : onSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text(
                      '提交暗号',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white),
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

class _WaitingWidget extends StatelessWidget {
  final SecretCodeState state;
  final Animation<double> pulseAnim;
  final VoidCallback onCancel;
  const _WaitingWidget(
      {required this.state,
      required this.pulseAnim,
      required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ScaleTransition(
          scale: pulseAnim,
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                  color: const Color(0xFF6C3CE1).withValues(alpha: 0.6), width: 3),
            ),
            child: const Text('🔮', style: TextStyle(fontSize: 48)),
          ),
        ),
        const SizedBox(height: 20),
        Text(
          '暗号已设定',
          style: const TextStyle(
              color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A2E),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            state.activeCode?.replaceAll(RegExp(r'.'), '★') ?? '****',
            style: const TextStyle(
                fontSize: 20,
                letterSpacing: 6,
                color: Color(0xFF9C6FE1),
                fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          '等待匹配中...',
          style: TextStyle(color: Colors.white60, fontSize: 14),
        ),
        if (state.expiresAt != null) ...[
          const SizedBox(height: 4),
          Text(
            '24小时后过期',
            style: TextStyle(color: Colors.white38, fontSize: 12),
          ),
        ],
        const SizedBox(height: 24),
        OutlinedButton(
          onPressed: onCancel,
          style: OutlinedButton.styleFrom(
              side: const BorderSide(color: Colors.white38)),
          child: const Text('取消暗号',
              style: TextStyle(color: Colors.white70)),
        ),
      ],
    );
  }
}

class _MatchFoundWidget extends StatelessWidget {
  final SecretCodeState state;
  final VoidCallback onStartChat;
  final VoidCallback onClose;
  const _MatchFoundWidget(
      {required this.state, required this.onStartChat, required this.onClose});

  @override
  Widget build(BuildContext context) {
    final user = state.matchedUser;
    final avatarUrl = user?['avatarUrl'] as String?;
    final nickname = user?['nickname'] as String? ?? '匹配用户';

    return Column(
      children: [
        const Text('🎆', style: TextStyle(fontSize: 52)),
        const SizedBox(height: 12),
        const Text(
          '匹配成功！',
          style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: Colors.white),
        ),
        const SizedBox(height: 20),
        Container(
          width: 90,
          height: 90,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
                color: const Color(0xFF6C3CE1), width: 3),
          ),
          clipBehavior: Clip.antiAlias,
          child: avatarUrl != null
              ? CachedNetworkImage(imageUrl: avatarUrl, fit: BoxFit.cover)
              : Container(
                  color: AppTheme.card,
                  child: const Icon(Icons.person_rounded,
                      size: 44, color: Color(0xFF3A3A3A)),
                ),
        ),
        const SizedBox(height: 12),
        Text(
          nickname,
          style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Colors.white),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6C3CE1), Color(0xFFB44AE8)],
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: ElevatedButton(
              onPressed: onStartChat,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text('开始聊天',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white)),
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: onClose,
          child: const Text('关闭',
              style: TextStyle(color: Colors.white60)),
        ),
      ],
    );
  }
}

class _HistorySection extends StatelessWidget {
  final List<Map<String, dynamic>> history;
  const _HistorySection({required this.history});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '历史记录',
          style: TextStyle(
              color: Colors.white70,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 1),
        ),
        const SizedBox(height: 10),
        ...history.take(5).map((h) {
          final matched = h['matchedWith'] != null;
          final code = h['code'] as String? ?? '';
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF1A1A2E),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Text(matched ? '✅' : '⏰',
                    style: const TextStyle(fontSize: 16)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(code,
                          style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                              fontWeight: FontWeight.w500)),
                      if (matched &&
                          h['matchedWith'] != null &&
                          (h['matchedWith'] as Map)['nickname'] != null)
                        Text(
                          '匹配到：${(h['matchedWith'] as Map)['nickname']}',
                          style: TextStyle(
                              color: const Color(0xFF9C6FE1),
                              fontSize: 11),
                        ),
                    ],
                  ),
                ),
                Text(
                  matched ? '已匹配' : '未匹配',
                  style: TextStyle(
                      color: matched
                          ? const Color(0xFF4CAF50)
                          : Colors.white38,
                      fontSize: 12),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}

class _StarsDecoration extends StatelessWidget {
  const _StarsDecoration();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: const [
          Text('✨', style: TextStyle(fontSize: 12)),
          Text('⭐', style: TextStyle(fontSize: 10)),
          Text('✨', style: TextStyle(fontSize: 16)),
          Text('⭐', style: TextStyle(fontSize: 10)),
          Text('✨', style: TextStyle(fontSize: 12)),
          Text('⭐', style: TextStyle(fontSize: 14)),
          Text('✨', style: TextStyle(fontSize: 10)),
        ],
      ),
    );
  }
}
