import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../config/theme.dart';
import '../../core/api/photo_service.dart';
import '../../core/api/saw_you_service.dart';
import '../../core/providers/saw_you_provider.dart';

class ClaimPlateScreen extends ConsumerStatefulWidget {
  const ClaimPlateScreen({super.key});

  @override
  ConsumerState<ClaimPlateScreen> createState() => _ClaimPlateScreenState();
}

class _ClaimPlateScreenState extends ConsumerState<ClaimPlateScreen> {
  final _plateCtrl = TextEditingController();
  String? _uploadedCarImageUrl;
  XFile? _localImage;
  bool _uploading = false;
  bool _claiming = false;
  String? _error;
  bool _claimed = false;

  @override
  void initState() {
    super.initState();
    // Pre-fill plate if already claimed
    final existing = ref.read(claimedPlateProvider);
    if (existing != null) _plateCtrl.text = existing;
  }

  @override
  void dispose() {
    _plateCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final photoSvc = ref.read(photoServiceProvider);
    final file = await photoSvc.pickImage(fromCamera: false);
    if (file == null) return;

    setState(() {
      _localImage = file;
      _uploading = true;
    });
    try {
      final url = await photoSvc.uploadPhoto(file);
      setState(() {
        _uploadedCarImageUrl = url;
        _uploading = false;
      });
    } catch (_) {
      setState(() => _uploading = false);
    }
  }

  Future<void> _claim() async {
    final plate = _plateCtrl.text.trim();
    if (plate.length < 2) {
      setState(() => _error = 'Enter a valid plate number (min 2 characters).');
      return;
    }

    setState(() {
      _claiming = true;
      _error = null;
    });

    try {
      await ref.read(sawYouServiceProvider).claimPlate(
            plate,
            carImageUrl: _uploadedCarImageUrl,
          );
      ref.read(claimedPlateProvider.notifier).set(plate);
      // Refresh inbox
      ref.read(sawYouInboxProvider.notifier).fetch();
      setState(() {
        _claiming = false;
        _claimed = true;
      });
    } catch (e) {
      setState(() {
        _claiming = false;
        _error = e.toString().contains('claimed')
            ? 'This plate has already been claimed by another user.'
            : 'Something went wrong. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final existingPlate = ref.watch(claimedPlateProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF0D0D1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D0D1A),
        title: Text(
          existingPlate != null ? 'My Plate' : 'Claim a Plate',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Explanation
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A2E),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFF3A3A6E)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('🚗', style: TextStyle(fontSize: 28)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'What is plate claiming?',
                          style: TextStyle(
                            color: AppTheme.textPrimary,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Register your vehicle\'s license plate so people who saw you on the road can send you anonymous messages. Only you can read them.',
                          style: TextStyle(
                              color: AppTheme.textSecondary,
                              fontSize: 13,
                              height: 1.4),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Current plate (if claimed)
            if (existingPlate != null && _claimed) ...[
              _SuccessBanner(plateNumber: existingPlate),
              const SizedBox(height: 20),
              Text(
                'Update plate',
                style: TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
            ],

            // Plate input
            Text(
              'LICENSE PLATE NUMBER',
              style: TextStyle(
                color: AppTheme.textHint,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            _PlateInputField(controller: _plateCtrl),

            const SizedBox(height: 24),

            // Car photo
            Text(
              'CAR PHOTO (optional)',
              style: TextStyle(
                color: AppTheme.textHint,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            _CarPhotoSection(
              localImage: _localImage,
              uploadedUrl: _uploadedCarImageUrl,
              uploading: _uploading,
              onTap: _pickPhoto,
            ),
            const SizedBox(height: 6),
            Text(
              'Optional — helps people verify they\'re messaging the right person.',
              style: TextStyle(color: AppTheme.textHint, fontSize: 11),
            ),

            if (_error != null) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Icon(Icons.error_outline_rounded,
                      color: AppTheme.error, size: 16),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(_error!,
                        style:
                            TextStyle(color: AppTheme.error, fontSize: 13)),
                  ),
                ],
              ),
            ],

            const SizedBox(height: 28),

            SizedBox(
              width: double.infinity,
              height: 54,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF7B2FBE), Color(0xFFFF3B6F)],
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: ElevatedButton(
                  onPressed: (_claiming || _uploading) ? null : _claim,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: _claiming
                      ? const SizedBox(
                          width: 20, height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          existingPlate != null
                              ? 'Update My Plate'
                              : 'Claim This Plate',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                ),
              ),
            ),

            const SizedBox(height: 14),

            Center(
              child: Text(
                'Only you can receive and read messages sent to your plate.',
                style: TextStyle(
                    color: AppTheme.textHint, fontSize: 12),
                textAlign: TextAlign.center,
              ),
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ── Plate input ───────────────────────────────────────────────────────────────

class _PlateInputField extends StatelessWidget {
  final TextEditingController controller;
  const _PlateInputField({required this.controller});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 68,
      decoration: BoxDecoration(
        color: const Color(0xFFF5F0DC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFD4C87A), width: 2.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.35),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: TextField(
        controller: controller,
        textCapitalization: TextCapitalization.characters,
        inputFormatters: [
          FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9]')),
          LengthLimitingTextInputFormatter(10),
          _UpperCaseFormatter(),
        ],
        style: const TextStyle(
          color: Color(0xFF1A1A1A),
          fontSize: 28,
          fontWeight: FontWeight.w900,
          fontFamily: 'monospace',
          letterSpacing: 5,
        ),
        decoration: InputDecoration(
          hintText: 'WXY 1234',
          hintStyle: TextStyle(
            color: const Color(0xFF1A1A1A).withOpacity(0.3),
            fontSize: 24,
            fontWeight: FontWeight.w700,
            letterSpacing: 4,
          ),
          border: InputBorder.none,
        ),
      ),
    );
  }
}

class _UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    return newValue.copyWith(text: newValue.text.toUpperCase());
  }
}

// ── Car photo section ─────────────────────────────────────────────────────────

class _CarPhotoSection extends StatelessWidget {
  final XFile? localImage;
  final String? uploadedUrl;
  final bool uploading;
  final VoidCallback onTap;

  const _CarPhotoSection({
    this.localImage,
    this.uploadedUrl,
    required this.uploading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 140,
        width: double.infinity,
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A2E),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: uploadedUrl != null
                ? const Color(0xFF7B2FBE).withOpacity(0.5)
                : const Color(0xFF3A3A6E),
            style: uploadedUrl == null ? BorderStyle.solid : BorderStyle.solid,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: uploading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF7B2FBE)),
              )
            : uploadedUrl != null
                ? Stack(
                    fit: StackFit.expand,
                    children: [
                      CachedNetworkImage(
                        imageUrl: uploadedUrl!,
                        fit: BoxFit.cover,
                      ),
                      Positioned(
                        bottom: 8, right: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.7),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.edit_rounded,
                                  size: 12, color: Colors.white),
                              SizedBox(width: 4),
                              Text('Change',
                                  style: TextStyle(
                                      color: Colors.white, fontSize: 11)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add_photo_alternate_rounded,
                          color: const Color(0xFF7B2FBE), size: 36),
                      const SizedBox(height: 8),
                      Text(
                        'Add car photo',
                        style: TextStyle(
                            color: AppTheme.textSecondary, fontSize: 13),
                      ),
                    ],
                  ),
      ),
    );
  }
}

// ── Success banner ────────────────────────────────────────────────────────────

class _SuccessBanner extends StatelessWidget {
  final String plateNumber;
  const _SuccessBanner({required this.plateNumber});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0D2E1A),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.online.withOpacity(0.4)),
      ),
      child: Row(
        children: [
          Icon(Icons.check_circle_rounded, color: AppTheme.online, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Plate claimed!',
                  style: TextStyle(
                      color: AppTheme.online,
                      fontWeight: FontWeight.w700,
                      fontSize: 14),
                ),
                Text(
                  'Your plate $plateNumber is now active. People can send you anonymous messages.',
                  style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 12,
                      height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
