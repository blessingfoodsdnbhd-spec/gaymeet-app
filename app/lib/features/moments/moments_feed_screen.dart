import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/models/moment.dart';
import '../../core/providers/moments_provider.dart';

class MomentsFeedScreen extends ConsumerStatefulWidget {
  const MomentsFeedScreen({super.key});

  @override
  ConsumerState<MomentsFeedScreen> createState() => _MomentsFeedScreenState();
}

class _MomentsFeedScreenState extends ConsumerState<MomentsFeedScreen> {
  final _scrollC = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollC.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollC.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollC.position.pixels >=
        _scrollC.position.maxScrollExtent - 200) {
      ref.read(momentsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(momentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('动态'),
        actions: [
          IconButton(
            icon: const Icon(Icons.event_rounded, size: 22),
            tooltip: '活动',
            onPressed: () => context.push('/events'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final created = await context.push<bool>('/moments/create');
          if (created == true) {
            ref.read(momentsProvider.notifier).fetchFeed();
          }
        },
        backgroundColor: AppTheme.primary,
        child: const Icon(Icons.add_rounded, color: Colors.white),
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.moments.isEmpty
              ? _buildEmpty()
              : RefreshIndicator(
                  color: AppTheme.primary,
                  onRefresh: () =>
                      ref.read(momentsProvider.notifier).fetchFeed(),
                  child: ListView.builder(
                    controller: _scrollC,
                    itemCount:
                        state.moments.length + (state.isLoadingMore ? 1 : 0),
                    itemBuilder: (_, i) {
                      if (i == state.moments.length) {
                        return const Padding(
                          padding: EdgeInsets.all(16),
                          child: Center(
                              child: CircularProgressIndicator()),
                        );
                      }
                      return _MomentCard(moment: state.moments[i]);
                    },
                  ),
                ),
    );
  }

  Widget _buildEmpty() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.photo_library_outlined,
                size: 52, color: AppTheme.textHint),
            const SizedBox(height: 12),
            Text('还没有动态',
                style:
                    TextStyle(color: AppTheme.textSecondary, fontSize: 15)),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () => context.push('/moments/create'),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('发布第一条动态'),
            ),
          ],
        ),
      );
}

// ── Moment Card ───────────────────────────────────────────────────────────────

class _MomentCard extends ConsumerStatefulWidget {
  final Moment moment;
  const _MomentCard({required this.moment});

  @override
  ConsumerState<_MomentCard> createState() => _MomentCardState();
}

class _MomentCardState extends ConsumerState<_MomentCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _heartCtrl;
  late Animation<double> _heartScale;

  @override
  void initState() {
    super.initState();
    _heartCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _heartScale = TweenSequence([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.4), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.4, end: 1.0), weight: 50),
    ]).animate(_heartCtrl);
  }

  @override
  void dispose() {
    _heartCtrl.dispose();
    super.dispose();
  }

  void _like() {
    _heartCtrl.forward(from: 0);
    ref.read(momentsProvider.notifier).toggleLike(widget.moment.id);
  }

  @override
  Widget build(BuildContext context) {
    final m = widget.moment;

    return GestureDetector(
      onTap: () => context.push('/moments/${m.id}', extra: m),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 0, vertical: 0),
        decoration: const BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Color(0xFF1E1E1E), width: 6),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
              child: Row(
                children: [
                  _Avatar(user: m.user),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(m.user.nickname,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14)),
                            if (m.user.isPremium) ...[
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 5, vertical: 1),
                                decoration: BoxDecoration(
                                  gradient: AppTheme.brandGradient,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text('VIP',
                                    style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white)),
                              ),
                            ],
                          ],
                        ),
                        Text(
                          _timeAgo(m.createdAt),
                          style: TextStyle(
                              color: AppTheme.textHint, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.more_horiz_rounded,
                      color: AppTheme.textHint, size: 20),
                ],
              ),
            ),

            // ── Content ──────────────────────────────────────────────────────
            if (m.content.isNotEmpty)
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Text(m.content,
                    style: const TextStyle(fontSize: 15, height: 1.5)),
              ),

            // ── Photo grid ───────────────────────────────────────────────────
            if (m.images.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
                child: _PhotoGrid(images: m.images),
              ),

            // ── Actions ──────────────────────────────────────────────────────
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  // Like
                  ScaleTransition(
                    scale: _heartScale,
                    child: GestureDetector(
                      onTap: _like,
                      child: Row(
                        children: [
                          Icon(
                            m.isLiked
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            color: m.isLiked
                                ? AppTheme.primary
                                : AppTheme.textHint,
                            size: 22,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            m.likeCount.toString(),
                            style: TextStyle(
                                color: m.isLiked
                                    ? AppTheme.primary
                                    : AppTheme.textHint,
                                fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 24),
                  // Comment
                  GestureDetector(
                    onTap: () => context.push('/moments/${m.id}', extra: m),
                    child: Row(
                      children: [
                        Icon(Icons.chat_bubble_outline_rounded,
                            color: AppTheme.textHint, size: 20),
                        const SizedBox(width: 4),
                        Text(m.commentsCount.toString(),
                            style: TextStyle(
                                color: AppTheme.textHint, fontSize: 13)),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Icon(Icons.share_rounded,
                      color: AppTheme.textHint, size: 20),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    if (diff.inDays < 7) return '${diff.inDays}天前';
    return '${dt.month}/${dt.day}';
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────

class _Avatar extends StatelessWidget {
  final MomentUser user;
  const _Avatar({required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(shape: BoxShape.circle),
      clipBehavior: Clip.antiAlias,
      child: user.avatarUrl != null
          ? CachedNetworkImage(
              imageUrl: user.avatarUrl!,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(color: AppTheme.card),
              errorWidget: (_, __, ___) => _placeholder,
            )
          : _placeholder,
    );
  }

  static final _placeholder = Container(
    color: AppTheme.card,
    child: const Icon(Icons.person_rounded, color: Color(0xFF3A3A3A), size: 22),
  );
}

// ── Photo Grid ────────────────────────────────────────────────────────────────

class _PhotoGrid extends StatelessWidget {
  final List<String> images;
  const _PhotoGrid({required this.images});

  @override
  Widget build(BuildContext context) {
    if (images.isEmpty) return const SizedBox.shrink();
    if (images.length == 1) {
      return AspectRatio(
        aspectRatio: 4 / 3,
        child: _Img(url: images[0], borderRadius: 8),
      );
    }
    if (images.length == 2) {
      return Row(
        children: [
          Expanded(child: AspectRatio(aspectRatio: 1, child: _Img(url: images[0]))),
          const SizedBox(width: 3),
          Expanded(child: AspectRatio(aspectRatio: 1, child: _Img(url: images[1]))),
        ],
      );
    }
    // 3+: 3-column grid
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 3,
        crossAxisSpacing: 3,
      ),
      itemCount: images.length > 9 ? 9 : images.length,
      itemBuilder: (_, i) {
        if (i == 8 && images.length > 9) {
          return Stack(
            fit: StackFit.expand,
            children: [
              _Img(url: images[i]),
              Container(
                color: Colors.black54,
                child: Center(
                  child: Text('+${images.length - 8}',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          );
        }
        return _Img(url: images[i]);
      },
    );
  }
}

class _Img extends StatelessWidget {
  final String url;
  final double borderRadius;
  const _Img({required this.url, this.borderRadius = 0});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: CachedNetworkImage(
        imageUrl: url,
        fit: BoxFit.cover,
        placeholder: (_, __) => Container(color: AppTheme.card),
        errorWidget: (_, __, ___) =>
            Container(color: AppTheme.card, child: const Icon(Icons.broken_image_rounded)),
      ),
    );
  }
}
