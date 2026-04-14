import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../core/models/place.dart';
import '../../core/providers/places_provider.dart';
import '../../core/providers/business_provider.dart';
import '../../shared/widgets/promoted_badge.dart';

const _categories = [
  ('all', '全部', '🗺️'),
  ('bar', '酒吧', '🍺'),
  ('club', '夜店', '🎵'),
  ('restaurant', '餐厅', '🍜'),
  ('cafe', '咖啡馆', '☕'),
  ('sauna', '桑拿', '🧖'),
  ('hotel', '酒店', '🏨'),
  ('gym', '健身房', '💪'),
  ('other', '其他', '📍'),
];

class PlacesScreen extends ConsumerStatefulWidget {
  const PlacesScreen({super.key});

  @override
  ConsumerState<PlacesScreen> createState() => _PlacesScreenState();
}

class _PlacesScreenState extends ConsumerState<PlacesScreen> {
  bool _mapView = false;
  final _searchC = TextEditingController();
  final _scrollC = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(placesProvider.notifier).load();
    });
    _scrollC.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchC.dispose();
    _scrollC.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollC.position.pixels >= _scrollC.position.maxScrollExtent - 200) {
      ref.read(placesProvider.notifier).load(reset: false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(placesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('找店'),
        actions: [
          IconButton(
            icon: Icon(_mapView
                ? Icons.view_list_rounded
                : Icons.map_rounded),
            onPressed: () => setState(() => _mapView = !_mapView),
            tooltip: _mapView ? '列表视图' : '地图视图',
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Search bar ──────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _searchC,
              onSubmitted: (v) => ref.read(placesProvider.notifier).setSearch(v),
              onChanged: (v) {
                if (v.isEmpty) ref.read(placesProvider.notifier).setSearch('');
              },
              decoration: InputDecoration(
                hintText: '搜索地点、标签...',
                prefixIcon: const Icon(Icons.search_rounded, size: 20),
                suffixIcon: state.searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close_rounded, size: 18),
                        onPressed: () {
                          _searchC.clear();
                          ref.read(placesProvider.notifier).setSearch('');
                        },
                      )
                    : null,
              ),
            ),
          ),
          const SizedBox(height: 10),

          // ── Category chips ───────────────────────────────────────────────
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemCount: _categories.length,
              itemBuilder: (_, i) {
                final (val, label, emoji) = _categories[i];
                final selected = state.selectedCategory == val;
                return GestureDetector(
                  onTap: () => ref.read(placesProvider.notifier).setCategory(val),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      gradient: selected
                          ? const LinearGradient(
                              colors: [AppTheme.gradient1, AppTheme.gradient2])
                          : null,
                      color: selected ? null : AppTheme.card,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '$emoji $label',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: selected ? Colors.white : AppTheme.textSecondary,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 10),

          // ── Sort row ─────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text(
                  '${state.places.length} 个地点',
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                ),
                const Spacer(),
                _SortChip(
                  label: '最新',
                  active: state.sortBy == 'newest',
                  onTap: () => ref.read(placesProvider.notifier).setSort('newest'),
                ),
                const SizedBox(width: 8),
                _SortChip(
                  label: '评分',
                  active: state.sortBy == 'rating',
                  onTap: () => ref.read(placesProvider.notifier).setSort('rating'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // ── Promoted businesses ────────────────────────────────────────
          Consumer(builder: (context, ref, _) {
            final promoted = ref.watch(businessProvider).promoted;
            if (promoted.isEmpty) return const SizedBox.shrink();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(children: [
                    const PromotedBadge(),
                    const SizedBox(width: 6),
                    Text('推广商家', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
                  ]),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 100,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemCount: promoted.length,
                    itemBuilder: (_, i) => _PromotedCard(
                      businessName: promoted[i].businessName,
                      category: promoted[i].category,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                const Divider(height: 1),
                const SizedBox(height: 8),
              ],
            );
          }),

          // ── Content ──────────────────────────────────────────────────────
          Expanded(
            child: _mapView
                ? _MapView(places: state.places)
                : _ListView(
                    places: state.places,
                    isLoading: state.isLoading,
                    isLoadingMore: state.isLoadingMore,
                    scrollController: _scrollC,
                    onRefresh: () => ref.read(placesProvider.notifier).load(),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/places/create'),
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('添加地点', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
    );
  }
}

// ── Sort chip ─────────────────────────────────────────────────────────────────

class _SortChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _SortChip({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: active ? AppTheme.primary.withOpacity(0.15) : AppTheme.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: active ? AppTheme.primary : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: active ? AppTheme.primary : AppTheme.textSecondary,
          ),
        ),
      ),
    );
  }
}

// ── List view ─────────────────────────────────────────────────────────────────

class _ListView extends StatelessWidget {
  final List<Place> places;
  final bool isLoading;
  final bool isLoadingMore;
  final ScrollController scrollController;
  final Future<void> Function() onRefresh;

  const _ListView({
    required this.places,
    required this.isLoading,
    required this.isLoadingMore,
    required this.scrollController,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (places.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🗺️', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text(
              '暂无地点',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 15),
            ),
            const SizedBox(height: 6),
            Text(
              '成为第一个分享地点的人！',
              style: TextStyle(color: AppTheme.textHint, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
        itemCount: places.length + (isLoadingMore ? 1 : 0),
        itemBuilder: (_, i) {
          if (i == places.length) {
            return const Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          return PlaceCard(place: places[i]);
        },
      ),
    );
  }
}

// ── Place card (exported for reuse) ──────────────────────────────────────────

class PlaceCard extends ConsumerWidget {
  final Place place;
  const PlaceCard({super.key, required this.place});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () {
        ref.read(selectedPlaceProvider.notifier).state = place;
        context.push('/places/${place.id}', extra: place);
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Photo area
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              child: Stack(
                children: [
                  Container(
                    height: 160,
                    width: double.infinity,
                    color: AppTheme.surface,
                    child: place.photos.isNotEmpty
                        ? Image.network(place.photos.first, fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => _PlaceholderPhoto(category: place.category))
                        : _PlaceholderPhoto(category: place.category),
                  ),
                  // Gradient overlay
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Colors.black.withOpacity(0.5)],
                        ),
                      ),
                    ),
                  ),
                  // Category badge
                  Positioned(
                    top: 12,
                    left: 12,
                    child: _CategoryBadge(category: place.category),
                  ),
                  // Verified badge
                  if (place.isVerified)
                    Positioned(
                      top: 12,
                      right: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1976D2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.verified_rounded, color: Colors.white, size: 11),
                            SizedBox(width: 3),
                            Text('认证', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    ),
                  // Price range
                  Positioned(
                    bottom: 10,
                    right: 12,
                    child: Text(
                      place.priceRange,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                        shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Info
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          place.name,
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      _StarRow(rating: place.averageRating, count: place.totalReviews),
                    ],
                  ),
                  const SizedBox(height: 4),
                  if (place.address.isNotEmpty)
                    Row(
                      children: [
                        Icon(Icons.location_on_outlined, size: 13, color: AppTheme.textHint),
                        const SizedBox(width: 3),
                        Expanded(
                          child: Text(
                            place.address,
                            style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  if (place.openingHours != null) ...[
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(Icons.access_time_rounded, size: 13, color: AppTheme.textHint),
                        const SizedBox(width: 3),
                        Text(
                          place.openingHours!,
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                  if (place.tags.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: place.tags.take(4).map((t) => _TagChip(tag: t)).toList(),
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
}

// ── Map view ──────────────────────────────────────────────────────────────────

class _MapView extends StatelessWidget {
  final List<Place> places;
  const _MapView({required this.places});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Stack(
          children: [
            // Grid background
            Container(
              color: const Color(0xFF131320),
              child: CustomPaint(
                painter: _PlacesGridPainter(),
                size: Size.infinite,
              ),
            ),
            // Place pins
            ...places.where((p) => p.lat != null && p.lng != null).map((p) {
              return _PlacePin(place: p);
            }),
            // Label
            Positioned(
              top: 14,
              left: 14,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.map_rounded, color: AppTheme.primary, size: 14),
                    const SizedBox(width: 5),
                    Text(
                      '${places.length} 个地点',
                      style: const TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlacesGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF2A2A4A)
      ..strokeWidth = 0.5;
    const step = 30.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(_) => false;
}

class _PlacePin extends StatelessWidget {
  final Place place;
  const _PlacePin({required this.place});

  @override
  Widget build(BuildContext context) {
    // Map KL bounding box to screen fraction
    // KL area: lat 3.05–3.25, lng 101.60–101.80
    final latFrac = 1.0 - ((place.lat! - 3.05) / 0.20).clamp(0.0, 1.0);
    final lngFrac = ((place.lng! - 101.60) / 0.20).clamp(0.0, 1.0);

    return LayoutBuilder(
      builder: (ctx, constraints) {
        final x = lngFrac * constraints.maxWidth;
        final y = latFrac * constraints.maxHeight;
        return Positioned(
          left: x - 18,
          top: y - 36,
          child: GestureDetector(
            onTap: () {
              showModalBottomSheet(
                context: context,
                backgroundColor: Colors.transparent,
                builder: (_) => _PinPopup(place: place),
              );
            },
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                        colors: [AppTheme.gradient1, AppTheme.gradient2]),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                          color: AppTheme.primary.withOpacity(0.4),
                          blurRadius: 8,
                          spreadRadius: 1)
                    ],
                  ),
                  child: Text(
                    Place.categoryEmoji(place.category),
                    style: const TextStyle(fontSize: 14),
                  ),
                ),
                Container(width: 2, height: 6, color: AppTheme.primary),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _PinPopup extends ConsumerWidget {
  final Place place;
  const _PinPopup({required this.place});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(Place.categoryEmoji(place.category),
                  style: const TextStyle(fontSize: 24)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(place.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 16)),
                    Text(place.address,
                        style: TextStyle(
                            color: AppTheme.textSecondary, fontSize: 12)),
                  ],
                ),
              ),
              _StarRow(rating: place.averageRating, count: place.totalReviews),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                ref.read(selectedPlaceProvider.notifier).state = place;
                context.push('/places/${place.id}', extra: place);
              },
              child: const Text('查看详情'),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shared small widgets ──────────────────────────────────────────────────────

class _CategoryBadge extends StatelessWidget {
  final String category;
  const _CategoryBadge({required this.category});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.65),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        '${Place.categoryEmoji(category)} ${Place.categoryLabel(category)}',
        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _PlaceholderPhoto extends StatelessWidget {
  final String category;
  const _PlaceholderPhoto({required this.category});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppTheme.surface,
      child: Center(
        child: Text(
          Place.categoryEmoji(category),
          style: const TextStyle(fontSize: 52),
        ),
      ),
    );
  }
}

class _TagChip extends StatelessWidget {
  final String tag;
  const _TagChip({required this.tag});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppTheme.primary.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        tag,
        style: TextStyle(
            fontSize: 11,
            color: AppTheme.primary,
            fontWeight: FontWeight.w600),
      ),
    );
  }
}

// ── Promoted business card ─────────────────────────────────────────────────────

class _PromotedCard extends StatelessWidget {
  final String businessName;
  final String category;
  const _PromotedCard({required this.businessName, required this.category});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFFB300).withOpacity(0.4), width: 1),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(_emoji(category), style: const TextStyle(fontSize: 20)),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  businessName,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                const PromotedBadge(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _emoji(String cat) {
    switch (cat) {
      case 'bar': return '🍺';
      case 'club': return '🎵';
      case 'restaurant': return '🍜';
      case 'sauna': return '🧖';
      case 'hotel': return '🏨';
      case 'gym': return '💪';
      default: return '🏪';
    }
  }
}

class _StarRow extends StatelessWidget {
  final double rating;
  final int count;
  const _StarRow({required this.rating, required this.count});

  @override
  Widget build(BuildContext context) {
    if (count == 0) return const SizedBox.shrink();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.star_rounded, color: Color(0xFFFFD700), size: 14),
        const SizedBox(width: 2),
        Text(
          rating.toStringAsFixed(1),
          style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFFFFD700)),
        ),
        Text(
          ' ($count)',
          style: TextStyle(fontSize: 11, color: AppTheme.textHint),
        ),
      ],
    );
  }
}
