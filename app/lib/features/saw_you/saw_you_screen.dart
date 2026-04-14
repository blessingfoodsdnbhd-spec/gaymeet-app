
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/api/saw_you_service.dart';
import '../../core/providers/saw_you_provider.dart';
import '../../core/providers/subscription_provider.dart';

// ── Minimal client-side profanity list (mirrors backend) ─────────────────────

const _profanityList = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy',
  'whore', 'slut', 'faggot', 'nigger', 'nigga', 'kys', 'rape',
];

bool _hasProfanity(String text) {
  final lower = text.toLowerCase();
  return _profanityList.any((w) => lower.contains(w));
}

// ── Screen ────────────────────────────────────────────────────────────────────

class SawYouScreen extends ConsumerStatefulWidget {
  const SawYouScreen({super.key});

  @override
  ConsumerState<SawYouScreen> createState() => _SawYouScreenState();
}

class _SawYouScreenState extends ConsumerState<SawYouScreen>
    with SingleTickerProviderStateMixin {
  final _plateCtrl = TextEditingController();
  final _msgCtrl = TextEditingController();
  final _plateFocus = FocusNode();

  PlateInfo? _plateInfo;
  bool _checking = false;
  bool _sending = false;
  bool _sent = false;
  String? _sendError;

  late final AnimationController _successAnim;
  late final Animation<double> _successScale;

  @override
  void initState() {
    super.initState();
    _successAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
    _successScale = CurvedAnimation(
      parent: _successAnim,
      curve: Curves.elasticOut,
    );
    _msgCtrl.addListener(() => setState(() {}));
    _plateCtrl.addListener(() {
      // Reset check result when plate changes
      if (_plateInfo != null) setState(() => _plateInfo = null);
    });
  }

  @override
  void dispose() {
    _plateCtrl.dispose();
    _msgCtrl.dispose();
    _plateFocus.dispose();
    _successAnim.dispose();
    super.dispose();
  }

  Future<void> _checkPlate() async {
    final plate = _plateCtrl.text.trim();
    if (plate.length < 2) return;
    setState(() => _checking = true);
    try {
      final info = await ref.read(sawYouServiceProvider).checkPlate(plate);
      setState(() {
        _plateInfo = info;
        _checking = false;
      });
    } catch (_) {
      setState(() => _checking = false);
    }
  }

  Future<void> _send() async {
    final plate = _plateCtrl.text.trim();
    final msg = _msgCtrl.text.trim();
    final isPremium = ref.read(subscriptionProvider).isPremium;
    final limit = ref.read(sawYouLimitProvider);

    if (plate.isEmpty || msg.isEmpty) return;

    // Client-side profanity warning
    if (_hasProfanity(msg)) {
      _showProfanityWarning();
      return;
    }

    // Free user daily limit gate
    if (!isPremium && !limit.canSend) {
      _showLimitSheet();
      return;
    }

    setState(() {
      _sending = true;
      _sendError = null;
    });

    try {
      await ref.read(sawYouServiceProvider).sendMessage(plate, msg);
      if (!isPremium) {
        ref.read(sawYouLimitProvider.notifier).recordSent();
      }
      setState(() {
        _sending = false;
        _sent = true;
      });
      _successAnim.forward();
    } catch (e) {
      setState(() {
        _sending = false;
        _sendError = _friendlyError(e.toString());
      });
    }
  }

  String _friendlyError(String raw) {
    if (raw.contains('429') || raw.contains('limit')) {
      return 'Daily limit reached. Upgrade to Premium for unlimited messages.';
    }
    if (raw.contains('profanity') || raw.contains('prohibited')) {
      return 'Message contains prohibited content. Please revise.';
    }
    return 'Something went wrong. Please try again.';
  }

  void _showProfanityWarning() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.card,
        title: Text('Watch your language',
            style: TextStyle(color: AppTheme.textPrimary)),
        content: Text(
          'Your message may contain inappropriate content. Please revise before sending.',
          style: TextStyle(color: AppTheme.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Edit message'),
          ),
        ],
      ),
    );
  }

  void _showLimitSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: AppTheme.textHint,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            const Text('👀', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text(
              "You've used all 3 free messages today",
              style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w800),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Upgrade to Premium for unlimited anonymous plate messages, every day.',
              style: TextStyle(
                  color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  context.push('/premium');
                },
                child: const Text('Unlock Premium 🔥'),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _reset() {
    setState(() {
      _sent = false;
      _plateInfo = null;
      _sendError = null;
    });
    _plateCtrl.clear();
    _msgCtrl.clear();
    _successAnim.reset();
  }

  @override
  Widget build(BuildContext context) {
    final isPremium = ref.watch(subscriptionProvider).isPremium;
    final limit = ref.watch(sawYouLimitProvider);

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0D0D1A), Color(0xFF1A0D2E), Color(0xFF0D0D0D)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: _sent ? _buildSuccess() : _buildForm(isPremium, limit),
        ),
      ),
    );
  }

  Widget _buildForm(bool isPremium, SawYouLimitState limit) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          backgroundColor: Colors.transparent,
          floating: true,
          title: const Text(
            'Saw You 👀',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          actions: [
            TextButton.icon(
              onPressed: () => context.push('/saw-you/inbox'),
              icon: const Icon(Icons.inbox_rounded, size: 18),
              label: const Text('Inbox'),
            ),
            TextButton.icon(
              onPressed: () => context.push('/saw-you/claim'),
              icon: const Icon(Icons.directions_car_rounded, size: 18),
              label: const Text('My Plate'),
            ),
          ],
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),

                // Hero text
                Text(
                  'Saw someone?\nLeave a message... 👀',
                  style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Completely anonymous. They\'ll never know who sent it.',
                  style: TextStyle(
                      color: AppTheme.textSecondary, fontSize: 13, height: 1.4),
                ),

                const SizedBox(height: 28),

                // Free-user counter
                if (!isPremium)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: limit.canSend
                          ? const Color(0xFF1A1A2E)
                          : AppTheme.error.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: limit.canSend
                            ? const Color(0xFF3A3A6E)
                            : AppTheme.error.withValues(alpha: 0.4),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.mail_outline_rounded,
                          color: limit.canSend
                              ? const Color(0xFF9B59B6)
                              : AppTheme.error,
                          size: 18,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          limit.canSend
                              ? '${limit.remaining}/$kFreePlateMessagesPerDay messages left today'
                              : 'Daily limit reached — upgrade for unlimited',
                          style: TextStyle(
                            color: limit.canSend
                                ? const Color(0xFFBB86FC)
                                : AppTheme.error,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (!limit.canSend) ...[
                          const Spacer(),
                          GestureDetector(
                            onTap: () => context.push('/premium'),
                            child: Text(
                              'Upgrade',
                              style: TextStyle(
                                  color: AppTheme.primary,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                // Plate input label
                Text(
                  'LICENSE PLATE',
                  style: TextStyle(
                    color: AppTheme.textHint,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 8),

                // Plate input styled like a real plate
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _PlateInput(controller: _plateCtrl)),
                    const SizedBox(width: 10),
                    SizedBox(
                      height: 60,
                      child: ElevatedButton(
                        onPressed: _checking ? null : _checkPlate,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4A0080),
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _checking
                            ? const SizedBox(
                                width: 16, height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('Check',
                                style: TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ),
                  ],
                ),

                // Plate check result
                if (_plateInfo != null) ...[
                  const SizedBox(height: 10),
                  _PlateCheckBadge(info: _plateInfo!),
                ],

                const SizedBox(height: 20),

                // Message area
                Text(
                  'YOUR MESSAGE',
                  style: TextStyle(
                    color: AppTheme.textHint,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1A2E),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF3A3A6E)),
                  ),
                  child: Column(
                    children: [
                      TextField(
                        controller: _msgCtrl,
                        maxLength: 200,
                        maxLines: 5,
                        style: TextStyle(
                            color: AppTheme.textPrimary, fontSize: 15),
                        decoration: InputDecoration(
                          hintText:
                              'e.g. "You were at the mamak earlier. Would love to say hi 😊"',
                          hintStyle: TextStyle(
                              color: AppTheme.textHint, fontSize: 13, height: 1.4),
                          counterStyle: TextStyle(
                              color: AppTheme.textHint, fontSize: 11),
                          filled: false,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.all(16),
                          counterText:
                              '${_msgCtrl.text.length}/200',
                        ),
                      ),
                    ],
                  ),
                ),

                if (_sendError != null) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(Icons.error_outline_rounded,
                          color: AppTheme.error, size: 16),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          _sendError!,
                          style:
                              TextStyle(color: AppTheme.error, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 20),

                // Send button
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF7B2FBE), Color(0xFFFF3B6F)],
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: ElevatedButton(
                      onPressed: _sending ? null : _send,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: _sending
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.send_rounded,
                                    size: 18, color: Colors.white),
                                SizedBox(width: 8),
                                Text(
                                  'Send Anonymous Message',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                // Anonymous disclaimer
                Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.shield_rounded,
                          size: 14, color: AppTheme.textHint),
                      const SizedBox(width: 5),
                      Text(
                        'Your identity is never revealed',
                        style: TextStyle(
                            color: AppTheme.textHint, fontSize: 12),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSuccess() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ScaleTransition(
              scale: _successScale,
              child: Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF7B2FBE), Color(0xFFFF3B6F)],
                  ),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded,
                    color: Colors.white, size: 52),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Message sent anonymously ✨',
              style: TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              'They\'ll receive a notification that someone left them a message. They\'ll never know it was you.',
              style: TextStyle(
                  color: AppTheme.textSecondary, fontSize: 14, height: 1.5),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: _reset,
              child: const Text('Send another message'),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => context.push('/saw-you/inbox'),
              child: const Text('Go to my inbox'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Plate input widget ────────────────────────────────────────────────────────

class _PlateInput extends StatelessWidget {
  final TextEditingController controller;
  const _PlateInput({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      decoration: BoxDecoration(
        color: const Color(0xFFF5F0DC), // cream / plate colour
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD4C87A), width: 2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: TextField(
        controller: controller,
        textCapitalization: TextCapitalization.characters,
        inputFormatters: [
          FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
          LengthLimitingTextInputFormatter(10),
          _UpperCaseFormatter(),
        ],
        style: const TextStyle(
          color: Color(0xFF1A1A1A),
          fontSize: 24,
          fontWeight: FontWeight.w900,
          fontFamily: 'monospace',
          letterSpacing: 4,
        ),
        decoration: InputDecoration(
          hintText: 'WXY 1234',
          hintStyle: TextStyle(
            color: const Color(0xFF1A1A1A).withValues(alpha: 0.35),
            fontSize: 22,
            fontWeight: FontWeight.w700,
            letterSpacing: 3,
          ),
          border: InputBorder.none,
        ),
      ),
    );
  }
}

class _UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    return newValue.copyWith(text: newValue.text.toUpperCase());
  }
}

// ── Plate check badge ─────────────────────────────────────────────────────────

class _PlateCheckBadge extends StatelessWidget {
  final PlateInfo info;
  const _PlateCheckBadge({required this.info});

  @override
  Widget build(BuildContext context) {
    if (!info.exists) {
      return _Badge(
        icon: Icons.info_outline_rounded,
        color: AppTheme.textHint,
        text: 'Plate not yet in system — your message will still be delivered if it\'s claimed later.',
      );
    }
    if (!info.isClaimed) {
      return _Badge(
        icon: Icons.help_outline_rounded,
        color: AppTheme.boost,
        text: 'Plate found but not yet claimed by any user.',
      );
    }
    return _Badge(
      icon: Icons.check_circle_rounded,
      color: AppTheme.online,
      text:
          'Plate is active — ${info.messageCount} message${info.messageCount == 1 ? '' : 's'} sent to this plate.',
    );
  }
}

class _Badge extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;
  const _Badge({required this.icon, required this.color, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text,
                style: TextStyle(color: color, fontSize: 12, height: 1.4)),
          ),
        ],
      ),
    );
  }
}
