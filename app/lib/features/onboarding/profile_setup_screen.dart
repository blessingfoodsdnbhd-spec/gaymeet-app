import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../config/theme.dart';
import '../../core/api/photo_service.dart';
import '../../core/providers/auth_provider.dart';
import '../../shared/widgets/gradient_button.dart';

class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _bioC = TextEditingController();
  final _selectedTags = <String>{};
  int _step = 0; // 0 = photo, 1 = bio, 2 = tags

  XFile? _pickedPhoto;
  bool _uploadingPhoto = false;
  bool _saving = false;

  static const _availableTags = [
    'Travel', 'Fitness', 'Music', 'Coffee', 'Dogs', 'Cats',
    'Gaming', 'Photography', 'Cooking', 'Hiking', 'Movies',
    'Art', 'Tech', 'Yoga', 'Nightlife', 'Books', 'Wine',
    'Beach', 'Running', 'Dance',
  ];

  @override
  void dispose() {
    _bioC.dispose();
    super.dispose();
  }

  // ── Photo picking ──────────────────────────────────────────────────────────

  Future<void> _showPickerSheet() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 20),
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_rounded),
              title: const Text('Take a photo'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (source == null) return;

    final file = await ref
        .read(photoServiceProvider)
        .pickImage(fromCamera: source == ImageSource.camera);
    if (file != null && mounted) {
      setState(() => _pickedPhoto = file);
    }
  }

  // ── Step navigation ────────────────────────────────────────────────────────

  Future<void> _continueFromPhotoStep() async {
    if (_pickedPhoto == null) {
      // No photo chosen — skip upload and advance
      setState(() => _step++);
      return;
    }

    setState(() => _uploadingPhoto = true);
    try {
      final url = await ref.read(photoServiceProvider).uploadPhoto(_pickedPhoto!);
      // Update local state optimistically so the profile reflects the photo
      final current = ref.read(authStateProvider).user;
      if (current != null) {
        final updatedPhotos = [url, ...current.photos];
        ref.read(authStateProvider.notifier).updatePhotos(updatedPhotos);
      }
    } catch (_) {
      // Upload failed — still advance; user can add photos in edit profile
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Photo upload failed. You can add one later.')),
        );
      }
    } finally {
      if (mounted) setState(() {
        _uploadingPhoto = false;
        _step++;
      });
    }
  }

  Future<void> _finish() async {
    setState(() => _saving = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.patch('/users/me', data: {
        'bio': _bioC.text.trim(),
        'tags': _selectedTags.toList(),
      });
      await ref.read(authStateProvider.notifier).checkAuth();
      if (mounted) context.go('/home');
    } catch (_) {
      // If API fails (e.g., dummy mode), still navigate
      if (mounted) context.go('/home');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isBusy = _saving || _uploadingPhoto;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Progress bar
              Row(
                children: List.generate(3, (i) {
                  return Expanded(
                    child: Container(
                      height: 3,
                      margin: EdgeInsets.only(right: i < 2 ? 6 : 0),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        color: i <= _step ? AppTheme.primary : AppTheme.card,
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: isBusy ? null : () => context.go('/home'),
                  child: Text('Skip',
                      style: TextStyle(color: AppTheme.textHint, fontSize: 14)),
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: _step == 0
                      ? _buildPhotoStep()
                      : _step == 1
                          ? _buildBioStep()
                          : _buildTagsStep(),
                ),
              ),
              const SizedBox(height: 16),
              // Navigation
              Row(
                children: [
                  if (_step > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: isBusy ? null : () => setState(() => _step--),
                        child: const Text('Back'),
                      ),
                    ),
                  if (_step > 0) const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: GradientButton(
                      text: _step < 2 ? 'Continue' : 'Get Started',
                      isLoading: isBusy,
                      onPressed: () {
                        if (_step == 0) {
                          _continueFromPhotoStep();
                        } else if (_step < 2) {
                          setState(() => _step++);
                        } else {
                          _finish();
                        }
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Step widgets ───────────────────────────────────────────────────────────

  Widget _buildPhotoStep() {
    return Column(
      key: const ValueKey('photo'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Add a photo',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          'Profiles with photos get 10x more matches.',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 15),
        ),
        const SizedBox(height: 40),
        Center(
          child: GestureDetector(
            onTap: _uploadingPhoto ? null : _showPickerSheet,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 180,
                  height: 180,
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: _pickedPhoto != null
                          ? AppTheme.primary
                          : AppTheme.primary.withValues(alpha: 0.3),
                      width: 2,
                      strokeAlign: BorderSide.strokeAlignOutside,
                    ),
                  ),
                  child: ClipOval(
                    child: _pickedPhoto != null
                        ? Image.file(
                            File(_pickedPhoto!.path),
                            fit: BoxFit.cover,
                          )
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  gradient: AppTheme.brandGradient,
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: const Icon(Icons.camera_alt_rounded,
                                    color: Colors.white, size: 24),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'Tap to upload',
                                style: TextStyle(
                                    color: AppTheme.textSecondary,
                                    fontSize: 13),
                              ),
                            ],
                          ),
                  ),
                ),
                // Edit badge shown when a photo is already chosen
                if (_pickedPhoto != null)
                  Positioned(
                    bottom: 4,
                    right: 4,
                    child: Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        gradient: AppTheme.brandGradient,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: AppTheme.bg, width: 2),
                      ),
                      child: const Icon(Icons.edit_rounded,
                          color: Colors.white, size: 16),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (_pickedPhoto != null) ...[
          const SizedBox(height: 24),
          Center(
            child: TextButton.icon(
              onPressed: _uploadingPhoto ? null : () => setState(() => _pickedPhoto = null),
              icon: Icon(Icons.close_rounded,
                  size: 16, color: AppTheme.textHint),
              label: Text('Remove',
                  style: TextStyle(color: AppTheme.textHint, fontSize: 13)),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildBioStep() {
    return Column(
      key: const ValueKey('bio'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'About you',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          'Write something that shows your personality.',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 15),
        ),
        const SizedBox(height: 28),
        TextField(
          controller: _bioC,
          maxLines: 5,
          maxLength: 300,
          style: const TextStyle(fontSize: 15, height: 1.5),
          decoration: InputDecoration(
            hintText:
                'e.g. Coffee addict, dog lover, always down for ramen...',
            hintStyle: TextStyle(color: AppTheme.textHint),
            counterStyle: TextStyle(color: AppTheme.textHint),
          ),
        ),
      ],
    );
  }

  Widget _buildTagsStep() {
    return SingleChildScrollView(
      key: const ValueKey('tags'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Your interests',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            'Pick at least 3 to help find your people.',
            style: TextStyle(color: AppTheme.textSecondary, fontSize: 15),
          ),
          const SizedBox(height: 28),
          Wrap(
            spacing: 8,
            runSpacing: 10,
            children: _availableTags.map((tag) {
              final selected = _selectedTags.contains(tag);
              return GestureDetector(
                onTap: () {
                  setState(() {
                    if (selected) {
                      _selectedTags.remove(tag);
                    } else {
                      _selectedTags.add(tag);
                    }
                  });
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    gradient: selected ? AppTheme.brandGradient : null,
                    color: selected ? null : AppTheme.card,
                    borderRadius: BorderRadius.circular(24),
                    border: selected
                        ? null
                        : Border.all(color: const Color(0xFF3A3A3A)),
                  ),
                  child: Text(
                    tag,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight:
                          selected ? FontWeight.w600 : FontWeight.w400,
                      color:
                          selected ? Colors.white : AppTheme.textSecondary,
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          Text(
            '${_selectedTags.length} selected',
            style: TextStyle(color: AppTheme.textHint, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
