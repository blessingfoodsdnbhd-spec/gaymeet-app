import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/call_provider.dart';

class ActiveCallScreen extends ConsumerWidget {
  const ActiveCallScreen({super.key});

  String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final call = ref.watch(callProvider);
    final isVideo = call.callType == 'video';

    // Auto-pop when call ends
    ref.listen<CallState>(callProvider, (_, next) {
      if (next.isIdle && context.mounted) {
        Navigator.of(context).pop();
      }
    });

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0D),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background: avatar blur for video, plain dark for voice
          if (call.remoteUserAvatar != null)
            Opacity(
              opacity: 0.15,
              child: CachedNetworkImage(
                imageUrl: call.remoteUserAvatar!,
                fit: BoxFit.cover,
              ),
            ),

          SafeArea(
            child: Column(
              children: [
                const Spacer(),

                // Avatar + name + timer
                Container(
                  width: 110,
                  height: 110,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                        color: AppTheme.primary.withOpacity(0.4), width: 3),
                  ),
                  child: ClipOval(
                    child: call.remoteUserAvatar != null
                        ? CachedNetworkImage(
                            imageUrl: call.remoteUserAvatar!,
                            fit: BoxFit.cover)
                        : Container(
                            color: AppTheme.card,
                            child: const Icon(Icons.person_rounded,
                                size: 52, color: Color(0xFF3A3A3A)),
                          ),
                  ),
                ),
                const SizedBox(height: 16),

                Text(
                  call.remoteUserName ?? '',
                  style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      color: Colors.white),
                ),
                const SizedBox(height: 8),

                Text(
                  call.status == CallStatus.inCall
                      ? _formatDuration(call.durationSeconds)
                      : (call.status == CallStatus.outgoingRinging
                          ? '正在呼叫...'
                          : '连接中...'),
                  style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 16,
                      fontFamily: 'monospace'),
                ),

                if (isVideo) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black38,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.videocam_rounded,
                            size: 14, color: Colors.white60),
                        SizedBox(width: 4),
                        Text('视频通话（模拟）',
                            style: TextStyle(
                                color: Colors.white60, fontSize: 12)),
                      ],
                    ),
                  ),
                ],

                const Spacer(),

                // Bottom action bar
                Container(
                  padding: EdgeInsets.fromLTRB(
                      32, 28, 32, MediaQuery.of(context).padding.bottom + 28),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.4),
                    borderRadius:
                        const BorderRadius.vertical(top: Radius.circular(32)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      // Mute
                      _ActionButton(
                        icon: call.isMuted
                            ? Icons.mic_off_rounded
                            : Icons.mic_rounded,
                        label: call.isMuted ? '已静音' : '静音',
                        active: call.isMuted,
                        onTap: () =>
                            ref.read(callProvider.notifier).toggleMute(),
                      ),

                      // End call
                      GestureDetector(
                        onTap: () {
                          ref.read(callProvider.notifier).endCall();
                        },
                        child: Container(
                          width: 72,
                          height: 72,
                          decoration: const BoxDecoration(
                            color: Colors.red,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.call_end_rounded,
                              color: Colors.white, size: 32),
                        ),
                      ),

                      // Speaker
                      _ActionButton(
                        icon: call.isSpeaker
                            ? Icons.volume_up_rounded
                            : Icons.volume_off_rounded,
                        label: '扬声器',
                        active: call.isSpeaker,
                        onTap: () =>
                            ref.read(callProvider.notifier).toggleSpeaker(),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _ActionButton(
      {required this.icon,
      required this.label,
      required this.active,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: active
                  ? AppTheme.primary.withOpacity(0.3)
                  : Colors.white.withOpacity(0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(icon,
                color: active ? AppTheme.primary : Colors.white, size: 24),
          ),
          const SizedBox(height: 6),
          Text(label,
              style:
                  const TextStyle(color: Colors.white70, fontSize: 11)),
        ],
      ),
    );
  }
}
