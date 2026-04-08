import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/moments_provider.dart';

class CreateMomentScreen extends ConsumerStatefulWidget {
  const CreateMomentScreen({super.key});

  @override
  ConsumerState<CreateMomentScreen> createState() =>
      _CreateMomentScreenState();
}

class _CreateMomentScreenState extends ConsumerState<CreateMomentScreen> {
  final _textC = TextEditingController();
  final List<String> _images = [];
  String _visibility = 'public';
  bool _isPosting = false;

  static const _visibilityOptions = [
    ('public', '公开', Icons.public_rounded),
    ('friends', '好友', Icons.people_rounded),
    ('private', '仅自己', Icons.lock_rounded),
  ];

  @override
  void dispose() {
    _textC.dispose();
    super.dispose();
  }

  Future<void> _post() async {
    if (_textC.text.trim().isEmpty && _images.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入内容或选择图片')),
      );
      return;
    }

    setState(() => _isPosting = true);
    final ok = await ref.read(momentsProvider.notifier).createMoment(
          content: _textC.text.trim(),
          images: _images,
          visibility: _visibility,
        );
    setState(() => _isPosting = false);

    if (ok && mounted) {
      context.pop(true);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('发布失败，请重试')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final charCount = _textC.text.length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('发布动态'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _isPosting
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2)))
                : TextButton(
                    onPressed: _post,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: AppTheme.brandGradient,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text('发布',
                          style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700)),
                    ),
                  ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Text input ─────────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _textC,
                  onChanged: (_) => setState(() {}),
                  maxLines: 6,
                  minLines: 3,
                  maxLength: 500,
                  style: const TextStyle(fontSize: 15, height: 1.5),
                  decoration: InputDecoration(
                    hintText: '分享你的心情、照片、活动...',
                    hintStyle: TextStyle(color: AppTheme.textHint),
                    border: InputBorder.none,
                    counterText: '',
                  ),
                ),
                Align(
                  alignment: Alignment.bottomRight,
                  child: Text(
                    '$charCount/500',
                    style: TextStyle(
                      color: charCount > 480
                          ? AppTheme.primary
                          : AppTheme.textHint,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // ── Photo picker grid ──────────────────────────────────────────────
          _PhotoPickerGrid(
            images: _images,
            onAdd: _addPhoto,
            onRemove: (url) => setState(() => _images.remove(url)),
          ),

          const SizedBox(height: 16),

          // ── Options ────────────────────────────────────────────────────────
          Container(
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              children: [
                // Visibility
                ListTile(
                  leading: Icon(
                    _visibilityOptions
                        .firstWhere((o) => o.$1 == _visibility)
                        .$3,
                    color: AppTheme.primary,
                    size: 20,
                  ),
                  title: const Text('可见范围', style: TextStyle(fontSize: 14)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _visibilityOptions
                            .firstWhere((o) => o.$1 == _visibility)
                            .$2,
                        style: TextStyle(
                            color: AppTheme.textSecondary, fontSize: 13),
                      ),
                      const SizedBox(width: 4),
                      Icon(Icons.chevron_right_rounded,
                          color: AppTheme.textHint, size: 18),
                    ],
                  ),
                  onTap: _showVisibilityPicker,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _addPhoto() {
    // Simulated photo add (in production use image_picker)
    if (_images.length >= 9) return;
    setState(() {
      _images.add(
          'https://picsum.photos/seed/${DateTime.now().millisecond}/400/400');
    });
  }

  void _showVisibilityPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                  color: AppTheme.textHint,
                  borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          ..._visibilityOptions.map((opt) => ListTile(
                leading: Icon(opt.$3,
                    color: _visibility == opt.$1
                        ? AppTheme.primary
                        : AppTheme.textSecondary),
                title: Text(opt.$2),
                trailing: _visibility == opt.$1
                    ? Icon(Icons.check_rounded, color: AppTheme.primary)
                    : null,
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
}

// ── Photo Picker Grid ─────────────────────────────────────────────────────────

class _PhotoPickerGrid extends StatelessWidget {
  final List<String> images;
  final VoidCallback onAdd;
  final void Function(String) onRemove;

  const _PhotoPickerGrid({
    required this.images,
    required this.onAdd,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final items = [...images, if (images.length < 9) 'add'];
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
      ),
      itemCount: items.length,
      itemBuilder: (_, i) {
        if (items[i] == 'add') {
          return GestureDetector(
            onTap: onAdd,
            child: Container(
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: const Color(0xFF3A3A3A), style: BorderStyle.solid),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_photo_alternate_rounded,
                      color: AppTheme.textHint, size: 28),
                  const SizedBox(height: 4),
                  Text('${images.length}/9',
                      style: TextStyle(
                          color: AppTheme.textHint, fontSize: 11)),
                ],
              ),
            ),
          );
        }
        return Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(items[i], fit: BoxFit.cover,
                  width: double.infinity, height: double.infinity),
            ),
            Positioned(
              top: 4,
              right: 4,
              child: GestureDetector(
                onTap: () => onRemove(items[i]),
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: const BoxDecoration(
                    color: Colors.black87,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close_rounded,
                      color: Colors.white, size: 14),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
