import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/story.dart';
import '../../core/providers/stories_provider.dart';
import '../../core/theme/design_system.dart';

/// Full-screen story viewer.
/// Pass `extra: List<StoryGroup>` and navigate to `/stories/view/:userId`.
class StoryViewerScreen extends ConsumerStatefulWidget {
  final String userId;
  final List<StoryGroup> groups;

  const StoryViewerScreen({
    super.key,
    required this.userId,
    required this.groups,
  });

  @override
  ConsumerState<StoryViewerScreen> createState() => _StoryViewerScreenState();
}

class _StoryViewerScreenState extends ConsumerState<StoryViewerScreen>
    with TickerProviderStateMixin {
  late int _groupIndex;
  int _storyIndex = 0;
  late AnimationController _progressCtrl;
  bool _isPaused = false;

  static const _storyDuration = Duration(seconds: 5);

  @override
  void initState() {
    super.initState();
    _groupIndex = widget.groups.indexWhere((g) => g.user.id == widget.userId);
    if (_groupIndex < 0) _groupIndex = 0;
    _startProgress();
  }

  @override
  void dispose() {
    _progressCtrl.dispose();
    super.dispose();
  }

  StoryGroup get _currentGroup => widget.groups[_groupIndex];
  StoryItem get _currentStory => _currentGroup.stories[_storyIndex];

  void _startProgress() {
    _progressCtrl = AnimationController(vsync: this, duration: _storyDuration);
    _progressCtrl.addStatusListener((status) {
      if (status == AnimationStatus.completed) _next();
    });
    _progressCtrl.forward();
    _markViewed();
  }

  void _resetProgress() {
    _progressCtrl.dispose();
    _startProgress();
  }

  void _markViewed() {
    ref.read(storiesProvider.notifier).markGroupViewed(
          _currentGroup.user.id,
          _currentStory.id,
        );
  }

  void _next() {
    if (_storyIndex < _currentGroup.stories.length - 1) {
      setState(() => _storyIndex++);
      _resetProgress();
    } else if (_groupIndex < widget.groups.length - 1) {
      setState(() {
        _groupIndex++;
        _storyIndex = 0;
      });
      _resetProgress();
    } else {
      Navigator.of(context).pop();
    }
  }

  void _prev() {
    if (_storyIndex > 0) {
      setState(() => _storyIndex--);
      _resetProgress();
    } else if (_groupIndex > 0) {
      setState(() {
        _groupIndex--;
        _storyIndex = 0;
      });
      _resetProgress();
    }
  }

  void _pause() {
    _isPaused = true;
    _progressCtrl.stop();
  }

  void _resume() {
    _isPaused = false;
    _progressCtrl.forward();
  }

  @override
  Widget build(BuildContext context) {
    final group = _currentGroup;
    final story = _currentStory;

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTapDown: (_) => _pause(),
        onTapUp: (details) {
          _resume();
          final screenWidth = MediaQuery.of(context).size.width;
          if (details.globalPosition.dx < screenWidth * 0.35) {
            _prev();
          } else {
            _next();
          }
        },
        onLongPressStart: (_) => _pause(),
        onLongPressEnd: (_) => _resume(),
        onVerticalDragEnd: (details) {
          if (details.primaryVelocity != null && details.primaryVelocity! > 200) {
            Navigator.of(context).pop();
          }
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            // ── Story image ────────────────────────────────────────────────
            story.mediaType == 'video'
                ? const Center(
                    child: Icon(Icons.videocam_rounded,
                        size: 64, color: Colors.white54),
                  )
                : CachedNetworkImage(
                    imageUrl: story.mediaUrl,
                    fit: BoxFit.cover,
                    placeholder: (_, __) =>
                        Container(color: AppColors.bgCard),
                    errorWidget: (_, __, ___) =>
                        Container(color: AppColors.bgCard),
                  ),

            // ── Gradient overlay top ───────────────────────────────────────
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 160,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.black54, Colors.transparent],
                  ),
                ),
              ),
            ),

            // ── Progress bars ──────────────────────────────────────────────
            Positioned(
              top: MediaQuery.of(context).padding.top + 8,
              left: 8,
              right: 8,
              child: Row(
                children: List.generate(group.stories.length, (i) {
                  return Expanded(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      height: 2.5,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(2),
                      ),
                      child: i < _storyIndex
                          ? Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(2),
                              ),
                            )
                          : i == _storyIndex
                              ? AnimatedBuilder(
                                  animation: _progressCtrl,
                                  builder: (_, __) => FractionallySizedBox(
                                    alignment: Alignment.centerLeft,
                                    widthFactor: _progressCtrl.value,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(2),
                                      ),
                                    ),
                                  ),
                                )
                              : const SizedBox.shrink(),
                    ),
                  );
                }),
              ),
            ),

            // ── Author row ─────────────────────────────────────────────────
            Positioned(
              top: MediaQuery.of(context).padding.top + 22,
              left: 12,
              right: 12,
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundImage: group.user.avatarUrl != null
                        ? CachedNetworkImageProvider(group.user.avatarUrl!)
                        : null,
                    backgroundColor: AppColors.bgSurface,
                    child: group.user.avatarUrl == null
                        ? const Icon(Icons.person_rounded,
                            size: 16, color: Colors.white54)
                        : null,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    group.user.nickname,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      shadows: [Shadow(color: Colors.black54, blurRadius: 4)],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _timeAgo(story.createdAt),
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: const Icon(Icons.close_rounded,
                        color: Colors.white, size: 24),
                  ),
                ],
              ),
            ),

            // ── Caption ────────────────────────────────────────────────────
            if (story.caption.isNotEmpty)
              Positioned(
                bottom: MediaQuery.of(context).padding.bottom + 48,
                left: 16,
                right: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black45,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    story.caption,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        height: 1.4),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),

            // ── View count ─────────────────────────────────────────────────
            Positioned(
              bottom: MediaQuery.of(context).padding.bottom + 12,
              left: 0,
              right: 0,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.visibility_outlined,
                      color: Colors.white60, size: 15),
                  const SizedBox(width: 4),
                  Text(
                    '${story.viewCount}',
                    style: const TextStyle(color: Colors.white60, fontSize: 12),
                  ),
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
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    return '${diff.inDays}d';
  }
}
