import 'dart:async';
import 'dart:math';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/models/date_room.dart';
import '../../core/providers/date_rooms_provider.dart';

class DateRoomScreen extends ConsumerStatefulWidget {
  const DateRoomScreen({super.key});

  @override
  ConsumerState<DateRoomScreen> createState() => _DateRoomScreenState();
}

class _DateRoomScreenState extends ConsumerState<DateRoomScreen>
    with SingleTickerProviderStateMixin {
  // 0 = pick duration, 1 = waiting room, 2 = active room
  int _phase = 0;
  int _selectedDuration = 30;
  Timer? _countdownTimer;
  Duration _remaining = Duration.zero;

  late final AnimationController _heartCtrl;

  @override
  void initState() {
    super.initState();
    _heartCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();

    // Check if there's already an active room
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final active = ref.read(dateRoomProvider).activeRoom;
      if (active != null) {
        if (active.isActive) {
          _startCountdown(active);
          setState(() => _phase = 2);
        } else if (active.isWaiting) {
          setState(() => _phase = 1);
        }
      }
    });
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _heartCtrl.dispose();
    super.dispose();
  }

  void _startCountdown(DateRoom room) {
    _remaining = room.remainingDuration;
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_remaining.inSeconds <= 0) {
          _countdownTimer?.cancel();
          _onTimerExpired(room.id);
        } else {
          _remaining -= const Duration(seconds: 1);
        }
      });
    });
  }

  void _onTimerExpired(String roomId) {
    ref.read(dateRoomProvider.notifier).endRoom(roomId);
    if (mounted) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => AlertDialog(
          backgroundColor: AppTheme.surface,
          title: const Text('约会时间结束 ✨'),
          content: const Text('你们的虚拟约会已圆满结束，希望你们度过了美好的时光！'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.pop(context);
              },
              child: Text('完成', style: TextStyle(color: AppTheme.primary)),
            ),
          ],
        ),
      );
    }
  }

  Future<void> _createRoom() async {
    final room = await ref.read(dateRoomProvider.notifier).createRoom(_selectedDuration);
    if (room == null && mounted) {
      final err = ref.read(dateRoomProvider).error ?? '创建失败';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
      return;
    }
    if (mounted) setState(() => _phase = 1);
  }

  Future<void> _endRoom() async {
    final room = ref.read(dateRoomProvider).activeRoom;
    if (room == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const Text('结束约会？'),
        content: const Text('确定要提前结束这次虚拟约会吗？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('结束', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      _countdownTimer?.cancel();
      await ref.read(dateRoomProvider.notifier).endRoom(room.id);
      if (mounted) Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(dateRoomProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('虚拟约会房间'),
        actions: [
          if (_phase == 2)
            TextButton(
              onPressed: _endRoom,
              child: const Text('结束', style: TextStyle(color: Colors.redAccent)),
            ),
        ],
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 400),
        child: switch (_phase) {
          0 => _PickDurationView(
              key: const ValueKey(0),
              selected: _selectedDuration,
              isLoading: state.isLoading,
              onSelect: (d) => setState(() => _selectedDuration = d),
              onCreate: _createRoom,
            ),
          1 => _WaitingRoomView(
              key: const ValueKey(1),
              room: state.activeRoom,
              heartCtrl: _heartCtrl,
              onCancel: () {
                final r = state.activeRoom;
                if (r != null) ref.read(dateRoomProvider.notifier).endRoom(r.id);
                setState(() => _phase = 0);
              },
            ),
          2 => _ActiveRoomView(
              key: const ValueKey(2),
              room: state.activeRoom!,
              remaining: _remaining,
              onEnd: _endRoom,
            ),
          _ => const SizedBox.shrink(),
        },
      ),
    );
  }
}

// ── Phase 0: Pick duration ─────────────────────────────────────────────────────

class _PickDurationView extends StatelessWidget {
  final int selected;
  final bool isLoading;
  final ValueChanged<int> onSelect;
  final VoidCallback onCreate;

  const _PickDurationView({
    super.key,
    required this.selected,
    required this.isLoading,
    required this.onSelect,
    required this.onCreate,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('💑', style: TextStyle(fontSize: 60)),
          const SizedBox(height: 20),
          const Text('虚拟约会',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text(
            '选择约会时长，创建专属约会房间，等待对方加入',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textSecondary, height: 1.5),
          ),
          const SizedBox(height: 40),

          // Duration cards
          ...kDateRoomCosts.entries.map((e) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _DurationCard(
                  minutes: e.key,
                  coins: e.value,
                  isSelected: selected == e.key,
                  onTap: () => onSelect(e.key),
                ),
              )),

          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: isLoading ? null : onCreate,
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text('花 ${kDateRoomCosts[selected]}🪙 创建约会房间'),
            ),
          ),
        ],
      ),
    );
  }
}

class _DurationCard extends StatelessWidget {
  final int minutes;
  final int coins;
  final bool isSelected;
  final VoidCallback onTap;

  const _DurationCard({
    required this.minutes,
    required this.coins,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary.withValues(alpha: 0.12) : AppTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppTheme.primary : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: isSelected ? AppTheme.primary : AppTheme.surface,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  '$minutes',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    color: isSelected ? Colors.white : AppTheme.textSecondary,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$minutes 分钟约会',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: isSelected ? AppTheme.primary : AppTheme.textPrimary,
                    ),
                  ),
                  Text(
                    _label(minutes),
                    style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFB300), Color(0xFFFF6D00)],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$coins 🪙',
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _label(int m) {
    if (m == 15) return '轻松聊聊，破冰专用';
    if (m == 30) return '深入了解，最受欢迎 ✨';
    return '沉浸式约会，超值体验';
  }
}

// ── Phase 1: Waiting room ─────────────────────────────────────────────────────

class _WaitingRoomView extends StatelessWidget {
  final DateRoom? room;
  final AnimationController heartCtrl;
  final VoidCallback onCancel;

  const _WaitingRoomView({
    super.key,
    required this.room,
    required this.heartCtrl,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Animated hearts
          SizedBox(
            height: 120,
            child: AnimatedBuilder(
              animation: heartCtrl,
              builder: (_, __) {
                return CustomPaint(
                  size: const Size(200, 120),
                  painter: _FloatingHeartsPainter(heartCtrl.value),
                );
              },
            ),
          ),
          const SizedBox(height: 24),
          const Text('等待对方加入...', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text(
            '把邀请码分享给你想约会的人',
            style: TextStyle(color: AppTheme.textSecondary),
          ),
          if (room?.inviteCode != null) ...[
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: room!.inviteCode!));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('邀请码已复制 ✓')),
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4), width: 1.5),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      room!.inviteCode!,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 6,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(Icons.copy_rounded, color: AppTheme.primary, size: 20),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '点击复制邀请码',
              style: TextStyle(color: AppTheme.textHint, fontSize: 12),
            ),
          ],
          const SizedBox(height: 36),
          Text(
            '约会时长：${room?.durationMinutes ?? '-'} 分钟',
            style: TextStyle(color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 32),
          OutlinedButton(
            onPressed: onCancel,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.redAccent,
              side: const BorderSide(color: Colors.redAccent),
            ),
            child: const Text('取消房间'),
          ),
        ],
      ),
    );
  }
}

class _FloatingHeartsPainter extends CustomPainter {
  final double t;
  _FloatingHeartsPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final positions = [
      (0.2, 0.0, 0.9),
      (0.5, 0.3, 1.0),
      (0.8, 0.1, 0.7),
      (0.35, 0.5, 0.6),
      (0.65, 0.6, 0.8),
    ];
    for (final (x, offset, speed) in positions) {
      final progress = ((t * speed + offset) % 1.0);
      final y = 1.0 - progress;
      final opacity = (sin(progress * pi) * 0.9).clamp(0.0, 1.0);
      final paint = Paint()
        ..color = AppTheme.primary.withValues(alpha: opacity)
        ..style = PaintingStyle.fill;
      _drawHeart(canvas, paint, Offset(x * size.width, y * size.height), 10 + progress * 6);
    }
  }

  void _drawHeart(Canvas canvas, Paint paint, Offset center, double size) {
    final path = Path();
    path.moveTo(center.dx, center.dy + size * 0.3);
    path.cubicTo(
      center.dx - size * 0.8, center.dy - size * 0.4,
      center.dx - size * 1.6, center.dy + size * 0.4,
      center.dx, center.dy + size * 1.2,
    );
    path.cubicTo(
      center.dx + size * 1.6, center.dy + size * 0.4,
      center.dx + size * 0.8, center.dy - size * 0.4,
      center.dx, center.dy + size * 0.3,
    );
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_FloatingHeartsPainter old) => old.t != t;
}

// ── Phase 2: Active room ──────────────────────────────────────────────────────

class _ActiveRoomView extends StatelessWidget {
  final DateRoom room;
  final Duration remaining;
  final VoidCallback onEnd;

  const _ActiveRoomView({
    super.key,
    required this.room,
    required this.remaining,
    required this.onEnd,
  });

  @override
  Widget build(BuildContext context) {
    final minutes = remaining.inMinutes.toString().padLeft(2, '0');
    final seconds = (remaining.inSeconds % 60).toString().padLeft(2, '0');
    final progress = remaining.inSeconds / (room.durationMinutes * 60);

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 16),
          // Timer ring
          SizedBox(
            width: 180,
            height: 180,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox.expand(
                  child: CircularProgressIndicator(
                    value: progress.clamp(0.0, 1.0),
                    strokeWidth: 6,
                    backgroundColor: AppTheme.card,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      remaining.inMinutes < 3 ? Colors.redAccent : AppTheme.primary,
                    ),
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '$minutes:$seconds',
                      style: TextStyle(
                        fontSize: 38,
                        fontWeight: FontWeight.w800,
                        color: remaining.inMinutes < 3 ? Colors.redAccent : AppTheme.textPrimary,
                      ),
                    ),
                    Text('剩余时间', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 40),

          // Participants
          Row(
            children: [
              Expanded(child: _ParticipantAvatar(user: room.host, label: '主人')),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    const Text('💕', style: TextStyle(fontSize: 28)),
                    Text(
                      '约会中',
                      style: TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w600, fontSize: 12),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: room.guest != null
                    ? _ParticipantAvatar(user: room.guest!, label: '嘉宾')
                    : _EmptyParticipant(),
              ),
            ],
          ),

          const Spacer(),

          // Hint
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                const Text('💡', style: TextStyle(fontSize: 18)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '建议打开聊天框或视频通话，享受你们的约会时光 ✨',
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 13, height: 1.4),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),
        ],
      ),
    );
  }
}

class _ParticipantAvatar extends StatelessWidget {
  final DateRoomUser user;
  final String label;
  const _ParticipantAvatar({required this.user, required this.label});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.primary, width: 2.5),
          ),
          child: ClipOval(
            child: user.avatarUrl != null
                ? CachedNetworkImage(
                    imageUrl: user.avatarUrl!,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => _defaultAvatar(user.nickname),
                  )
                : _defaultAvatar(user.nickname),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              user.nickname,
              style: const TextStyle(fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis,
            ),
            if (user.isVerified) ...[
              const SizedBox(width: 4),
              const Icon(Icons.verified_rounded, size: 14, color: Color(0xFF1976D2)),
            ],
          ],
        ),
        Text(label, style: TextStyle(fontSize: 11, color: AppTheme.textHint)),
      ],
    );
  }

  Widget _defaultAvatar(String nickname) {
    return Container(
      color: AppTheme.card,
      child: Center(
        child: Text(
          nickname.isNotEmpty ? nickname[0].toUpperCase() : '?',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppTheme.primary),
        ),
      ),
    );
  }
}

class _EmptyParticipant extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: AppTheme.textHint, width: 2, style: BorderStyle.solid),
            color: AppTheme.card,
          ),
          child: Icon(Icons.person_add_rounded, color: AppTheme.textHint, size: 32),
        ),
        const SizedBox(height: 8),
        Text('等待加入...', style: TextStyle(color: AppTheme.textHint, fontSize: 13)),
        Text('嘉宾', style: TextStyle(fontSize: 11, color: AppTheme.textHint)),
      ],
    );
  }
}
