import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../config/theme.dart';
import '../../core/providers/stories_provider.dart';

class CreateStoryScreen extends ConsumerStatefulWidget {
  const CreateStoryScreen({super.key});

  @override
  ConsumerState<CreateStoryScreen> createState() => _CreateStoryScreenState();
}

class _CreateStoryScreenState extends ConsumerState<CreateStoryScreen> {
  File? _selectedFile;
  final _captionCtrl = TextEditingController();
  bool _isPosting = false;
  String _visibility = 'followers';
  final _picker = ImagePicker();

  static const _visibilityOptions = [
    ('public', '公开', Icons.public_rounded),
    ('followers', '关注者', Icons.people_rounded),
    ('private', '仅自己', Icons.lock_rounded),
  ];

  @override
  void initState() {
    super.initState();
    _pickImage();
  }

  @override
  void dispose() {
    _captionCtrl.dispose();
    super.dispose();
  }

  void _showVisibilityPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A1A1A),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(
              width: 36, height: 4,
              decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          ..._visibilityOptions.map((opt) => ListTile(
                leading: Icon(opt.$3,
                    color: _visibility == opt.$1 ? AppTheme.primary : Colors.white54),
                title: Text(opt.$2, style: const TextStyle(color: Colors.white)),
                trailing: _visibility == opt.$1
                    ? Icon(Icons.check_rounded, color: AppTheme.primary) : null,
                onTap: () {
                  setState(() => _visibility = opt.$1);
                  Navigator.pop(ctx);
                },
              )),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Future<void> _pickImage() async {
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 95,      // was 85 — 85% JPEG softens edges noticeably
      maxWidth: 1440,        // enough for 3x Retina phones, stays under ~1MB
      maxHeight: 2560,
    );
    if (picked != null) {
      setState(() => _selectedFile = File(picked.path));
    } else if (mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _post() async {
    if (_selectedFile == null || _isPosting) return;
    setState(() => _isPosting = true);
    try {
      await ref.read(storiesProvider.notifier).createStory(
            file: _selectedFile!,
            caption: _captionCtrl.text.trim(),
            visibility: _visibility,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('故事已发布！24小时后消失')),
        );
        Navigator.of(context).pop(true);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('发布失败，请重试')),
        );
        setState(() => _isPosting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: _selectedFile == null
          ? const Center(child: CircularProgressIndicator())
          : Stack(
              fit: StackFit.expand,
              children: [
                // Preview image
                Image.file(_selectedFile!, fit: BoxFit.cover),

                // Gradient overlay bottom
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 220,
                  child: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [Colors.black87, Colors.transparent],
                      ),
                    ),
                  ),
                ),

                // Top bar
                Positioned(
                  top: MediaQuery.of(context).padding.top + 8,
                  left: 8,
                  right: 8,
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close_rounded,
                            color: Colors.white, size: 28),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: _pickImage,
                        icon: const Icon(Icons.photo_library_rounded,
                            color: Colors.white, size: 20),
                        label: const Text('换图',
                            style: TextStyle(color: Colors.white)),
                      ),
                    ],
                  ),
                ),

                // Caption + post button
                Positioned(
                  bottom: MediaQuery.of(context).padding.bottom + 16,
                  left: 16,
                  right: 16,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.black45,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: TextField(
                          controller: _captionCtrl,
                          maxLength: 100,
                          maxLines: 2,
                          minLines: 1,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: '添加文字说明...',
                            hintStyle: const TextStyle(color: Colors.white54),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            counterStyle:
                                const TextStyle(color: Colors.white54),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      // Visibility picker
                      GestureDetector(
                        onTap: _showVisibilityPicker,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.black45,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                _visibilityOptions.firstWhere((o) => o.$1 == _visibility).$3,
                                color: Colors.white70,
                                size: 16,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                _visibilityOptions.firstWhere((o) => o.$1 == _visibility).$2,
                                style: const TextStyle(color: Colors.white70, fontSize: 13),
                              ),
                              const SizedBox(width: 4),
                              const Icon(Icons.expand_more_rounded, color: Colors.white54, size: 16),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      GestureDetector(
                        onTap: _isPosting ? null : _post,
                        child: Container(
                          height: 52,
                          decoration: BoxDecoration(
                            gradient: _isPosting
                                ? null
                                : AppTheme.brandGradient,
                            color: _isPosting ? AppTheme.card : null,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Center(
                            child: _isPosting
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white),
                                  )
                                : const Text(
                                    '发布故事',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16,
                                    ),
                                  ),
                          ),
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
