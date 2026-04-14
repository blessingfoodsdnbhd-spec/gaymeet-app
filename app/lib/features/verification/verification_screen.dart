import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../config/theme.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/subscription_provider.dart';
import '../../core/providers/verification_provider.dart';

class VerificationScreen extends ConsumerStatefulWidget {
  const VerificationScreen({super.key});

  @override
  ConsumerState<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends ConsumerState<VerificationScreen> {
  // -1 = type select, 0=intro, 1=pose/phrase, 2=camera, 3=preview, 4=loading, 5=success
  int _step = -1;
  String _verType = 'photo'; // 'photo' | 'video'
  String? _pose;
  String? _phrase;
  File? _media; // selfie or video

  @override
  void initState() {
    super.initState();
    _loadPose();
  }

  Future<void> _loadPose() async {
    final pose = await ref.read(verificationProvider.notifier).fetchPose();
    final phrase = await ref.read(verificationProvider.notifier).fetchPhrase();
    if (mounted) setState(() { _pose = pose; _phrase = phrase; });
  }

  void _selectType(String type) {
    if (type == 'video') {
      final sub = ref.read(subscriptionProvider);
      if (!sub.isPremium) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('视频认证需要会员权限 ✨'),
            action: SnackBarAction(
              label: '升级',
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
        );
        return;
      }
    }
    setState(() { _verType = type; _step = 0; });
  }

  Future<void> _captureMedia() async {
    final picker = ImagePicker();
    if (_verType == 'photo') {
      final picked = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 85,
      );
      if (picked != null && mounted) {
        setState(() { _media = File(picked.path); _step = 3; });
      }
    } else {
      final picked = await picker.pickVideo(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        maxDuration: const Duration(seconds: 10),
      );
      if (picked != null && mounted) {
        setState(() { _media = File(picked.path); _step = 3; });
      }
    }
  }

  Future<void> _submit() async {
    if (_media == null) return;
    setState(() => _step = 4);
    bool ok;
    if (_verType == 'photo') {
      ok = await ref.read(verificationProvider.notifier).submit(_media!);
    } else {
      ok = await ref.read(verificationProvider.notifier).submitVideo(_media!);
    }
    if (!mounted) return;
    if (ok) {
      setState(() => _step = 5);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('提交失败，请重试')),
      );
      setState(() => _step = 2);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('真人认证'),
        leading: _step > -1
            ? IconButton(
                icon: const Icon(Icons.arrow_back_ios_rounded),
                onPressed: () => setState(() => _step = _step - 1 < -1 ? -1 : _step - 1),
              )
            : null,
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: _buildStep(),
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case -1:
        return _TypeSelectStep(
          onSelect: _selectType,
        );
      case 0:
        return _IntroStep(
          verType: _verType,
          onNext: () => setState(() => _step = 1),
        );
      case 1:
        return _ChallengeStep(
          verType: _verType,
          pose: _pose,
          phrase: _phrase,
          onNext: () => setState(() => _step = 2),
        );
      case 2:
        return _CaptureStep(verType: _verType, onCapture: _captureMedia);
      case 3:
        return _PreviewStep(
          verType: _verType,
          media: _media!,
          onRetake: () => setState(() => _step = 2),
          onSubmit: _submit,
        );
      case 4:
        return _LoadingStep(verType: _verType);
      case 5:
        return _SuccessStep(
          verType: _verType,
          onDone: () => Navigator.of(context).pop(),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}

// ── Type selection ─────────────────────────────────────────────────────────────

class _TypeSelectStep extends ConsumerWidget {
  final ValueChanged<String> onSelect;
  const _TypeSelectStep({required this.onSelect});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sub = ref.watch(subscriptionProvider);

    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppTheme.primary.withValues(alpha: 0.12),
            ),
            child: Icon(Icons.verified_user_rounded, size: 42, color: AppTheme.primary),
          ),
          const SizedBox(height: 24),
          const Text('选择认证方式',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text(
            '完成认证后获得专属徽章，让其他用户知道你是真实用户',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textSecondary, height: 1.5),
          ),
          const SizedBox(height: 36),

          // Photo option
          _TypeCard(
            emoji: '📷',
            title: '照片认证',
            subtitle: '摆手势拍自拍，获得蓝色认证徽章',
            badgeColor: const Color(0xFF1976D2),
            badgeLabel: '蓝色徽章',
            isLocked: false,
            onTap: () => onSelect('photo'),
          ),

          const SizedBox(height: 14),

          // Video option
          _TypeCard(
            emoji: '🎥',
            title: '视频认证',
            subtitle: '录制一段说出指定词语的视频，获得金色认证徽章',
            badgeColor: const Color(0xFFFFAB00),
            badgeLabel: '金色徽章',
            isLocked: !sub.isPremium,
            onTap: () => onSelect('video'),
          ),
        ],
      ),
    );
  }
}

class _TypeCard extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  final Color badgeColor;
  final String badgeLabel;
  final bool isLocked;
  final VoidCallback onTap;

  const _TypeCard({
    required this.emoji,
    required this.title,
    required this.subtitle,
    required this.badgeColor,
    required this.badgeLabel,
    required this.isLocked,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: badgeColor.withValues(alpha: 0.3), width: 1.5),
        ),
        child: Row(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 32)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: badgeColor,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(badgeLabel,
                            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(subtitle, style: TextStyle(color: AppTheme.textSecondary, fontSize: 12, height: 1.4)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (isLocked)
              Icon(Icons.lock_rounded, color: AppTheme.textHint, size: 20)
            else
              Icon(Icons.chevron_right_rounded, color: AppTheme.textSecondary),
          ],
        ),
      ),
    );
  }
}

// ── Intro ─────────────────────────────────────────────────────────────────────

class _IntroStep extends StatelessWidget {
  final String verType;
  final VoidCallback onNext;
  const _IntroStep({required this.verType, required this.onNext});

  @override
  Widget build(BuildContext context) {
    final isVideo = verType == 'video';
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: (isVideo ? const Color(0xFFFFAB00) : const Color(0xFF1976D2)).withValues(alpha: 0.12),
            ),
            child: Icon(
              isVideo ? Icons.video_camera_front_rounded : Icons.verified_user_rounded,
              size: 52,
              color: isVideo ? const Color(0xFFFFAB00) : AppTheme.primary,
            ),
          ),
          const SizedBox(height: 24),
          Text(isVideo ? '视频认证' : '照片认证',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          Text(
            isVideo
                ? '录制一段短视频，说出指定词语，通过审核后获得金色认证徽章 ✨'
                : '摆出指定手势并拍摄自拍，通过审核后获得蓝色认证徽章 💙',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: AppTheme.textSecondary, height: 1.6),
          ),
          const SizedBox(height: 8),
          Text(
            isVideo
                ? '流程：查看词语 → 录制视频（最多10秒）→ 提交审核'
                : '流程：摆出手势 → 拍摄自拍 → 提交审核',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppTheme.textHint, height: 1.5),
          ),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onNext,
              child: const Text('开始认证'),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Challenge (pose or phrase) ────────────────────────────────────────────────

class _ChallengeStep extends StatelessWidget {
  final String verType;
  final String? pose;
  final String? phrase;
  final VoidCallback onNext;
  const _ChallengeStep({
    required this.verType,
    required this.pose,
    required this.phrase,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    final isVideo = verType == 'video';
    final challenge = isVideo ? phrase : pose;
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(isVideo ? '请在视频中说出以下词语' : '请做出以下手势',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 32),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: (isVideo ? const Color(0xFFFFAB00) : AppTheme.primary).withValues(alpha: 0.4),
                width: 2,
              ),
            ),
            child: Text(
              challenge ?? '加载中...',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            isVideo
                ? '录制时请清晰说出以上词语，面部要在画面中'
                : '拍照时请确保手势清晰可见，光线充足',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: AppTheme.textHint),
          ),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: challenge != null ? onNext : null,
              child: Text(isVideo ? '我已准备好，去录制' : '我已准备好，去拍照'),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Capture ───────────────────────────────────────────────────────────────────

class _CaptureStep extends StatelessWidget {
  final String verType;
  final VoidCallback onCapture;
  const _CaptureStep({required this.verType, required this.onCapture});

  @override
  Widget build(BuildContext context) {
    final isVideo = verType == 'video';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppTheme.card,
                border: Border.all(
                  color: (isVideo ? const Color(0xFFFFAB00) : AppTheme.primary).withValues(alpha: 0.3),
                  width: 3,
                ),
              ),
              child: Icon(
                isVideo ? Icons.videocam_rounded : Icons.camera_front_rounded,
                size: 64,
                color: AppTheme.textHint,
              ),
            ),
            const SizedBox(height: 28),
            Text(isVideo ? '录制认证视频' : '请自拍并做出手势',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(
              isVideo
                  ? '使用前置摄像头录制，最长10秒，清晰说出指定词语'
                  : '请使用前置摄像头，确保面部和手势都在画面中',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 36),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onCapture,
                icon: Icon(isVideo ? Icons.fiber_manual_record_rounded : Icons.camera_alt_rounded, size: 18),
                label: Text(isVideo ? '开始录制' : '拍摄自拍'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Preview ───────────────────────────────────────────────────────────────────

class _PreviewStep extends StatelessWidget {
  final String verType;
  final File media;
  final VoidCallback onRetake;
  final VoidCallback onSubmit;
  const _PreviewStep({
    required this.verType,
    required this.media,
    required this.onRetake,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final isVideo = verType == 'video';
    return Column(
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: isVideo
                  ? Container(
                      color: Colors.black,
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.videocam_rounded, color: Colors.white54, size: 64),
                            const SizedBox(height: 12),
                            Text('视频已录制', style: TextStyle(color: Colors.white70)),
                            Text(media.path.split('/').last,
                                style: TextStyle(color: Colors.white38, fontSize: 12)),
                          ],
                        ),
                      ),
                    )
                  : Image.file(media, fit: BoxFit.cover, width: double.infinity),
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(24, 0, 24, MediaQuery.of(context).padding.bottom + 16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onRetake,
                  child: Text(isVideo ? '重新录制' : '重新拍摄'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: onSubmit,
                  child: const Text('提交认证'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Loading ───────────────────────────────────────────────────────────────────

class _LoadingStep extends StatelessWidget {
  final String verType;
  const _LoadingStep({required this.verType});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 64,
            height: 64,
            child: CircularProgressIndicator(strokeWidth: 3, color: AppTheme.primary),
          ),
          const SizedBox(height: 24),
          const Text('正在审核中...', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(
            verType == 'video' ? '视频审核通常需要5秒' : '请稍候，通常只需几秒钟',
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

// ── Success ───────────────────────────────────────────────────────────────────

class _SuccessStep extends StatelessWidget {
  final String verType;
  final VoidCallback onDone;
  const _SuccessStep({required this.verType, required this.onDone});

  @override
  Widget build(BuildContext context) {
    final isVideo = verType == 'video';
    final badgeColor = isVideo ? const Color(0xFFFFAB00) : const Color(0xFF1976D2);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: badgeColor.withValues(alpha: 0.12),
              ),
              child: Icon(Icons.verified_rounded, size: 56, color: badgeColor),
            ),
            const SizedBox(height: 24),
            const Text('认证成功！', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            Text(
              isVideo
                  ? '你的主页现在显示金色认证徽章，代表你已完成视频实名认证 ✨'
                  : '你的主页现在显示蓝色认证徽章，其他用户知道你是真实用户 💙',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: AppTheme.textSecondary, height: 1.6),
            ),
            const SizedBox(height: 40),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onDone,
                child: const Text('完成'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
