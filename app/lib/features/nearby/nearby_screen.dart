import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/models/user.dart';
import '../../core/providers/filter_provider.dart';
import '../../core/providers/user_provider.dart';
import '../../shared/widgets/filter_sheet.dart';

class NearbyScreen extends ConsumerStatefulWidget {
  const NearbyScreen({super.key});

  @override
  ConsumerState<NearbyScreen> createState() => _NearbyScreenState();
}

class _NearbyScreenState extends ConsumerState<NearbyScreen> {
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
    // Re-fetch whenever the active filter changes
    ref.listen<DiscoveryFilter>(filterProvider, (_, filter) {
      if (!kUseDummyData) {
        ref.read(nearbyUsersProvider.notifier).fetchNearby(filter: filter);
      }
    });

    final users = kUseDummyData
        ? DummyData.users
        : ref.watch(nearbyUsersProvider).valueOrNull ?? [];

    final filterActive = ref.watch(filterProvider).activeCount > 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nearby'),
        actions: [
          FilterIconButton(
            onTap: () => showFilterSheet(context),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: users.isEmpty
          ? _buildEmpty(filterActive)
          : GridView.builder(
              padding: const EdgeInsets.all(12),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.72,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: users.length,
              itemBuilder: (_, i) => _NearbyTile(user: users[i]),
            ),
    );
  }

  Widget _buildEmpty(bool filterActive) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(Icons.location_off_rounded,
                  size: 36, color: AppTheme.textHint),
            ),
            const SizedBox(height: 16),
            Text(
              filterActive ? 'No one matches your filters' : 'No one nearby',
              style: TextStyle(
                  color: AppTheme.textSecondary, fontSize: 15),
            ),
            if (filterActive) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () =>
                    ref.read(filterProvider.notifier).reset(),
                icon: const Icon(Icons.refresh_rounded, size: 16),
                label: const Text('Reset filters'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Nearby tile ───────────────────────────────────────────────────────────────

class _NearbyTile extends StatelessWidget {
  final UserModel user;
  const _NearbyTile({required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
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
              placeholder: (_, __) => const Center(
                  child: CircularProgressIndicator(strokeWidth: 2)),
              errorWidget: (_, __, ___) =>
                  const Center(child: Icon(Icons.person_rounded, size: 40)),
            )
          else
            const Center(child: Icon(Icons.person_rounded, size: 40)),

          const DecoratedBox(
            decoration: BoxDecoration(gradient: AppTheme.cardGradient),
          ),

          if (user.isOnline)
            Positioned(
              top: 10,
              right: 10,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppTheme.online,
                  border: Border.all(color: AppTheme.bg, width: 1.5),
                ),
              ),
            ),

          if (user.isBoosted)
            Positioned(
              top: 10,
              left: 10,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: AppTheme.boost,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Icon(Icons.bolt_rounded,
                    size: 12, color: Colors.black),
              ),
            ),

          Positioned(
            left: 10,
            right: 10,
            bottom: 10,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  user.nickname,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: Colors.white,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (user.distanceLabel != null)
                  Text(
                    user.distanceLabel!,
                    style: TextStyle(
                        fontSize: 11,
                        color: Colors.white.withValues(alpha: 0.7)),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
