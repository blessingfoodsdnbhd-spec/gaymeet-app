import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/models/user.dart';
import '../../core/providers/energy_provider.dart';
import '../../core/providers/match_provider.dart';
import '../../core/providers/user_provider.dart';
import '../../shared/widgets/level_badge.dart';
import '../../shared/widgets/looking_for_badge.dart';
import '../dm/send_dm_sheet.dart';
import '../gifts/gift_sheet.dart';

// ── Feed mode ─────────────────────────────────────────────────────────────────

enum _FeedMode { recommended, nearby }

// ── Screen ────────────────────────────────────────────────────────────────────

class FullscreenDiscoverScreen extends ConsumerStatefulWidget {
  const FullscreenDiscoverScreen({super.key});

  @override
  ConsumerState<FullscreenDiscoverScreen> createState() =>
      _FullscreenDiscoverScreenState();
}

class _FullscreenDiscoverScreenState
    extends ConsumerState<FullscreenDiscoverScreen>
    with TickerProviderStateMixin {
  final _pageController = PageController();
  _FeedMode _mode = _FeedMode.recommended;
  List<UserModel> _dummyUsers = [];
  bool _showHint = true;

  // Like state
  final Set<String> _liked = {};

  // Horizontal swipe state (current page only)
  double _swipeDx = 0.0;
  int _currentPage = 0;

  // Double-tap heart animation
  late final AnimationController _heartCtrl;
  late final Animation<double> _heartScale;
  late final Animation<double> _heartOpacity;
  bool _showHeart = false;

  @override
  void initState() {
    super.initState();

    _heartCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    );
    _heartScale = TweenSequence([
      TweenSequenceItem(
          tween: Tween(begin: 0.0, end: 1.5)
              .chain(CurveTween(curve: Curves.easeOutBack)),
          weight: 45),
      TweenSequenceItem(
          tween: Tween(begin: 1.5, end: 1.0)
              .chain(CurveTween(curve: Curves.easeIn)),
          weight: 25),
      TweenSequenceItem(
          tween: Tween(begin: 1.0, end: 0.6)
              .chain(CurveTween(curve: Curves.easeIn)),
          weight: 30),
    ]).animate(_heartCtrl);
    _heartOpacity = TweenSequence([
      TweenSequenceItem(tween: ConstantTween(1.0), weight: 65),
      TweenSequenceItem(
          tween: Tween(begin: 1.0, end: 0.0)
              .chain(CurveTween(curve: Curves.easeIn)),
          weight: 35),
    ]).animate(_heartCtrl);
    _heartCtrl.addStatusListener((s) {
      if (s == AnimationStatus.completed && mounted) {
        setState(() => _showHeart = false);
      }
    });

    _loadDummy();
    // Fetch remote users on first mount — without this the provider stays
    // in AsyncValue.loading() until the user manually pulls to refresh.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadRemote();
    });
  }

  @override
  void dispose() {
    _heartCtrl.dispose();
    _pageController.dispose();
    super.dispose();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  void _loadDummy() {
    if (!kUseDummyData) return;
    final list = List<UserModel>.from(DummyData.users)
      ..addAll(DummyData.popularUsers);
    if (_mode == _FeedMode.recommended) {
      list.shuffle();
    } else {
      list.sort((a, b) => (a.distance ?? 9999)
          .compareTo(b.distance ?? 9999));
    }
    setState(() => _dummyUsers = list);
  }

  void _loadRemote() {
    if (kUseDummyData) return;
    if (_mode == _FeedMode.nearby) {
      ref.read(nearbyUsersProvider.notifier).fetchNearby();
    } else {
      ref.read(discoverUsersProvider.notifier).fetchDiscoverUsers();
    }
  }

  List<UserModel> _getUsers() {
    if (kUseDummyData) return _dummyUsers;
    return (_mode == _FeedMode.nearby
            ? ref.watch(nearbyUsersProvider).valueOrNull
            : ref.watch(discoverUsersProvider).valueOrNull) ??
        [];
  }

  void _switchMode(_FeedMode mode) {
    if (_mode == mode) return;
    setState(() {
      _mode = mode;
    });
    _pageController.jumpToPage(0);
    _loadDummy();
    _loadRemote();
  }

  Future<void> _refresh() async {
    _loadDummy();
    _loadRemote();
    if (_pageController.hasClients) _pageController.jumpToPage(0);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  void _advancePage() {
    if (_pageController.hasClients) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    }
  }

  void _doLike(UserModel user) {
    if (_liked.contains(user.id)) return;
    HapticFeedback.lightImpact();
    setState(() {
      _liked.add(user.id);
      _swipeDx = 0.0;
    });
    if (!kUseDummyData) {
      ref.read(matchesProvider.notifier).swipe(user.id, 'like');
    }
    _advancePage();
  }

  void _doPass(UserModel user) {
    HapticFeedback.lightImpact();
    setState(() => _swipeDx = 0.0);
    if (!kUseDummyData) {
      ref.read(matchesProvider.notifier).swipe(user.id, 'pass');
    }
    _advancePage();
  }

  void _doDoubleTap(UserModel user) {
    _doLike(user);
    setState(() => _showHeart = true);
    _heartCtrl.forward(from: 0);
  }

  void _showMoreSheet(UserModel user) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 20),
              decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(2)),
            ),
            ListTile(
              leading: Icon(Icons.block_rounded, color: AppTheme.error),
              title: Text('屏蔽 ${user.nickname}'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('已屏蔽 ${user.nickname}')),
                );
              },
            ),
            ListTile(
              leading: Icon(Icons.flag_rounded, color: AppTheme.error),
              title: Text('举报 ${user.nickname}'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('已举报 ${user.nickname}')),
                );
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final users = _getUsers();
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: Colors.black,
      extendBody: true,
      body: Stack(
        children: [
          // ── Feed ────────────────────────────────────────────────────────────
          if (users.isEmpty)
            _EmptyState(onRefresh: _refresh)
          else
            RefreshIndicator(
              color: AppTheme.primary,
              onRefresh: _refresh,
              child: PageView.builder(
                controller: _pageController,
                scrollDirection: Axis.vertical,
                physics: const PageScrollPhysics(
                    parent: ClampingScrollPhysics()),
                itemCount: users.length,
                onPageChanged: (i) {
                  setState(() {
                    _showHint = false;
                    _swipeDx = 0.0;
                    _currentPage = i;
                  });
                  // Preload ±2 pages worth of images is handled automatically
                  // by CachedNetworkImage's cache. Nothing extra needed.
                },
                itemBuilder: (context, i) {
                  final user = users[i];
                  final isActive = i == _currentPage;
                  final dx = isActive ? _swipeDx : 0.0;

                  final page = _UserPage(
                    key: ValueKey(user.id),
                    user: user,
                    isLiked: _liked.contains(user.id),
                    onDoubleTap: () => _doDoubleTap(user),
                    onTapProfile: () => context.push('/user/${user.id}', extra: user),
                    onLike: () => _doLike(user),
                    onMessage: () => showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => SendDmSheet(
                        receiverId: user.id,
                        receiverName: user.nickname,
                      ),
                    ),
                    onGift: () => showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => GiftSheet(
                        receiverId: user.id,
                        receiverName: user.nickname,
                      ),
                    ),
                    onEnergy: () async {
                      final error = await ref
                          .read(energyProvider.notifier)
                          .sendEnergy(user.id);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text(error == null ? '已送出能量 ⚡' : '发送失败'),
                          backgroundColor: error == null
                              ? AppTheme.surface
                              : AppTheme.error,
                        ));
                      }
                    },
                    onPrivatePhotos: () =>
                        context.push('/user/${user.id}', extra: user),
                    onMore: () => _showMoreSheet(user),
                  );

                  return GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onHorizontalDragUpdate: (d) {
                      if (isActive) setState(() => _swipeDx += d.delta.dx);
                    },
                    onHorizontalDragEnd: (d) {
                      if (!isActive) return;
                      final vel = d.primaryVelocity ?? 0;
                      // Flick gesture: use velocity; slow drag: use offset
                      final decision = vel.abs() > 300 ? vel : _swipeDx;
                      setState(() => _swipeDx = 0.0);
                      if (decision < -60) {
                        _doLike(user); // ← left = like
                      } else if (decision > 60) {
                        _doPass(user); // → right = pass
                      }
                    },
                    onHorizontalDragCancel: () {
                      if (isActive) setState(() => _swipeDx = 0.0);
                    },
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        Transform.translate(
                          offset: Offset(dx * 0.25, 0),
                          child: page,
                        ),
                        // ← Left swipe = LIKE overlay
                        if (dx < -20)
                          IgnorePointer(
                            child: Positioned.fill(
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Padding(
                                  padding: const EdgeInsets.only(left: 28),
                                  child: Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: AppTheme.primary.withValues(
                                          alpha: (dx.abs().clamp(20, 120) - 20) / 100 * 0.45),
                                    ),
                                    child: Icon(
                                      Icons.favorite_rounded,
                                      color: AppTheme.primary,
                                      size: 52,
                                      shadows: const [
                                        Shadow(color: Colors.black54, blurRadius: 10)
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        // → Right swipe = PASS overlay
                        if (dx > 20)
                          IgnorePointer(
                            child: Positioned.fill(
                              child: Align(
                                alignment: Alignment.centerRight,
                                child: Padding(
                                  padding: const EdgeInsets.only(right: 28),
                                  child: Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: Colors.white.withValues(
                                          alpha: (dx.clamp(20, 120) - 20) / 100 * 0.25),
                                    ),
                                    child: const Icon(
                                      Icons.close_rounded,
                                      color: Colors.white70,
                                      size: 52,
                                      shadows: [
                                        Shadow(color: Colors.black54, blurRadius: 10)
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),

          // ── Top bar ─────────────────────────────────────────────────────────
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: _TopBar(
              mode: _mode,
              onSwitch: _switchMode,
            ),
          ),

          // ── Heart pop animation ──────────────────────────────────────────────
          if (_showHeart)
            IgnorePointer(
              child: Center(
                child: AnimatedBuilder(
                  animation: _heartCtrl,
                  builder: (_, __) => Opacity(
                    opacity: _heartOpacity.value,
                    child: Transform.scale(
                      scale: _heartScale.value,
                      child: const Icon(
                        Icons.favorite_rounded,
                        color: AppTheme.primary,
                        size: 110,
                        shadows: [
                          Shadow(
                            color: Colors.black38,
                            blurRadius: 20,
                          )
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),

          // ── Swipe-up hint ───────────────────────────────────────────────────
          if (_showHint && users.isNotEmpty)
            Positioned(
              bottom: bottomPad + kBottomNavigationBarHeight + 20,
              left: 0,
              right: 0,
              child: const _SwipeHint(),
            ),
        ],
      ),
    );
  }
}

// ── Top bar ───────────────────────────────────────────────────────────────────

class _TopBar extends StatelessWidget {
  final _FeedMode mode;
  final ValueChanged<_FeedMode> onSwitch;

  const _TopBar({required this.mode, required this.onSwitch});

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;

    return Container(
      padding: EdgeInsets.only(
          top: topPad + 8, left: 16, right: 16, bottom: 12),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.black54, Colors.transparent],
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Mode toggle pill
          Container(
            height: 34,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                  color: Colors.white.withValues(alpha: 0.15), width: 0.5),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ModeTab(
                  label: '推荐',
                  selected: mode == _FeedMode.recommended,
                  onTap: () => onSwitch(_FeedMode.recommended),
                ),
                _ModeTab(
                  label: '附近',
                  selected: mode == _FeedMode.nearby,
                  onTap: () => onSwitch(_FeedMode.nearby),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeTab extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ModeTab(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.black : Colors.white,
            fontSize: 13,
            fontWeight:
                selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

// ── Per-user page ─────────────────────────────────────────────────────────────

class _UserPage extends StatelessWidget {
  final UserModel user;
  final bool isLiked;
  final VoidCallback onDoubleTap;
  final VoidCallback onTapProfile;
  final VoidCallback onLike;
  final VoidCallback onMessage;
  final VoidCallback onGift;
  final VoidCallback onEnergy;
  final VoidCallback onPrivatePhotos;
  final VoidCallback onMore;

  const _UserPage({
    super.key,
    required this.user,
    required this.isLiked,
    required this.onDoubleTap,
    required this.onTapProfile,
    required this.onLike,
    required this.onMessage,
    required this.onGift,
    required this.onEnergy,
    required this.onPrivatePhotos,
    required this.onMore,
  });

  @override
  Widget build(BuildContext context) {
    final bottomPad =
        MediaQuery.of(context).padding.bottom + kBottomNavigationBarHeight;

    return Stack(
      fit: StackFit.expand,
      children: [
        // ── Full-screen photo ──────────────────────────────────────────────
        GestureDetector(
          onDoubleTap: onDoubleTap,
          onTap: onTapProfile,
          child: _Photo(user: user),
        ),

        // ── Gradient scrims ────────────────────────────────────────────────
        // Top scrim (for top bar readability — handled by _TopBar's own gradient)
        // Bottom scrim (for user info readability)
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: const [0.0, 0.35, 0.60, 1.0],
                colors: [
                  Colors.transparent,
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.25),
                  Colors.black.withValues(alpha: 0.88),
                ],
              ),
            ),
          ),
        ),

        // ── Right action column ────────────────────────────────────────────
        Positioned(
          right: 10,
          bottom: bottomPad + 24,
          child: _ActionColumn(
            user: user,
            isLiked: isLiked,
            onLike: onLike,
            onMessage: onMessage,
            onGift: onGift,
            onEnergy: onEnergy,
            onPrivatePhotos: onPrivatePhotos,
            onMore: onMore,
          ),
        ),

        // ── Left-bottom user info ──────────────────────────────────────────
        Positioned(
          left: 16,
          right: 80,
          bottom: bottomPad + 24,
          child: _UserInfo(user: user),
        ),
      ],
    );
  }
}

// ── Photo widget ──────────────────────────────────────────────────────────────

class _Photo extends StatelessWidget {
  final UserModel user;
  const _Photo({required this.user});

  Color _placeholderColor() {
    final colors = [
      const Color(0xFF1565C0),
      const Color(0xFF6A1B9A),
      const Color(0xFF880E4F),
      const Color(0xFF0277BD),
      const Color(0xFF2E7D32),
      const Color(0xFFBF360C),
    ];
    final h = user.id.codeUnits.fold(0, (a, b) => a + b);
    return colors[h % colors.length];
  }

  String _initials() {
    final parts = user.nickname.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return user.nickname.isNotEmpty ? user.nickname[0].toUpperCase() : '?';
  }

  @override
  Widget build(BuildContext context) {
    if (user.avatarUrl != null) {
      return CachedNetworkImage(
        imageUrl: user.avatarUrl!,
        fit: BoxFit.cover,
        fadeInDuration: const Duration(milliseconds: 200),
        placeholder: (_, __) => Container(color: _placeholderColor()),
        errorWidget: (_, __, ___) => _placeholder(),
      );
    }
    return _placeholder();
  }

  Widget _placeholder() {
    return Container(
      color: _placeholderColor(),
      alignment: Alignment.center,
      child: Text(
        _initials(),
        style: const TextStyle(
            color: Colors.white,
            fontSize: 72,
            fontWeight: FontWeight.w700),
      ),
    );
  }
}

// ── Right action column ───────────────────────────────────────────────────────

class _ActionColumn extends StatelessWidget {
  final UserModel user;
  final bool isLiked;
  final VoidCallback onLike;
  final VoidCallback onMessage;
  final VoidCallback onGift;
  final VoidCallback onEnergy;
  final VoidCallback onPrivatePhotos;
  final VoidCallback onMore;

  const _ActionColumn({
    required this.user,
    required this.isLiked,
    required this.onLike,
    required this.onMessage,
    required this.onGift,
    required this.onEnergy,
    required this.onPrivatePhotos,
    required this.onMore,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // ❤️ Like
        _SideBtn(
          icon: isLiked
              ? Icons.favorite_rounded
              : Icons.favorite_border_rounded,
          color: isLiked ? AppTheme.primary : Colors.white,
          label: '',
          onTap: onLike,
          glow: isLiked,
        ),
        const SizedBox(height: 20),

        // 💬 Message
        _SideBtn(
          icon: Icons.chat_bubble_rounded,
          color: Colors.white,
          label: '',
          onTap: onMessage,
        ),
        const SizedBox(height: 20),

        // 🎁 Gift
        _SideBtn(
          emoji: '🎁',
          color: Colors.white,
          label: '',
          onTap: onGift,
        ),
        const SizedBox(height: 20),

        // ⚡ Energy
        _SideBtn(
          emoji: '⚡',
          color: const Color(0xFFFFD700),
          label: 'Lv.${user.level}',
          onTap: onEnergy,
        ),
        const SizedBox(height: 20),

        // 🔒 Private photos
        if (user.privatePhotos.isNotEmpty) ...[
          _SideBtn(
            icon: Icons.lock_rounded,
            color: const Color(0xFFFFD700),
            label: '${user.privatePhotos.length}',
            onTap: onPrivatePhotos,
          ),
          const SizedBox(height: 20),
        ],

        // ⋯ More
        _SideBtn(
          icon: Icons.more_horiz_rounded,
          color: Colors.white,
          label: '',
          onTap: onMore,
        ),
      ],
    );
  }
}

class _SideBtn extends StatelessWidget {
  final IconData? icon;
  final String? emoji;
  final Color color;
  final String label;
  final VoidCallback onTap;
  final bool glow;

  const _SideBtn({
    this.icon,
    this.emoji,
    required this.color,
    required this.label,
    required this.onTap,
    this.glow = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.black.withValues(alpha: 0.35),
              boxShadow: glow
                  ? [
                      BoxShadow(
                        color: color.withValues(alpha: 0.5),
                        blurRadius: 14,
                        spreadRadius: 1,
                      )
                    ]
                  : null,
            ),
            alignment: Alignment.center,
            child: emoji != null
                ? Text(emoji!, style: const TextStyle(fontSize: 22))
                : Icon(icon!, color: color, size: 24),
          ),
          if (label.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w600,
                shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── User info overlay ─────────────────────────────────────────────────────────

class _UserInfo extends StatelessWidget {
  final UserModel user;
  const _UserInfo({required this.user});

  @override
  Widget build(BuildContext context) {
    final stats = <String>[
      if (user.age != null) '${user.age}岁',
      if (user.height != null) '${user.height}cm',
      if (user.weight != null) '${user.weight}kg',
      if (user.distanceLabel != null) user.distanceLabel!,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Name row
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Flexible(
              child: Text(
                user.nickname,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  shadows: [Shadow(color: Colors.black54, blurRadius: 8)],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (user.isVerified) ...[
              const SizedBox(width: 5),
              const Icon(Icons.verified_rounded,
                  size: 18, color: Color(0xFF42A5F5)),
            ],
            const SizedBox(width: 6),
            LevelBadge(level: user.level, size: 30),
          ],
        ),

        // Stats row
        if (stats.isNotEmpty) ...[
          const SizedBox(height: 5),
          Row(
            children: [
              Icon(Icons.location_on_rounded,
                  size: 12, color: Colors.white.withValues(alpha: 0.8)),
              const SizedBox(width: 3),
              Text(
                stats.join('  ·  '),
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.85),
                  fontSize: 12,
                  shadows: const [
                    Shadow(color: Colors.black54, blurRadius: 4)
                  ],
                ),
              ),
            ],
          ),
        ],

        // Badges row (role + looking for)
        if (user.role != null || user.lookingFor != null) ...[
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              if (user.role != null) _RoleBadge(role: user.role!),
              if (user.lookingFor != null)
                LookingForBadge(status: user.lookingFor!, small: true),
            ],
          ),
        ],

        // Bio
        if (user.bio != null && user.bio!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            user.bio!,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.88),
              fontSize: 13,
              height: 1.4,
              shadows: const [
                Shadow(color: Colors.black54, blurRadius: 4)
              ],
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }
}

// ── Role badge ────────────────────────────────────────────────────────────────

class _RoleBadge extends StatelessWidget {
  final String role;
  const _RoleBadge({required this.role});

  static const _labels = {'top': 'Top', 'bottom': 'Bot', 'versatile': 'Ver'};
  static const _colors = {
    'top': Color(0xFF1565C0),
    'bottom': Color(0xFFAD1457),
    'versatile': Color(0xFF6A1B9A),
  };

  @override
  Widget build(BuildContext context) {
    final label = _labels[role] ?? role;
    final color = _colors[role] ?? AppTheme.card;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label,
          style: const TextStyle(
              color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

// ── Swipe hint ────────────────────────────────────────────────────────────────

class _SwipeHint extends StatefulWidget {
  const _SwipeHint();

  @override
  State<_SwipeHint> createState() => _SwipeHintState();
}

class _SwipeHintState extends State<_SwipeHint>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _anim = Tween(begin: 0.0, end: -10.0)
        .chain(CurveTween(curve: Curves.easeInOut))
        .animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Transform.translate(
        offset: Offset(0, _anim.value),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.keyboard_arrow_up_rounded,
                color: Colors.white54, size: 28),
            Text(
              '向上滑 · 左滑 ❤️ · 右滑 ✗',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.55),
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  final VoidCallback onRefresh;
  const _EmptyState({required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('😢', style: TextStyle(fontSize: 52)),
          const SizedBox(height: 16),
          const Text('附近暂无用户',
              style: TextStyle(
                  color: Colors.white70,
                  fontSize: 17,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          const Text('换个时间再来看看',
              style: TextStyle(color: Colors.white38, fontSize: 13)),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: onRefresh,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.primary,
              side: BorderSide(color: AppTheme.primary.withValues(alpha: 0.6)),
            ),
            icon: const Icon(Icons.refresh_rounded, size: 16),
            label: const Text('刷新'),
          ),
        ],
      ),
    );
  }
}
