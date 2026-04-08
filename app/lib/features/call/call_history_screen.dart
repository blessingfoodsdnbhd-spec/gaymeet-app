import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../config/theme.dart';
import '../../core/models/call_log.dart';
import '../../core/providers/call_provider.dart';

class CallHistoryScreen extends ConsumerStatefulWidget {
  const CallHistoryScreen({super.key});

  @override
  ConsumerState<CallHistoryScreen> createState() => _CallHistoryScreenState();
}

class _CallHistoryScreenState extends ConsumerState<CallHistoryScreen> {
  List<CallLog> _logs = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    final logs = await ref.read(callProvider.notifier).getHistory();
    if (mounted) setState(() { _logs = logs; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('通话记录')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _logs.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.call_outlined,
                          size: 52, color: AppTheme.textHint),
                      const SizedBox(height: 12),
                      Text('暂无通话记录',
                          style: TextStyle(
                              color: AppTheme.textSecondary, fontSize: 15)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  color: AppTheme.primary,
                  onRefresh: _fetch,
                  child: ListView.builder(
                    itemCount: _logs.length,
                    itemBuilder: (_, i) => _CallTile(
                      log: _logs[i],
                      onCallBack: (log) =>
                          ref.read(callProvider.notifier).initiateCall(
                                log.otherUser.id,
                                log.otherUser.nickname,
                                log.otherUser.avatarUrl,
                                log.type,
                              ),
                    ),
                  ),
                ),
    );
  }
}

class _CallTile extends StatelessWidget {
  final CallLog log;
  final void Function(CallLog) onCallBack;
  const _CallTile({required this.log, required this.onCallBack});

  @override
  Widget build(BuildContext context) {
    final isMissed = log.isMissed;
    final timeStr = _timeStr(log.createdAt);

    return ListTile(
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: Container(
        width: 44,
        height: 44,
        decoration: const BoxDecoration(shape: BoxShape.circle),
        clipBehavior: Clip.antiAlias,
        child: log.otherUser.avatarUrl != null
            ? CachedNetworkImage(
                imageUrl: log.otherUser.avatarUrl!, fit: BoxFit.cover)
            : Container(
                color: AppTheme.card,
                child: const Icon(Icons.person_rounded,
                    color: Color(0xFF3A3A3A), size: 22)),
      ),
      title: Text(
        log.otherUser.nickname,
        style: TextStyle(
          fontWeight: FontWeight.w600,
          color: isMissed ? Colors.red : null,
        ),
      ),
      subtitle: Row(
        children: [
          Icon(
            log.isOutgoing
                ? Icons.call_made_rounded
                : Icons.call_received_rounded,
            size: 13,
            color: isMissed ? Colors.red : AppTheme.textHint,
          ),
          const SizedBox(width: 4),
          Text(
            isMissed ? '未接' : (log.durationLabel.isEmpty ? log.status : log.durationLabel),
            style: TextStyle(
                color: isMissed ? Colors.red : AppTheme.textSecondary,
                fontSize: 12),
          ),
          const SizedBox(width: 8),
          Text(
            log.isVideo ? '📹' : '📞',
            style: const TextStyle(fontSize: 12),
          ),
        ],
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(timeStr,
              style: TextStyle(color: AppTheme.textHint, fontSize: 11)),
          const SizedBox(height: 4),
          GestureDetector(
            onTap: () => onCallBack(log),
            child: Icon(
              log.isVideo
                  ? Icons.videocam_rounded
                  : Icons.call_rounded,
              color: AppTheme.primary,
              size: 20,
            ),
          ),
        ],
      ),
    );
  }

  String _timeStr(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    if (diff.inDays < 7) return '${diff.inDays}天前';
    return DateFormat('M/d').format(dt);
  }
}
