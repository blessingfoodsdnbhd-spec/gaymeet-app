import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/models/promotion.dart';
import '../../core/providers/promotion_provider.dart';

/// Full-screen interstitial promo popup.
/// Call [PromoPopup.showIfNeeded] once after the app is ready.
class PromoPopup {
  static bool _shownThisSession = false;

  static void showIfNeeded(BuildContext context, WidgetRef ref) {
    if (_shownThisSession) return;
    final state = ref.read(promotionProvider);
    final promos = state.interstitialPromotions;
    if (promos.isEmpty) return;

    _shownThisSession = true;
    final promo = promos.first;

    showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black87,
      pageBuilder: (ctx, _, __) => _PromoDialog(promo: promo),
    );
  }
}

class _PromoDialog extends ConsumerStatefulWidget {
  final Promotion promo;
  const _PromoDialog({required this.promo});

  @override
  ConsumerState<_PromoDialog> createState() => _PromoDialogState();
}

class _PromoDialogState extends ConsumerState<_PromoDialog>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _scale = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack);
    _fade = CurvedAnimation(parent: _ctrl, curve: Curves.easeIn);
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _close({bool dontShow = false}) {
    if (dontShow) {
      ref.read(promotionProvider.notifier).dismiss(widget.promo.id);
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: ScaleTransition(
        scale: _scale,
        child: Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.all(24),
          child: Container(
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppTheme.primary.withValues(alpha: 0.25)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // ── Header image / gradient block ──────────────────────────
                Container(
                  height: 180,
                  decoration: BoxDecoration(
                    gradient: AppTheme.brandGradient,
                    borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(24)),
                  ),
                  child: Stack(
                    children: [
                      // Background pattern
                      Positioned.fill(
                        child: CustomPaint(painter: _DotPainter()),
                      ),
                      // Close button
                      Positioned(
                        top: 12,
                        right: 12,
                        child: GestureDetector(
                          onTap: () => _close(),
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.3),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close_rounded,
                                color: Colors.white, size: 18),
                          ),
                        ),
                      ),
                      // Center icon
                      Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.local_offer_rounded,
                                color: Colors.white, size: 52),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                '限时优惠',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // ── Content ───────────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Text(
                        widget.promo.title,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        widget.promo.subtitle,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 14,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // CTA button
                      if (widget.promo.actionUrl != null)
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () {
                              _close();
                              context.push(widget.promo.actionUrl!);
                            },
                            child: const Text('立即查看'),
                          ),
                        ),

                      const SizedBox(height: 12),

                      // Don't show again
                      GestureDetector(
                        onTap: () => _close(dontShow: true),
                        child: Text(
                          '今后不显示',
                          style: TextStyle(
                            color: AppTheme.textHint,
                            fontSize: 13,
                            decoration: TextDecoration.underline,
                            decorationColor: AppTheme.textHint,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Dot pattern painter ───────────────────────────────────────────────────────

class _DotPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.07)
      ..style = PaintingStyle.fill;

    const spacing = 18.0;
    const r = 2.0;
    for (double x = 0; x < size.width; x += spacing) {
      for (double y = 0; y < size.height; y += spacing) {
        canvas.drawCircle(Offset(x, y), r, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_) => false;
}
