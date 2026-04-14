import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/date_rooms_provider.dart';

/// Shows a bottom sheet to join a date room by invite code,
/// or navigate to create one.
class DateRoomInviteSheet extends ConsumerStatefulWidget {
  const DateRoomInviteSheet({super.key});

  @override
  ConsumerState<DateRoomInviteSheet> createState() => _DateRoomInviteSheetState();
}

class _DateRoomInviteSheetState extends ConsumerState<DateRoomInviteSheet> {
  final _codeCtrl = TextEditingController();
  bool _isSearching = false;
  String? _error;

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  Future<void> _joinByCode() async {
    final code = _codeCtrl.text.trim().toUpperCase();
    if (code.length < 4) {
      setState(() => _error = '请输入有效邀请码');
      return;
    }
    setState(() { _isSearching = true; _error = null; });
    final room = await ref.read(dateRoomProvider.notifier).findByCode(code);
    if (!mounted) return;
    setState(() => _isSearching = false);
    if (room == null) {
      setState(() => _error = '邀请码无效或房间已结束');
      return;
    }
    // Join the room
    final joined = await ref.read(dateRoomProvider.notifier).joinRoom(room.id);
    if (!mounted) return;
    if (joined == null) {
      setState(() => _error = ref.read(dateRoomProvider).error ?? '加入失败');
      return;
    }
    Navigator.pop(context);
    context.push('/date-room');
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 40, height: 4, decoration: BoxDecoration(
            color: AppTheme.textHint, borderRadius: BorderRadius.circular(2),
          )),
          const SizedBox(height: 20),
          const Text('💑', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 12),
          const Text('加入虚拟约会',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(
            '输入对方分享的邀请码加入约会房间',
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _codeCtrl,
            textCapitalization: TextCapitalization.characters,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 6),
            maxLength: 6,
            decoration: InputDecoration(
              hintText: 'XXXXXX',
              hintStyle: TextStyle(color: AppTheme.textHint, letterSpacing: 6, fontSize: 24),
              counterText: '',
              errorText: _error,
            ),
            onChanged: (_) { if (_error != null) setState(() => _error = null); },
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isSearching ? null : _joinByCode,
              child: _isSearching
                  ? const SizedBox(width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('加入约会房间'),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () {
                Navigator.pop(context);
                context.push('/date-room');
              },
              child: const Text('创建我的约会房间'),
            ),
          ),
        ],
      ),
    );
  }
}
