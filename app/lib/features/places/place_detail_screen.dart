import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../core/models/place.dart';
import '../../core/providers/places_provider.dart';
import '../../core/providers/auth_provider.dart';
import 'rate_place_sheet.dart';
import 'places_screen.dart' show _CategoryBadge, _TagChip, _StarRow, _PlaceholderPhoto;

class PlaceDetailScreen extends ConsumerStatefulWidget {
  final Place place;
  const PlaceDetailScreen({super.key, required this.place});

  @override
  ConsumerState<PlaceDetailScreen> createState() => _PlaceDetailScreenState();
}

class _PlaceDetailScreenState extends ConsumerState<PlaceDetailScreen> {
  int _photoIndex = 0;
  Place? _place;
  List<PlaceEvent> _events = [];
  bool _loadingEvents = false;
  bool _liked = false;
  int _likesCount = 0;

  @override
  void initState() {
    super.initState();
    _place = widget.place;
    _liked = widget.place.isLiked;
    _likesCount = widget.place.likesCount;
    _loadEvents();
  }

  Future<void> _loadEvents() async {
    setState(() => _loadingEvents = true);
    try {
      final svc = ref.read(placesServiceProvider);
      final events = await svc.getPlaceEvents(widget.place.id);
      if (mounted) setState(() { _events = events; _loadingEvents = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingEvents = false);
    }
  }

  Future<void> _toggleLike() async {
    final svc = ref.read(placesServiceProvider);
    try {
      final result = await svc.toggleLike(widget.place.id);
      setState(() {
        _liked = result['liked'] as bool;
        _likesCount = result['likesCount'] as int;
      });
      ref.read(placesProvider.notifier).toggleLike(widget.place.id);
    } catch (_) {}
  }

  void _share() {
    final text = '推荐一个LGBTQ+友善场所：${_place!.name}\n${_place!.address}';
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('地点信息已复制！'),
        backgroundColor: AppTheme.card,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _openRating() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => RatePlaceSheet(
        placeId: widget.place.id,
        placeName: widget.place.name,
        onSubmitted: (updatedPlace) {
          setState(() => _place = updatedPlace);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final place = _place!;
    final myUserId = ref.watch(authStateProvider).user?.id;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // ── Photo gallery app bar ──────────────────────────────────────
          SliverAppBar(
            expandedHeight: 260,
            pinned: true,
            backgroundColor: AppTheme.bg,
            leading: GestureDetector(
              onTap: () => context.pop(),
              child: Container(
                margin: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_back_ios_rounded, size: 18, color: Colors.white),
              ),
            ),
            actions: [
              GestureDetector(
                onTap: _share,
                child: Container(
                  margin: const EdgeInsets.all(8),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.5),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.share_rounded, size: 18, color: Colors.white),
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: _PhotoGallery(
                photos: place.photos,
                category: place.category,
                index: _photoIndex,
                onIndexChanged: (i) => setState(() => _photoIndex = i),
              ),
            ),
          ),

          // ── Detail body ───────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Name row
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              place.name,
                              style: const TextStyle(
                                  fontSize: 22, fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                _CategoryBadge(category: place.category),
                                if (place.isVerified) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF1565C0).withOpacity(0.2),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                          color: const Color(0xFF1976D2)),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.verified_rounded,
                                            color: Color(0xFF42A5F5), size: 12),
                                        SizedBox(width: 3),
                                        Text('认证场所',
                                            style: TextStyle(
                                                color: Color(0xFF42A5F5),
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700)),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                      Column(
                        children: [
                          GestureDetector(
                            onTap: _toggleLike,
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: _liked
                                    ? AppTheme.primary.withOpacity(0.15)
                                    : AppTheme.card,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: _liked
                                      ? AppTheme.primary
                                      : const Color(0xFF3A3A3A),
                                ),
                              ),
                              child: Icon(
                                _liked
                                    ? Icons.favorite_rounded
                                    : Icons.favorite_border_rounded,
                                color: _liked ? AppTheme.primary : AppTheme.textHint,
                                size: 22,
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$_likesCount',
                            style: TextStyle(
                                color: AppTheme.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),
                  _StarRow(rating: place.averageRating, count: place.totalReviews),

                  if (place.description.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Text(
                      place.description,
                      style: TextStyle(
                          color: AppTheme.textSecondary,
                          fontSize: 14,
                          height: 1.6),
                    ),
                  ],

                  const SizedBox(height: 20),
                  const Divider(color: Color(0xFF2A2A2A)),
                  const SizedBox(height: 16),

                  // ── Info rows ──────────────────────────────────────────
                  if (place.address.isNotEmpty)
                    _InfoRow(
                      icon: Icons.location_on_rounded,
                      text: place.address,
                      color: AppTheme.primary,
                      onTap: () => _openMaps(place),
                    ),
                  if (place.openingHours != null)
                    _InfoRow(
                      icon: Icons.access_time_rounded,
                      text: place.openingHours!,
                      color: const Color(0xFF4CAF50),
                    ),
                  if (place.phone != null)
                    _InfoRow(
                      icon: Icons.phone_rounded,
                      text: place.phone!,
                      color: const Color(0xFF29B6F6),
                      onTap: () => _callPhone(place.phone!),
                    ),
                  if (place.website != null)
                    _InfoRow(
                      icon: Icons.language_rounded,
                      text: place.website!,
                      color: AppTheme.accent,
                      onTap: () => _copyWebsite(place.website!),
                    ),
                  _InfoRow(
                    icon: Icons.attach_money_rounded,
                    text: place.priceRange,
                    color: const Color(0xFFFFB300),
                  ),

                  // ── Tags ───────────────────────────────────────────────
                  if (place.tags.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: place.tags.map((t) => _TagChip(tag: t)).toList(),
                    ),
                  ],

                  // ── Upcoming events ────────────────────────────────────
                  if (!_loadingEvents && _events.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        const Text('即将到来的活动',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w700)),
                        const Spacer(),
                        Text('${_events.length}个',
                            style: TextStyle(
                                color: AppTheme.textSecondary, fontSize: 13)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ..._events.map((e) => _EventTile(event: e)),
                  ],

                  // ── Reviews ────────────────────────────────────────────
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      const Text('评价',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(width: 8),
                      if (place.averageRating > 0)
                        Row(
                          children: [
                            const Icon(Icons.star_rounded,
                                color: Color(0xFFFFD700), size: 16),
                            Text(
                              ' ${place.averageRating.toStringAsFixed(1)}',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                  color: Color(0xFFFFD700)),
                            ),
                          ],
                        ),
                      const Spacer(),
                      if (myUserId != null)
                        GestureDetector(
                          onTap: _openRating,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                  colors: [
                                    AppTheme.gradient1,
                                    AppTheme.gradient2
                                  ]),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Text(
                              '写评价',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (place.ratings.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                        '暂无评价，成为第一个评价的人！',
                        style: TextStyle(
                            color: AppTheme.textSecondary, fontSize: 13),
                      ),
                    )
                  else
                    ...place.ratings.take(10).map((r) => _ReviewTile(rating: r)),

                  // ── Posted by ──────────────────────────────────────────
                  if (place.author != null) ...[
                    const SizedBox(height: 24),
                    const Divider(color: Color(0xFF2A2A2A)),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 18,
                          backgroundColor: AppTheme.surface,
                          backgroundImage: place.author!.avatarUrl != null
                              ? NetworkImage(place.author!.avatarUrl!)
                              : null,
                          child: place.author!.avatarUrl == null
                              ? Text(
                                  place.author!.nickname.isNotEmpty
                                      ? place.author!.nickname[0].toUpperCase()
                                      : '?',
                                  style: const TextStyle(fontSize: 14))
                              : null,
                        ),
                        const SizedBox(width: 10),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '由 ${place.author!.nickname} 提交',
                              style: TextStyle(
                                  color: AppTheme.textSecondary, fontSize: 12),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],

                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openMaps(Place place) {
    final coords = '${place.lat},${place.lng}';
    Clipboard.setData(ClipboardData(text: '${place.name}\n${place.address}\n$coords'));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('地址已复制'),
        backgroundColor: AppTheme.card,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _callPhone(String phone) {
    Clipboard.setData(ClipboardData(text: phone));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('电话已复制: $phone'),
        backgroundColor: AppTheme.card,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _copyWebsite(String url) {
    Clipboard.setData(ClipboardData(text: url));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('网址已复制'),
        backgroundColor: AppTheme.card,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

// ── Photo gallery ─────────────────────────────────────────────────────────────

class _PhotoGallery extends StatelessWidget {
  final List<String> photos;
  final String category;
  final int index;
  final ValueChanged<int> onIndexChanged;

  const _PhotoGallery({
    required this.photos,
    required this.category,
    required this.index,
    required this.onIndexChanged,
  });

  @override
  Widget build(BuildContext context) {
    if (photos.isEmpty) {
      return Container(
        color: AppTheme.surface,
        child: Center(
          child: Text(
            Place.categoryEmoji(category),
            style: const TextStyle(fontSize: 72),
          ),
        ),
      );
    }

    return PageView.builder(
      itemCount: photos.length,
      onPageChanged: onIndexChanged,
      itemBuilder: (_, i) => Image.network(
        photos[i],
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(
          color: AppTheme.surface,
          child: Center(
              child: Text(Place.categoryEmoji(category),
                  style: const TextStyle(fontSize: 72))),
        ),
      ),
    );
  }
}

// ── Info row ──────────────────────────────────────────────────────────────────

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;
  final VoidCallback? onTap;

  const _InfoRow({required this.icon, required this.text, required this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 16),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: 14,
                  color: onTap != null ? AppTheme.textPrimary : AppTheme.textSecondary,
                  decoration: onTap != null ? TextDecoration.underline : null,
                  decorationColor: AppTheme.textHint,
                ),
              ),
            ),
            if (onTap != null)
              Icon(Icons.chevron_right_rounded, color: AppTheme.textHint, size: 16),
          ],
        ),
      ),
    );
  }
}

// ── Event tile ────────────────────────────────────────────────────────────────

class _EventTile extends StatelessWidget {
  final PlaceEvent event;
  const _EventTile({required this.event});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.accent.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppTheme.accent.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Text('🎪', style: TextStyle(fontSize: 20)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(event.title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 14)),
                const SizedBox(height: 2),
                Text(
                  _formatDate(event.date),
                  style: TextStyle(
                      color: AppTheme.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          event.isFree
              ? Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1B5E20),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text('免费',
                      style: TextStyle(
                          color: Color(0xFF4CAF50),
                          fontSize: 11,
                          fontWeight: FontWeight.w700)),
                )
              : Text(
                  'RM${event.price.toStringAsFixed(0)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: Color(0xFFFFD700)),
                ),
        ],
      ),
    );
  }

  String _formatDate(DateTime dt) {
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${dt.day} ${months[dt.month]} · ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}

// ── Review tile ───────────────────────────────────────────────────────────────

class _ReviewTile extends StatelessWidget {
  final PlaceRating rating;
  const _ReviewTile({required this.rating});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: AppTheme.surface,
                backgroundImage: rating.userAvatar != null
                    ? NetworkImage(rating.userAvatar!)
                    : null,
                child: rating.userAvatar == null
                    ? Text(
                        rating.userNickname.isNotEmpty
                            ? rating.userNickname[0].toUpperCase()
                            : '?',
                        style: const TextStyle(fontSize: 12))
                    : null,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(rating.userNickname,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13)),
                    Row(
                      children: List.generate(5, (i) => Icon(
                        i < rating.score
                            ? Icons.star_rounded
                            : Icons.star_outline_rounded,
                        color: const Color(0xFFFFD700),
                        size: 13,
                      )),
                    ),
                  ],
                ),
              ),
              Text(
                _timeAgo(rating.createdAt),
                style: TextStyle(color: AppTheme.textHint, fontSize: 11),
              ),
            ],
          ),
          if (rating.review.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              rating.review,
              style: TextStyle(
                  color: AppTheme.textSecondary, fontSize: 13, height: 1.5),
            ),
          ],
        ],
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inDays > 30) return '${(diff.inDays / 30).floor()}个月前';
    if (diff.inDays > 0) return '${diff.inDays}天前';
    if (diff.inHours > 0) return '${diff.inHours}小时前';
    return '刚刚';
  }
}
