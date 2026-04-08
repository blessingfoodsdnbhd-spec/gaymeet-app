import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/models/user.dart';
import '../../core/providers/user_provider.dart';
import '../../core/providers/filter_provider.dart';
import '../../shared/widgets/filter_sheet.dart';
import '../../shared/widgets/looking_for_badge.dart';

class NearbyGridScreen extends ConsumerStatefulWidget {
  const NearbyGridScreen({super.key});

  @override
  ConsumerState<NearbyGridScreen> createState() => _NearbyGridScreenState();
}

class _NearbyGridScreenState extends ConsumerState<NearbyGridScreen> {
  @override
  void initState() {
    super.initState();
    if (!kUseDummyData) {
      Future.microtask(() {
        final filter = ref.read(filterProvider);
        ref.read(nearbyUsersProvider.notifier).fetchNearby(filter: filter);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<DiscoveryFilter>(filterProvider, (_, filter) {
      if (!kUseDummyData) {
        ref.read(nearbyUsersProvider.notifier).fetchNearby(filter: filter);
      }
    });

    final users = kUseDummyData
        ? DummyData.users
        : ref.watch(nearbyUsersProvider).valueOrNull ?? [];

    if (users.isEmpty) {
      return Center(
        child: Text('No one nearby',
            style: TextStyle(color: AppTheme.textSecondary)),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(10),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.72,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: users.length,
      itemBuilder: (_, i) => _GridTile(user: users[i]),
    );
  }
}

// ── 3-column tile ─────────────────────────────────────────────────────────────

class _GridTile extends StatelessWidget {
  final UserModel user;
  const _GridTile({required this.user});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/user/${user.id}', extra: user),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: AppTheme.card,
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (user.avatarUrl != null)
              CachedNetworkImage(
                imageUrl: user.avatarUrl!,
                fit: BoxFit.cover,
                placeholder: (_, __) =>
                    const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                errorWidget: (_, __, ___) =>
                    const Center(child: Icon(Icons.person_rounded, size: 32)),
              )
            else
              const Center(child: Icon(Icons.person_rounded, size: 32)),

            const DecoratedBox(
              decoration: BoxDecoration(gradient: AppTheme.cardGradient),
            ),

            // Online dot
            if (user.isOnline)
              Positioned(
                top: 7,
                right: 7,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppTheme.online,
                    border: Border.all(color: AppTheme.bg, width: 1.5),
                  ),
                ),
              ),

            // Country flag
            if (user.countryCode != null)
              Positioned(
                top: 6,
                left: 6,
                child: Text(
                  _flagEmoji(user.countryCode!),
                  style: const TextStyle(fontSize: 13),
                ),
              ),

            Positioned(
              left: 6,
              right: 6,
              bottom: 6,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          user.nickname,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                            color: Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (user.isVerified)
                        const Icon(Icons.verified_rounded,
                            size: 12, color: Color(0xFF42A5F5)),
                    ],
                  ),
                  if (user.distanceLabel != null)
                    Text(
                      user.distanceLabel!,
                      style: TextStyle(
                        fontSize: 10,
                        color: Colors.white.withOpacity(0.75),
                      ),
                    ),
                  if (user.lookingFor != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: LookingForBadge(
                          status: user.lookingFor!, small: true),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _flagEmoji(String code) {
    final base = 0x1F1E6 - 0x41;
    return String.fromCharCode(base + code.codeUnitAt(0)) +
        String.fromCharCode(base + code.codeUnitAt(1));
  }
}
