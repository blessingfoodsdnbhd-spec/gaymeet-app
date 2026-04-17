import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/models/user.dart';
import '../../core/providers/filter_provider.dart';
import '../../core/providers/user_provider.dart';

class NearbyGridScreen extends ConsumerStatefulWidget {
  const NearbyGridScreen({super.key});

  @override
  ConsumerState<NearbyGridScreen> createState() => _NearbyGridScreenState();
}

class _NearbyGridScreenState extends ConsumerState<NearbyGridScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    if (!kUseDummyData) {
      Future.microtask(() {
        final filter = ref.read(filterProvider);
        ref.read(nearbyUsersProvider.notifier).fetchNearby(filter: filter);
      });
    }
    _searchController.addListener(() {
      setState(() => _searchQuery = _searchController.text.toLowerCase());
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<DiscoveryFilter>(filterProvider, (_, filter) {
      if (!kUseDummyData) {
        ref.read(nearbyUsersProvider.notifier).fetchNearby(filter: filter);
      }
    });

    final filter = ref.watch(filterProvider);
    final allUsers = kUseDummyData
        ? DummyData.users
        : ref.watch(nearbyUsersProvider).valueOrNull ?? [];

    // Apply filter
    var users = kUseDummyData
        ? allUsers.where((u) => filter.matchesUser(
              height: u.height,
              weight: u.weight,
              age: u.age,
            )).toList()
        : allUsers;

    // Apply search
    if (_searchQuery.isNotEmpty) {
      users = users
          .where((u) => u.nickname.toLowerCase().contains(_searchQuery))
          .toList();
    }

    return Column(
      children: [
        // Search bar
        _SearchBar(controller: _searchController),

        // Grid
        Expanded(
          child: users.isEmpty
              ? _EmptyState(filter: filter)
              : RefreshIndicator(
                  color: AppTheme.primary,
                  onRefresh: () async {
                    if (!kUseDummyData) {
                      ref.read(nearbyUsersProvider.notifier).fetchNearby(
                            filter: ref.read(filterProvider),
                          );
                    }
                  },
                  child: GridView.builder(
                    padding: EdgeInsets.zero,
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 1.5,
                      mainAxisSpacing: 1.5,
                      childAspectRatio: 1,
                    ),
                    itemCount: users.length,
                    itemBuilder: (_, i) => _GridTile(user: users[i]),
                  ),
                ),
        ),
      ],
    );
  }
}

// ── Search bar ────────────────────────────────────────────────────────────────

class _SearchBar extends StatelessWidget {
  final TextEditingController controller;
  const _SearchBar({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppTheme.bg,
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      child: TextField(
        controller: controller,
        style: const TextStyle(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(
          hintText: '搜索附近的人...',
          hintStyle: TextStyle(color: AppTheme.textHint, fontSize: 14),
          prefixIcon:
              Icon(Icons.search_rounded, color: AppTheme.textHint, size: 20),
          suffixIcon: ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (_, value, __) => value.text.isNotEmpty
                ? GestureDetector(
                    onTap: controller.clear,
                    child: Icon(Icons.close_rounded,
                        color: AppTheme.textHint, size: 18),
                  )
                : const SizedBox.shrink(),
          ),
          filled: true,
          fillColor: AppTheme.card,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyState extends ConsumerWidget {
  final DiscoveryFilter filter;
  const _EmptyState({required this.filter});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.location_off_rounded, size: 48, color: AppTheme.textHint),
          const SizedBox(height: 12),
          Text('附近没有人',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 15)),
          if (filter.filtersEnabled && filter.activeCount > 0) ...[
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => ref.read(filterProvider.notifier).reset(),
              child: const Text('重置过滤'),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Grid tile ─────────────────────────────────────────────────────────────────

class _GridTile extends StatelessWidget {
  final UserModel user;
  const _GridTile({required this.user});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/user/${user.id}', extra: user),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Photo / placeholder
          _Photo(user: user),

          // Bottom gradient scrim
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                stops: [0.0, 0.55],
                colors: [Colors.black87, Colors.transparent],
              ),
            ),
          ),

          // Online dot — top-right
          if (user.isOnline)
            Positioned(
              top: 6,
              right: 6,
              child: Container(
                width: 9,
                height: 9,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppTheme.online,
                  border: Border.all(color: Colors.black54, width: 1.5),
                ),
              ),
            ),

          // Bottom row: distance (left) + role (right)
          Positioned(
            left: 5,
            right: 5,
            bottom: 5,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // Distance label
                if (user.distanceLabel != null)
                  _DistanceBadge(label: user.distanceLabel!),

                const Spacer(),

                // Role badge
                if (user.role != null) _RoleBadge(role: user.role!),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Photo widget ──────────────────────────────────────────────────────────────

class _Photo extends StatelessWidget {
  final UserModel user;
  const _Photo({required this.user});

  // Generate a deterministic placeholder color from the user id
  Color _placeholderColor() {
    final colors = [
      const Color(0xFF1976D2),
      const Color(0xFF7B1FA2),
      const Color(0xFF388E3C),
      const Color(0xFFE64A19),
      const Color(0xFF0097A7),
      const Color(0xFFC2185B),
    ];
    final hash = user.id.codeUnits.fold(0, (a, b) => a + b);
    return colors[hash % colors.length];
  }

  @override
  Widget build(BuildContext context) {
    if (user.avatarUrl != null) {
      return CachedNetworkImage(
        imageUrl: user.avatarUrl!,
        fit: BoxFit.cover,
        placeholder: (_, __) => Container(color: AppTheme.card),
        errorWidget: (_, __, ___) => _InitialsPlaceholder(
          initials: _initials(),
          color: _placeholderColor(),
        ),
      );
    }
    return _InitialsPlaceholder(
      initials: _initials(),
      color: _placeholderColor(),
    );
  }

  String _initials() {
    final parts = user.nickname.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return user.nickname.isNotEmpty
        ? user.nickname[0].toUpperCase()
        : '?';
  }
}

class _InitialsPlaceholder extends StatelessWidget {
  final String initials;
  final Color color;
  const _InitialsPlaceholder({required this.initials, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color,
      alignment: Alignment.center,
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 26,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ── Distance badge ────────────────────────────────────────────────────────────

class _DistanceBadge extends StatelessWidget {
  final String label;
  const _DistanceBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ── Role badge ────────────────────────────────────────────────────────────────

class _RoleBadge extends StatelessWidget {
  final String role;
  const _RoleBadge({required this.role});

  static const _labels = {
    'top': 'Top',
    'bottom': 'Bot',
    'versatile': 'Ver',
  };

  static const _colors = {
    'top': Color(0xFF1565C0),       // blue
    'bottom': Color(0xFFAD1457),    // pink
    'versatile': Color(0xFF6A1B9A), // purple
  };

  @override
  Widget build(BuildContext context) {
    final label = _labels[role] ?? role;
    final color = _colors[role] ?? AppTheme.card;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
