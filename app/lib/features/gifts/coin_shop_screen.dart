import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/models/gift.dart';
import '../../core/providers/gifts_provider.dart';

class CoinShopScreen extends ConsumerWidget {
  const CoinShopScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(giftsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('购买金币'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    const Text('🪙 ', style: TextStyle(fontSize: 14)),
                    Text(
                      state.coinBalance.toString(),
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Illustration ─────────────────────────────────────────────────
          Container(
            height: 140,
            margin: const EdgeInsets.only(bottom: 24),
            decoration: BoxDecoration(
              gradient: AppTheme.brandGradient,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Stack(
              children: [
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: CustomPaint(painter: _DotPainter()),
                  ),
                ),
                const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('🪙', style: TextStyle(fontSize: 48)),
                      SizedBox(height: 6),
                      Text(
                        '给喜欢的人送礼物吧！',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Packages ──────────────────────────────────────────────────────
          const Text(
            '选择套餐',
            style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Colors.white),
          ),
          const SizedBox(height: 12),
          ...state.packages.map(
            (pkg) => _PackageTile(pkg: pkg, onBuy: () => _buy(context, ref, pkg)),
          ),
        ],
      ),
    );
  }

  Future<void> _buy(
      BuildContext context, WidgetRef ref, CoinPackage pkg) async {
    // Simulate purchase confirmation
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('购买 ${pkg.label}'),
        content: Text(
          '${pkg.currency} ${pkg.price.toStringAsFixed(2)} 将从您的账户扣除。',
          style: TextStyle(color: AppTheme.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('取消'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('确认购买'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    await ref.read(giftsProvider.notifier).purchaseCoins(pkg.id);

    if (context.mounted) {
      final newBalance = ref.read(giftsProvider).coinBalance;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('购买成功！现有余额：$newBalance 🪙'),
          backgroundColor: AppTheme.primary,
        ),
      );
    }
  }
}

class _PackageTile extends StatelessWidget {
  final CoinPackage pkg;
  final VoidCallback onBuy;

  const _PackageTile({required this.pkg, required this.onBuy});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: pkg.bestValue
            ? Border.all(color: AppTheme.primary, width: 1.5)
            : null,
      ),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppTheme.primary.withOpacity(0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: const Center(
            child: Text('🪙', style: TextStyle(fontSize: 24)),
          ),
        ),
        title: Row(
          children: [
            Text(
              pkg.label,
              style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 15),
            ),
            if (pkg.bestValue) ...[
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  gradient: AppTheme.brandGradient,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  '最划算',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ],
        ),
        subtitle: Text(
          '${pkg.currency} ${pkg.price.toStringAsFixed(2)}',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
        ),
        trailing: ElevatedButton(
          onPressed: onBuy,
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20)),
          ),
          child: const Text('购买'),
        ),
      ),
    );
  }
}

class _DotPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.07)
      ..style = PaintingStyle.fill;
    for (double x = 0; x < size.width; x += 18) {
      for (double y = 0; y < size.height; y += 18) {
        canvas.drawCircle(Offset(x, y), 2, paint);
      }
    }
  }

  @override
  bool shouldRepaint(_) => false;
}
