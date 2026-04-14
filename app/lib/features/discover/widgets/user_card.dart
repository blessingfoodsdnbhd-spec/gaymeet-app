import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../config/theme.dart';
import '../../../core/models/user.dart';
import '../../../shared/widgets/level_badge.dart';
import '../../../shared/widgets/looking_for_badge.dart';

class UserCard extends StatelessWidget {
  final UserModel user;
  final double swipeProgress; // -1 to 1, negative = left, positive = right

  const UserCard({
    super.key,
    required this.user,
    this.swipeProgress = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Photo
            _buildPhoto(),

            // Gradient overlay
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: AppTheme.cardGradient,
              ),
            ),

            // LIKE / NOPE stamp overlay
            if (swipeProgress.abs() > 0.1) _buildStamp(),

            // Boost badge
            if (user.isBoosted)
              Positioned(
                top: 16,
                left: 16,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppTheme.boost,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.bolt_rounded, size: 14, color: Colors.black),
                      SizedBox(width: 2),
                      Text('BOOSTED',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Colors.black,
                          )),
                    ],
                  ),
                ),
              ),

            // Online indicator
            if (user.isOnline)
              Positioned(
                top: 16,
                right: 16,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppTheme.online.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.online, width: 1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.online,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Text('Online',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.online,
                          )),
                    ],
                  ),
                ),
              ),

            // User info at bottom
            Positioned(
              left: 20,
              right: 20,
              bottom: 20,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Name + premium
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          user.nickname,
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: -0.5,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (user.isPremium) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.premium.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Icon(Icons.workspace_premium_rounded,
                              size: 16, color: AppTheme.premium),
                        ),
                      ],
                      if (user.isVerified) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.verified_rounded,
                            size: 18, color: Color(0xFF42A5F5)),
                      ],
                      const SizedBox(width: 8),
                      LevelBadge(level: user.level, size: 36),
                    ],
                  ),

                  // Looking for
                  if (user.lookingFor != null) ...[
                    const SizedBox(height: 8),
                    LookingForBadge(status: user.lookingFor!, small: true),
                  ],

                  // Distance
                  if (user.distance != null) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.location_on_rounded,
                            size: 14, color: Colors.white.withOpacity(0.7)),
                        const SizedBox(width: 4),
                        Text(
                          '${user.distance!.toStringAsFixed(1)} km away',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.white.withOpacity(0.7),
                          ),
                        ),
                      ],
                    ),
                  ],

                  // Bio
                  if (user.bio != null && user.bio!.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      user.bio!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withOpacity(0.85),
                        height: 1.4,
                      ),
                    ),
                  ],

                  // Tags
                  if (user.tags.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: user.tags.take(4).map((tag) {
                        return Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            tag,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.white,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhoto() {
    if (user.avatarUrl != null) {
      return CachedNetworkImage(
        imageUrl: user.avatarUrl!,
        fit: BoxFit.cover,
        placeholder: (_, __) => Container(
          color: AppTheme.card,
          child: const Center(
              child: CircularProgressIndicator(strokeWidth: 2)),
        ),
        errorWidget: (_, __, ___) => _placeholder(),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() {
    return Container(
      color: AppTheme.card,
      child: const Center(
          child: Icon(Icons.person_rounded, size: 80, color: Color(0xFF3A3A3A))),
    );
  }

  Widget _buildStamp() {
    final isLike = swipeProgress > 0;
    final opacity = (swipeProgress.abs() * 2).clamp(0.0, 1.0);

    return Positioned(
      top: 40,
      left: isLike ? 20 : null,
      right: isLike ? null : 20,
      child: Opacity(
        opacity: opacity,
        child: Transform.rotate(
          angle: isLike ? -0.2 : 0.2,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              border: Border.all(
                color: isLike ? AppTheme.online : AppTheme.error,
                width: 3,
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              isLike ? 'LIKE' : 'NOPE',
              style: TextStyle(
                fontSize: 32,
                fontWeight: FontWeight.w900,
                color: isLike ? AppTheme.online : AppTheme.error,
                letterSpacing: 2,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
