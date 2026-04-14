import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/theme.dart';

/// Collapsible "Have a referral code?" widget for the registration screen.
class ReferralInputWidget extends ConsumerStatefulWidget {
  /// Called with the entered code so the parent can pass it to the register API.
  final ValueChanged<String?> onCodeChanged;

  const ReferralInputWidget({super.key, required this.onCodeChanged});

  @override
  ConsumerState<ReferralInputWidget> createState() => _ReferralInputWidgetState();
}

class _ReferralInputWidgetState extends ConsumerState<ReferralInputWidget>
    with SingleTickerProviderStateMixin {
  bool _expanded = false;
  final _codeC = TextEditingController();
  String? _appliedCode;
  bool _isApplying = false;
  String? _error;

  late final AnimationController _animCtrl;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 200));
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _codeC.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() => _expanded = !_expanded);
    if (_expanded) {
      _animCtrl.forward();
    } else {
      _animCtrl.reverse();
    }
  }

  Future<void> _apply() async {
    final code = _codeC.text.trim().toUpperCase();
    if (code.length < 4) {
      setState(() => _error = '请输入有效的邀请码');
      return;
    }
    setState(() {
      _isApplying = true;
      _error = null;
    });

    // Optimistic — we store the code locally and will apply after registration.
    // The parent passes it to the register call.
    await Future.delayed(const Duration(milliseconds: 400)); // simulate check
    if (!mounted) return;
    setState(() {
      _isApplying = false;
      _appliedCode = code;
    });
    widget.onCodeChanged(code);
  }

  void _clear() {
    _codeC.clear();
    setState(() {
      _appliedCode = null;
      _error = null;
    });
    widget.onCodeChanged(null);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GestureDetector(
          onTap: _toggle,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: _appliedCode != null
                    ? const Color(0xFFFFB300).withValues(alpha: 0.6)
                    : AppTheme.surface,
              ),
            ),
            child: Row(
              children: [
                const Text('🎟️', style: TextStyle(fontSize: 18)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _appliedCode != null
                        ? '邀请码：$_appliedCode ✓'
                        : '有朋友邀请码？输入得额外金币！',
                    style: TextStyle(
                      fontSize: 14,
                      color: _appliedCode != null
                          ? const Color(0xFFFFB300)
                          : AppTheme.textSecondary,
                      fontWeight: _appliedCode != null
                          ? FontWeight.w600
                          : FontWeight.normal,
                    ),
                  ),
                ),
                Icon(
                  _expanded
                      ? Icons.keyboard_arrow_up_rounded
                      : Icons.keyboard_arrow_down_rounded,
                  color: AppTheme.textHint,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
        FadeTransition(
          opacity: _fadeAnim,
          child: _expanded
              ? Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: _appliedCode != null
                      ? _AppliedBanner(code: _appliedCode!, onClear: _clear)
                      : _InputRow(
                          controller: _codeC,
                          isApplying: _isApplying,
                          error: _error,
                          onApply: _apply,
                        ),
                )
              : const SizedBox.shrink(),
        ),
      ],
    );
  }
}

class _InputRow extends StatelessWidget {
  final TextEditingController controller;
  final bool isApplying;
  final String? error;
  final VoidCallback onApply;

  const _InputRow({
    required this.controller,
    required this.isApplying,
    this.error,
    required this.onApply,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                textCapitalization: TextCapitalization.characters,
                maxLength: 8,
                decoration: const InputDecoration(
                  hintText: '输入邀请码',
                  counterText: '',
                ),
              ),
            ),
            const SizedBox(width: 10),
            GestureDetector(
              onTap: isApplying ? null : onApply,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFFB300), Color(0xFFFF6D00)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: isApplying
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            color: Colors.black, strokeWidth: 2),
                      )
                    : const Text(
                        '应用',
                        style: TextStyle(
                          color: Colors.black,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
              ),
            ),
          ],
        ),
        if (error != null) ...[
          const SizedBox(height: 6),
          Text(error!,
              style:
                  const TextStyle(color: AppTheme.error, fontSize: 12)),
        ],
      ],
    );
  }
}

class _AppliedBanner extends StatelessWidget {
  final String code;
  final VoidCallback onClear;
  const _AppliedBanner({required this.code, required this.onClear});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1B2A10),
        borderRadius: BorderRadius.circular(12),
        border:
            Border.all(color: const Color(0xFFFFB300).withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Text('🎉', style: TextStyle(fontSize: 18)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '邀请码 $code 已应用',
                  style: const TextStyle(
                    color: Color(0xFFFFB300),
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '注册成功后自动发放金币奖励',
                  style: TextStyle(
                      color: AppTheme.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onClear,
            child: Icon(Icons.close_rounded,
                color: AppTheme.textHint, size: 18),
          ),
        ],
      ),
    );
  }
}
