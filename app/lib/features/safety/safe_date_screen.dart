import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/dummy/dummy_data.dart';
import '../../core/models/user.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/match_provider.dart';
import '../../core/providers/safe_date_provider.dart';
import '../../core/theme/design_system.dart';

class SafeDateScreen extends ConsumerStatefulWidget {
  const SafeDateScreen({super.key});

  @override
  ConsumerState<SafeDateScreen> createState() => _SafeDateScreenState();
}

class _SafeDateScreenState extends ConsumerState<SafeDateScreen> {
  // ── Setup fields ─────────────────────────────────────────────────────────────
  final _meetingCtrl = TextEditingController();
  final _venueCtrl = TextEditingController();
  DateTime? _expectedEndTime;
  final Set<String> _selectedContactIds = {};
  Timer? _checkinTimer;

  @override
  void dispose() {
    _meetingCtrl.dispose();
    _venueCtrl.dispose();
    _checkinTimer?.cancel();
    super.dispose();
  }

  List<UserModel> get _contacts {
    if (kUseDummyData) return DummyData.users.take(5).toList();
    final matches = ref.read(matchesProvider).valueOrNull ?? [];
    return matches.map((m) => m.user).toList();
  }

  Future<void> _startSession() async {
    if (_meetingCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('请填写约会对象')));
      return;
    }
    final ok = await ref.read(safeDateProvider.notifier).startSession(
          trustedContactIds: _selectedContactIds.toList(),
          meetingWith: _meetingCtrl.text.trim(),
          venue: _venueCtrl.text.trim(),
          expectedEndTime: _expectedEndTime,
        );
    if (!ok && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('启动失败，请重试')));
    }
  }

  Future<void> _endSession() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const Text('结束安全约会'),
        content: const Text('确定安全返家了吗？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('继续')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('结束', style: TextStyle(color: AppTheme.primary)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(safeDateProvider.notifier).endSession();
    }
  }

  Future<void> _triggerPanic() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A0000),
        title: const Row(
          children: [
            Icon(Icons.warning_rounded, color: Colors.red, size: 28),
            SizedBox(width: 8),
            Text('确认紧急求助', style: TextStyle(color: Colors.red)),
          ],
        ),
        content: const Text(
          '这将立即向你的联系人发送你的位置和紧急求助信号。确定吗？',
          style: TextStyle(height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('取消', style: TextStyle(color: AppTheme.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('确认求助',
                style: TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      final ok =
          await ref.read(safeDateProvider.notifier).triggerPanic();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: ok ? Colors.green.shade800 : Colors.red,
            content: Text(ok ? '紧急求助已发送！你的联系人已被通知' : '发送失败，请直接拨打110'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(safeDateProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('安全约会 🛡️'),
        actions: [
          if (state.isActive)
            TextButton(
              onPressed: _endSession,
              child: Text('结束约会',
                  style: TextStyle(color: AppTheme.textSecondary)),
            ),
        ],
      ),
      body: state.isLoading && !state.isActive
          ? const Center(child: CircularProgressIndicator())
          : state.isActive
              ? _ActiveSession(
                  state: state,
                  onPanic: _triggerPanic,
                  onEnd: _endSession,
                )
              : _SetupForm(
                  meetingCtrl: _meetingCtrl,
                  venueCtrl: _venueCtrl,
                  contacts: _contacts,
                  selectedContactIds: _selectedContactIds,
                  expectedEndTime: _expectedEndTime,
                  onContactToggle: (id) =>
                      setState(() => _selectedContactIds.contains(id)
                          ? _selectedContactIds.remove(id)
                          : _selectedContactIds.add(id)),
                  onTimePick: () async {
                    final t = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.now(),
                    );
                    if (t != null) {
                      final now = DateTime.now();
                      setState(() => _expectedEndTime = DateTime(
                          now.year, now.month, now.day, t.hour, t.minute));
                    }
                  },
                  onStart: state.isLoading ? null : _startSession,
                  isLoading: state.isLoading,
                ),
    );
  }
}

// ── Setup form ────────────────────────────────────────────────────────────────

class _SetupForm extends StatelessWidget {
  final TextEditingController meetingCtrl;
  final TextEditingController venueCtrl;
  final List<UserModel> contacts;
  final Set<String> selectedContactIds;
  final DateTime? expectedEndTime;
  final void Function(String) onContactToggle;
  final VoidCallback onTimePick;
  final VoidCallback? onStart;
  final bool isLoading;

  const _SetupForm({
    required this.meetingCtrl,
    required this.venueCtrl,
    required this.contacts,
    required this.selectedContactIds,
    required this.expectedEndTime,
    required this.onContactToggle,
    required this.onTimePick,
    required this.onStart,
    required this.isLoading,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Info banner
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.blue.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.blue.withValues(alpha: 0.3)),
          ),
          child: const Row(
            children: [
              Icon(Icons.shield_rounded, color: Colors.blue, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  '安全约会会实时分享你的位置给可信联系人，遇到危险时可一键求救',
                  style: TextStyle(fontSize: 13, height: 1.4),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),
        const _Label('约会对象 *'),
        const SizedBox(height: 8),
        TextField(
          controller: meetingCtrl,
          decoration: _inputDeco('他/她的名字或昵称'),
        ),

        const SizedBox(height: 16),
        const _Label('约会地点'),
        const SizedBox(height: 8),
        TextField(
          controller: venueCtrl,
          decoration: _inputDeco('餐厅名、地址...'),
        ),

        const SizedBox(height: 16),
        const _Label('预计返家时间'),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: onTimePick,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.access_time_rounded,
                    size: 18, color: AppTheme.textSecondary),
                const SizedBox(width: 8),
                Text(
                  expectedEndTime != null
                      ? '${expectedEndTime!.hour.toString().padLeft(2, '0')}:${expectedEndTime!.minute.toString().padLeft(2, '0')}'
                      : '选择时间（可选）',
                  style: TextStyle(
                    color: expectedEndTime != null
                        ? AppTheme.textPrimary
                        : AppTheme.textHint,
                  ),
                ),
              ],
            ),
          ),
        ),

        if (contacts.isNotEmpty) ...[
          const SizedBox(height: 20),
          const _Label('选择可信联系人（可选）'),
          const SizedBox(height: 4),
          Text(
            '他们将能接收你的位置和紧急求助',
            style: TextStyle(color: AppTheme.textHint, fontSize: 12),
          ),
          const SizedBox(height: 10),
          ...contacts.map((u) => _ContactTile(
                user: u,
                selected: selectedContactIds.contains(u.id),
                onToggle: () => onContactToggle(u.id),
              )),
        ],

        const SizedBox(height: 28),

        GestureDetector(
          onTap: onStart,
          child: Container(
            height: 54,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1565C0), Color(0xFF0D47A1)],
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.blue.withValues(alpha: 0.4),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Center(
              child: isLoading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.shield_rounded,
                            color: Colors.white, size: 20),
                        SizedBox(width: 8),
                        Text(
                          '开始安全约会',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ],
    );
  }

  static InputDecoration _inputDeco(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: AppTheme.textHint),
        filled: true,
        fillColor: AppTheme.card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      );
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      );
}

class _ContactTile extends StatelessWidget {
  final UserModel user;
  final bool selected;
  final VoidCallback onToggle;

  const _ContactTile({
    required this.user,
    required this.selected,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onToggle,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? Colors.blue.withValues(alpha: 0.12)
              : AppTheme.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? Colors.blue : Colors.white12,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundImage: user.avatarUrl != null
                  ? NetworkImage(user.avatarUrl!)
                  : null,
              backgroundColor: AppTheme.card,
              child: user.avatarUrl == null
                  ? Text(user.nickname.isNotEmpty
                      ? user.nickname[0].toUpperCase()
                      : '?')
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(user.nickname,
                  style: const TextStyle(fontWeight: FontWeight.w500)),
            ),
            Icon(
              selected ? Icons.check_circle_rounded : Icons.circle_outlined,
              color: selected ? Colors.blue : AppTheme.textHint,
              size: 22,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Active session ────────────────────────────────────────────────────────────

class _ActiveSession extends StatefulWidget {
  final SafeDateState state;
  final VoidCallback onPanic;
  final VoidCallback onEnd;

  const _ActiveSession({
    required this.state,
    required this.onPanic,
    required this.onEnd,
  });

  @override
  State<_ActiveSession> createState() => _ActiveSessionState();
}

class _ActiveSessionState extends State<_ActiveSession>
    with SingleTickerProviderStateMixin {
  late AnimationController _panicPulse;
  late Animation<double> _panicScale;
  late Timer _timer;
  Duration _elapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _panicPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
    _panicScale =
        Tween(begin: 0.96, end: 1.04).animate(_panicPulse);

    final startedAt = widget.state.session?.startedAt ?? DateTime.now();
    _elapsed = DateTime.now().difference(startedAt);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() =>
            _elapsed = DateTime.now().difference(startedAt));
      }
    });
  }

  @override
  void dispose() {
    _panicPulse.dispose();
    _timer.cancel();
    super.dispose();
  }

  String get _elapsedLabel {
    final h = _elapsed.inHours;
    final m = _elapsed.inMinutes % 60;
    final s = _elapsed.inSeconds % 60;
    if (h > 0) return '${h}h ${m}m ${s}s';
    if (m > 0) return '${m}m ${s}s';
    return '${s}s';
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.state.session!;
    final alreadyPanicked = session.panicTriggered;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // Status card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0A1628), Color(0xFF0D1F3C)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.blue.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                const Icon(Icons.shield_rounded,
                    color: Colors.blue, size: 40),
                const SizedBox(height: 12),
                const Text(
                  '安全约会进行中',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(
                  '时长 $_elapsedLabel',
                  style: const TextStyle(
                      color: Colors.blue, fontSize: 14),
                ),
                if (session.meetingWith.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    '约会对象：${session.meetingWith}',
                    style: TextStyle(
                        color: AppTheme.textSecondary, fontSize: 13),
                  ),
                ],
                if (session.venue.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    '地点：${session.venue}',
                    style: TextStyle(
                        color: AppTheme.textSecondary, fontSize: 13),
                  ),
                ],
                if (session.trustedContacts.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    '已通知 ${session.trustedContacts.length} 位联系人',
                    style: const TextStyle(
                        color: Colors.green, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 32),

          // Panic status
          if (alreadyPanicked)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: Colors.red.withValues(alpha: 0.4), width: 1.5),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.warning_rounded, color: Colors.red),
                  SizedBox(width: 8),
                  Text(
                    '紧急求助已发送',
                    style: TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.w700,
                        fontSize: 15),
                  ),
                ],
              ),
            ),

          const Spacer(),

          // PANIC BUTTON — big and prominent
          if (!alreadyPanicked)
            ScaleTransition(
              scale: _panicScale,
              child: GestureDetector(
                onTap: widget.state.isPanicking ? null : widget.onPanic,
                child: Container(
                  width: double.infinity,
                  height: 80,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFD32F2F), Color(0xFFB71C1C)],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.red.withValues(alpha: 0.6),
                        blurRadius: 24,
                        spreadRadius: 4,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Center(
                    child: widget.state.isPanicking
                        ? const CircularProgressIndicator(
                            color: Colors.white)
                        : const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('🆘',
                                  style: TextStyle(fontSize: 28)),
                              SizedBox(width: 12),
                              Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '紧急求助',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 22,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                  Text(
                                    '立即通知联系人',
                                    style: TextStyle(
                                        color: Colors.white70,
                                        fontSize: 12),
                                  ),
                                ],
                              ),
                            ],
                          ),
                  ),
                ),
              ),
            ),

          const SizedBox(height: 16),

          // I'm safe + end
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: widget.onEnd,
                  icon: const Icon(Icons.check_circle_outline_rounded,
                      size: 18),
                  label: const Text('我安全了，结束'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.green,
                    side: const BorderSide(color: Colors.green),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
