import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/models/promotion.dart';
import '../../core/providers/promotion_provider.dart';

/// Inline horizontal promo banner inserted into list views.
/// Shows the first active banner promotion. Dismiss button removes it locally.
class PromoBanner extends ConsumerWidget {
  const PromoBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(promotionProvider);
    final banners = state.bannerPromotions;
    if (banners.isEmpty) return const SizedBox.shrink();

    final promo = banners.first;
    return _BannerTile(promo: promo);
  }
}

class _BannerTile extends ConsumerWidget {
  final Promotion promo;
  const _BannerTile({required this.promo});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () {
        if (promo.actionUrl != null) {
          context.push(promo.actionUrl!);
        }
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          gradient: const LinearGradient(
            colors: [Color(0xFF1A0A12), Color(0xFF1A0A1A)],
            begin: Alignment.centerLeft,
            end: Alignment.centerRight,
          ),
          border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
        ),
        child: Stack(
          children: [
            // Gradient overlay for depth
            Positioned.fill(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(11),
                child: ShaderMask(
                  shaderCallback: (r) =>
                      AppTheme.brandGradient.createShader(r),
                  blendMode: BlendMode.srcIn,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(11),
                      color: Colors.white.withOpacity(0.03),
                    ),
                  ),
                ),
              ),
            ),
            // Content
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 36, 10),
              child: Row(
                children: [
                  // Promo icon / image
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      gradient: AppTheme.brandGradient,
                    ),
                    child: const Icon(Icons.local_offer_rounded,
                        color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  // Text
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 5, vertical: 1),
                              decoration: BoxDecoration(
                                color: AppTheme.primary,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                '推广',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                promo.title,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          promo.subtitle,
                          style: TextStyle(
                              color: AppTheme.textSecondary, fontSize: 11),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Dismiss button
            Positioned(
              top: 6,
              right: 6,
              child: GestureDetector(
                onTap: () =>
                    ref.read(promotionProvider.notifier).dismiss(promo.id),
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close_rounded,
                      color: Colors.white54, size: 13),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
