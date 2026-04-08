import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/call_provider.dart';
import 'active_call_screen.dart';

class IncomingCallScreen extends ConsumerStatefulWidget {
  const IncomingCallScreen({super.key});

  @override
  ConsumerState<IncomingCallScreen> createState() =>
      _IncomingCallScreenState();
}

class _IncomingCallScreenState extends ConsumerState<IncomingCallScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _pulseAnim = Tween(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final call = ref.watch(callProvider);
    final isVideo = call.callType == 'video';

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D0D),
      body: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Spacer(),

            // Type label
            Text(
              isVideo ? '视频通话' : '语音通话',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 16),

            // Pulsing avatar
            ScaleTransition(
              scale: _pulseAnim,
              child: Container(
                width: 130,
                height: 130,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: AppTheme.primary.withOpacity(0.5), width: 4),
                ),
                child: ClipOval(
                  child: call.remoteUserAvatar != null
                      ? CachedNetworkImage(
                          imageUrl: call.remoteUserAvatar!,
                          fit: BoxFit.cover)
                      : Container(
                          color: AppTheme.card,
                          child: const Icon(Icons.person_rounded,
                              size: 60, color: Color(0xFF3A3A3A)),
                        ),
                ),
              ),
            ),
            const SizedBox(height: 24),

            Text(
              call.remoteUserName ?? '来电',
              style: const TextStyle(
                  fontSize: 28, fontWeight: FontWeight.w700, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              '邀请你进行${isVideo ? "视频" : "语音"}通话',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
            ),

            const Spacer(),

            // Action buttons
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 60, vertical: 40),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Decline
                  Column(
                    children: [
                      GestureDetector(
                        onTap: () {
                          ref.read(callProvider.notifier).declineCall();
                          Navigator.of(context).pop();
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
                      const SizedBox(height: 10),
                      Text('拒绝',
                          style: TextStyle(
                              color: AppTheme.textSecondary, fontSize: 13)),
                    ],
                  ),

                  // Accept
                  Column(
                    children: [
                      GestureDetector(
                        onTap: () {
                          ref.read(callProvider.notifier).acceptCall();
                          Navigator.of(context).pushReplacement(
                            MaterialPageRoute(
                              builder: (_) => const ActiveCallScreen(),
                            ),
                          );
                        },
                        child: Container(
                          width: 72,
                          height: 72,
                          decoration: const BoxDecoration(
                            color: Color(0xFF4CAF50),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.call_rounded,
                            color: Colors.white,
                            size: 32,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text('接听',
                          style: TextStyle(
                              color: AppTheme.textSecondary, fontSize: 13)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
