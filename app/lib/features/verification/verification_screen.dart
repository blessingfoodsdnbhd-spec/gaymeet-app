import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../config/theme.dart';
import '../../core/providers/verification_provider.dart';

class VerificationScreen extends ConsumerStatefulWidget {
  const VerificationScreen({super.key});

  @override
  ConsumerState<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends ConsumerState<VerificationScreen> {
  int _step = 0; // 0=intro, 1=pose, 2=camera, 3=preview, 4=loading, 5=success
  String? _pose;
  File? _selfie;

  @override
  void initState() {
    super.initState();
    _loadPose();
  }

  Future<void> _loadPose() async {
    final pose = await ref.read(verificationProvider.notifier).fetchPose();
    if (mounted) setState(() => _pose = pose);
  }

  Future<void> _takeSelfie() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 85,
    );
    if (picked != null && mounted) {
      setState(() {
        _selfie = File(picked.path);
        _step = 3; // preview
      });
    }
  }

  Future<void> _submit() async {
    if (_selfie == null) return;
    setState(() => _step = 4); // loading
    final ok = await ref.read(verificationProvider.notifier).submit(_selfie!);
    if (!mounted) return;
    if (ok) {
      setState(() => _step = 5); // success
      // After 3s backend auto-approves — stay on success screen
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
      appBar: AppBar(title: const Text('真人认证')),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: _buildStep(),
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case 0:
        return _IntroStep(onNext: () => setState(() => _step = 1));
      case 1:
        return _PoseStep(
          pose: _pose,
          onNext: () => setState(() => _step = 2),
        );
      case 2:
        return _CameraStep(onTake: _takeSelfie);
      case 3:
        return _PreviewStep(
          selfie: _selfie!,
          onRetake: () => setState(() => _step = 2),
          onSubmit: _submit,
        );
      case 4:
        return _LoadingStep();
      case 5:
        return _SuccessStep(onDone: () => Navigator.of(context).pop());
      default:
        return const SizedBox.shrink();
    }
  }
}

// ── Step widgets ──────────────────────────────────────────────────────────────

class _IntroStep extends StatelessWidget {
  final VoidCallback onNext;
  const _IntroStep({required this.onNext});

  @override
  Widget build(BuildContext context) {
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
              color: AppTheme.primary.withOpacity(0.12),
            ),
            child: Icon(Icons.verified_user_rounded,
                size: 52, color: AppTheme.primary),
          ),
          const SizedBox(height: 24),
          const Text('真人认证',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          Text(
            '完成认证后，你的主页将显示蓝色认证徽章，让其他用户知道你是真实用户。',
            textAlign: TextAlign.center,
            style: TextStyle(
                fontSize: 14, color: AppTheme.textSecondary, height: 1.6),
          ),
          const SizedBox(height: 8),
          Text(
            '认证流程：摆出指定手势 → 拍摄自拍 → 提交审核',
            textAlign: TextAlign.center,
            style:
                TextStyle(fontSize: 13, color: AppTheme.textHint, height: 1.5),
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

class _PoseStep extends StatelessWidget {
  final String? pose;
  final VoidCallback onNext;
  const _PoseStep({required this.pose, required this.onNext});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('请做出以下手势',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 32),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(20),
              border:
                  Border.all(color: AppTheme.primary.withOpacity(0.4), width: 2),
            ),
            child: Text(
              pose ?? '加载中...',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            '拍照时请确保手势清晰可见，光线充足',
            textAlign: TextAlign.center,
            style:
                TextStyle(fontSize: 13, color: AppTheme.textHint),
          ),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: pose != null ? onNext : null,
              child: const Text('我已准备好，去拍照'),
            ),
          ),
        ],
      ),
    );
  }
}

class _CameraStep extends StatelessWidget {
  final VoidCallback onTake;
  const _CameraStep({required this.onTake});

  @override
  Widget build(BuildContext context) {
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
                    color: AppTheme.primary.withOpacity(0.3), width: 3),
              ),
              child: Icon(Icons.camera_front_rounded,
                  size: 64, color: AppTheme.textHint),
            ),
            const SizedBox(height: 28),
            const Text('请自拍并做出手势',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(
              '请使用前置摄像头，确保面部和手势都在画面中',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 36),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onTake,
                icon: const Icon(Icons.camera_alt_rounded, size: 18),
                label: const Text('拍摄自拍'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PreviewStep extends StatelessWidget {
  final File selfie;
  final VoidCallback onRetake;
  final VoidCallback onSubmit;
  const _PreviewStep(
      {required this.selfie,
      required this.onRetake,
      required this.onSubmit});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Image.file(selfie, fit: BoxFit.cover,
                  width: double.infinity),
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(
              24, 0, 24, MediaQuery.of(context).padding.bottom + 16),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onRetake,
                  child: const Text('重新拍摄'),
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

class _LoadingStep extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 64,
            height: 64,
            child: CircularProgressIndicator(
                strokeWidth: 3, color: AppTheme.primary),
          ),
          const SizedBox(height: 24),
          const Text('正在审核中...',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(
            '请稍候，通常只需几秒钟',
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _SuccessStep extends StatelessWidget {
  final VoidCallback onDone;
  const _SuccessStep({required this.onDone});

  @override
  Widget build(BuildContext context) {
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
                color: const Color(0xFF1565C0).withOpacity(0.12),
              ),
              child: const Icon(Icons.verified_rounded,
                  size: 56, color: Color(0xFF1976D2)),
            ),
            const SizedBox(height: 24),
            const Text('认证成功！',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            Text(
              '你的主页现在显示蓝色认证徽章，其他用户知道你是真实用户。',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 14,
                  color: AppTheme.textSecondary,
                  height: 1.6),
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
