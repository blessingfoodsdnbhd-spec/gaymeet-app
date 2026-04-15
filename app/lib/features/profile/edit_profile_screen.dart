import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../config/theme.dart';
import '../../core/api/photo_service.dart';
import '../../core/api/private_photos_service.dart';
import '../../core/providers/auth_provider.dart';
import '../../shared/widgets/looking_for_badge.dart';
import 'looking_for_sheet.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  late TextEditingController _nicknameController;
  late TextEditingController _bioController;
  late TextEditingController _tagsController;

  // Photo grid state — mirrors the live list on the server
  late List<String> _photos;

  // Private photos
  late List<String> _privatePhotos;
  bool _privatePhotoUploading = false;
  final _privatePhotoDeleting = <String>{};

  // Track which photo slots are currently uploading/deleting
  final _loadingSlots = <int>{};
  bool _saving = false;

  // Body stats
  late int _height; // cm
  late int _weight; // kg
  String? _role;

  // Personality fields
  String? _zodiac;
  String? _mbti;
  String? _bloodType;
  late List<String> _kinks;
  final _kinkController = TextEditingController();

  static const _maxPhotos = 6;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authStateProvider).user;
    _nicknameController = TextEditingController(text: user?.nickname ?? '');
    _bioController = TextEditingController(text: user?.bio ?? '');
    _tagsController =
        TextEditingController(text: user?.tags.join(', ') ?? '');
    _photos = List<String>.from(user?.photos ?? []);
    _privatePhotos = List<String>.from(user?.privatePhotos ?? []);
    _height = user?.height ?? 170;
    _weight = user?.weight ?? 65;
    _role = user?.role;
    _zodiac = user?.zodiac;
    _mbti = user?.mbti;
    _bloodType = user?.bloodType;
    _kinks = List<String>.from(user?.kinks ?? []);
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    _bioController.dispose();
    _tagsController.dispose();
    _kinkController.dispose();
    super.dispose();
  }

  // ── Photo operations ───────────────────────────────────────────────────────

  Future<void> _addPhoto() async {
    if (_photos.length >= _maxPhotos) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Maximum $_maxPhotos photos reached')),
      );
      return;
    }

    final source = await _showPickerSheet();
    if (source == null) return;

    final service = ref.read(photoServiceProvider);
    final file = await service.pickImage(fromCamera: source == ImageSource.camera);
    if (file == null || !mounted) return;

    // Determine which empty slot this upload belongs to
    final slotIndex = _photos.length;
    setState(() => _loadingSlots.add(slotIndex));

    try {
      final url = await service.uploadPhoto(file);
      if (!mounted) return;
      setState(() => _photos.add(url));
      ref.read(authStateProvider.notifier).updatePhotos(List.from(_photos));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Upload failed. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingSlots.remove(slotIndex));
    }
  }

  Future<void> _showPhotoOptions(int index) async {
    final action = await showModalBottomSheet<_PhotoAction>(
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
            if (index != 0)
              ListTile(
                leading: const Icon(Icons.star_rounded, color: AppTheme.premium),
                title: const Text('Set as primary photo'),
                onTap: () => Navigator.pop(context, _PhotoAction.setPrimary),
              ),
            ListTile(
              leading: Icon(Icons.delete_rounded, color: AppTheme.error),
              title: Text('Remove photo',
                  style: TextStyle(color: AppTheme.error)),
              onTap: () => Navigator.pop(context, _PhotoAction.delete),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (action == _PhotoAction.setPrimary) {
      await _setAsPrimary(index);
    } else if (action == _PhotoAction.delete) {
      await _deletePhoto(index);
    }
  }

  Future<void> _setAsPrimary(int index) async {
    final url = _photos[index];
    // Move to front
    final reordered = [url, ..._photos.where((u) => u != url)];
    setState(() {
      _photos
        ..clear()
        ..addAll(reordered);
      _loadingSlots.add(0);
    });

    try {
      await ref.read(photoServiceProvider).reorderPhotos(List.from(_photos));
      ref.read(authStateProvider.notifier).updatePhotos(List.from(_photos));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update photo order.')),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingSlots.remove(0));
    }
  }

  Future<void> _deletePhoto(int index) async {
    final url = _photos[index];
    setState(() => _loadingSlots.add(index));

    try {
      await ref.read(photoServiceProvider).deletePhoto(url);
      if (!mounted) return;
      setState(() => _photos.removeAt(index));
      ref.read(authStateProvider.notifier).updatePhotos(List.from(_photos));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to remove photo.')),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingSlots.remove(index));
    }
  }

  Future<ImageSource?> _showPickerSheet() {
    return showModalBottomSheet<ImageSource>(
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
  }

  // ── Save text fields ───────────────────────────────────────────────────────

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final tags = _tagsController.text
          .split(',')
          .map((t) => t.trim())
          .where((t) => t.isNotEmpty)
          .toList();

      final updates = <String, dynamic>{
        'nickname': _nicknameController.text.trim(),
        'bio': _bioController.text.trim(),
        'tags': tags,
        'height': _height,
        'weight': _weight,
        'role': _role,
        'kinks': _kinks,
      };
      if (_zodiac != null) updates['zodiac'] = _zodiac;
      if (_mbti != null) updates['mbti'] = _mbti;
      if (_bloodType != null) updates['bloodType'] = _bloodType;

      await ref.read(authStateProvider.notifier).updateProfile(updates);
      if (mounted) context.pop();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Profile'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save',
                    style: TextStyle(color: AppTheme.primary)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Photos ──
            _buildPhotoSection(),
            const SizedBox(height: 32),

            // ── Nickname ──
            const Text('Nickname',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(
              controller: _nicknameController,
              decoration: const InputDecoration(hintText: 'Your nickname'),
            ),
            const SizedBox(height: 24),

            // ── Bio ──
            const Text('Bio', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(
              controller: _bioController,
              maxLines: 4,
              maxLength: 500,
              decoration: const InputDecoration(
                hintText: 'Tell others about yourself...',
              ),
            ),
            const SizedBox(height: 24),

            // ── Tags ──
            const Text('Tags (comma-separated)',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(
              controller: _tagsController,
              decoration: const InputDecoration(
                hintText: 'e.g. travel, music, fitness',
              ),
            ),
            const SizedBox(height: 24),

            // ── Private Photos ──
            const SizedBox(height: 8),
            _buildPrivatePhotosSection(),
            const SizedBox(height: 32),

            // ── Looking For ──
            const Text('正在找',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _LookingForTile(),
            const SizedBox(height: 24),

            // ── Role ──
            const Text('角色 (Role)',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _RoleSelector(
              value: _role,
              onChanged: (v) => setState(() => _role = v),
            ),
            const SizedBox(height: 24),

            // ── Zodiac ──
            const Text('星座 (Zodiac)',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _buildZodiacSelector(),
            const SizedBox(height: 24),

            // ── MBTI ──
            const Text('MBTI',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _buildMbtiSelector(),
            const SizedBox(height: 24),

            // ── Blood Type ──
            const Text('血型 (Blood Type)',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _buildBloodTypeSelector(),
            const SizedBox(height: 24),

            // ── Kinks ──
            const Text('标签 (Kinks)',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            _buildKinksSection(),
            const SizedBox(height: 24),

            // ── Body stats ──
            const Text('身材 (Body Stats)',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),

            // Height slider
            _BodyStatSlider(
              label: '身高 (Height)',
              value: _height.toDouble(),
              min: 140,
              max: 220,
              divisions: 80,
              unit: 'cm',
              onChanged: (v) => setState(() => _height = v.round()),
            ),
            const SizedBox(height: 16),

            // Weight slider
            _BodyStatSlider(
              label: '体重 (Weight)',
              value: _weight.toDouble(),
              min: 30,
              max: 150,
              divisions: 120,
              unit: 'kg',
              onChanged: (v) => setState(() => _weight = v.round()),
            ),
          ],
        ),
      ),
    );
  }

  // ── Private Photos section ─────────────────────────────────────────────────

  Widget _buildPrivatePhotosSection() {
    const maxPrivate = 5;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.lock_rounded, size: 15, color: Color(0xFFFFD700)),
            const SizedBox(width: 6),
            const Text('私密照片',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(width: 6),
            Text(
              '(${_privatePhotos.length}/$maxPrivate)',
              style: TextStyle(color: AppTheme.textHint, fontSize: 13),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          '私密照片需要对方申请后才能查看。',
          style: TextStyle(color: AppTheme.textHint, fontSize: 12),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1,
          ),
          itemCount: maxPrivate,
          itemBuilder: (_, index) {
            if (index < _privatePhotos.length) {
              return _buildPrivateFilledSlot(index);
            }
            if (index == _privatePhotos.length && !_privatePhotoUploading) {
              return _buildPrivateAddSlot(maxPrivate);
            }
            if (index == _privatePhotos.length && _privatePhotoUploading) {
              return Container(
                decoration: BoxDecoration(
                  color: AppTheme.card,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2)),
              );
            }
            return Container(
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF2A2A2A), width: 1),
              ),
              child: const Center(
                child: Icon(Icons.lock_rounded,
                    color: Color(0xFF3A3A3A), size: 20),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildPrivateFilledSlot(int index) {
    final url = _privatePhotos[index];
    final isDeleting = _privatePhotoDeleting.contains(url);

    return GestureDetector(
      onTap: isDeleting ? null : () => _deletePrivatePhoto(url),
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(url, fit: BoxFit.cover),
          ),
          if (isDeleting)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Container(
                color: Colors.black54,
                child: const Center(
                    child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            ),
          if (!isDeleting)
            Positioned(
              top: 4,
              right: 4,
              child: Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close_rounded,
                    color: Colors.white, size: 14),
              ),
            ),
          Positioned(
            bottom: 4,
            left: 4,
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Icon(Icons.lock_rounded,
                  color: Color(0xFFFFD700), size: 10),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrivateAddSlot(int maxPrivate) {
    if (_privatePhotos.length >= maxPrivate) return const SizedBox.shrink();
    return GestureDetector(
      onTap: _addPrivatePhoto,
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: const Color(0xFFFFD700).withValues(alpha: 0.4),
            width: 1.5,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFFFD700).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.lock_rounded,
                  color: Color(0xFFFFD700), size: 18),
            ),
            const SizedBox(height: 6),
            Text('添加私密',
                style: TextStyle(
                    color: AppTheme.textHint, fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Future<void> _addPrivatePhoto() async {
    final service = ref.read(privatePhotosServiceProvider);
    final file = await service.pickImage();
    if (file == null || !mounted) return;

    setState(() => _privatePhotoUploading = true);
    try {
      final url = await service.uploadPrivatePhoto(file);
      if (!mounted) return;
      setState(() => _privatePhotos.add(url));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Upload failed.')),
        );
      }
    } finally {
      if (mounted) setState(() => _privatePhotoUploading = false);
    }
  }

  Future<void> _deletePrivatePhoto(String url) async {
    setState(() => _privatePhotoDeleting.add(url));
    try {
      await ref.read(privatePhotosServiceProvider).deletePrivatePhoto(url);
      if (!mounted) return;
      setState(() => _privatePhotos.remove(url));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to remove photo.')),
        );
      }
    } finally {
      if (mounted) setState(() => _privatePhotoDeleting.remove(url));
    }
  }

  // ── Zodiac selector ────────────────────────────────────────────────────────

  static const _zodiacValues = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ];
  static const _zodiacLabels = [
    '白羊', '金牛', '双子', '巨蟹', '狮子', '处女',
    '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼',
  ];

  Widget _buildZodiacSelector() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: List.generate(_zodiacValues.length, (i) {
        final val = _zodiacValues[i];
        final label = _zodiacLabels[i];
        final selected = _zodiac == val;
        return FilterChip(
          label: Text(label),
          selected: selected,
          onSelected: (_) => setState(() => _zodiac = selected ? null : val),
          selectedColor: AppTheme.primary.withValues(alpha: 0.2),
          checkmarkColor: AppTheme.primary,
          side: BorderSide(
            color: selected ? AppTheme.primary : const Color(0xFF3A3A3A),
          ),
          backgroundColor: AppTheme.card,
          labelStyle: TextStyle(
            color: selected ? AppTheme.primary : AppTheme.textSecondary,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
            fontSize: 13,
          ),
        );
      }),
    );
  }

  // ── MBTI selector ──────────────────────────────────────────────────────────

  static const _mbtiValues = [
    'INTJ', 'INTP', 'ENTJ', 'ENTP',
    'INFJ', 'INFP', 'ENFJ', 'ENFP',
    'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
    'ISTP', 'ISFP', 'ESTP', 'ESFP',
  ];

  Widget _buildMbtiSelector() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _mbtiValues.map((val) {
        final selected = _mbti == val;
        return FilterChip(
          label: Text(val),
          selected: selected,
          onSelected: (_) => setState(() => _mbti = selected ? null : val),
          selectedColor: AppTheme.primary.withValues(alpha: 0.2),
          checkmarkColor: AppTheme.primary,
          side: BorderSide(
            color: selected ? AppTheme.primary : const Color(0xFF3A3A3A),
          ),
          backgroundColor: AppTheme.card,
          labelStyle: TextStyle(
            color: selected ? AppTheme.primary : AppTheme.textSecondary,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
            fontSize: 13,
          ),
        );
      }).toList(),
    );
  }

  // ── Blood type selector ────────────────────────────────────────────────────

  static const _bloodTypeValues = ['A', 'B', 'AB', 'O'];

  Widget _buildBloodTypeSelector() {
    return Row(
      children: _bloodTypeValues.map((val) {
        final selected = _bloodType == val;
        return Padding(
          padding: const EdgeInsets.only(right: 8),
          child: FilterChip(
            label: Text(val),
            selected: selected,
            onSelected: (_) =>
                setState(() => _bloodType = selected ? null : val),
            selectedColor: AppTheme.primary.withValues(alpha: 0.2),
            checkmarkColor: AppTheme.primary,
            side: BorderSide(
              color: selected ? AppTheme.primary : const Color(0xFF3A3A3A),
            ),
            backgroundColor: AppTheme.card,
            labelStyle: TextStyle(
              color: selected ? AppTheme.primary : AppTheme.textSecondary,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              fontSize: 13,
            ),
          ),
        );
      }).toList(),
    );
  }

  // ── Kinks section ──────────────────────────────────────────────────────────

  static const _maxKinks = 10;
  static const _maxKinkLength = 20;

  Widget _buildKinksSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _kinks.map((kink) {
            return ActionChip(
              label: Text(kink),
              avatar: const Icon(Icons.close_rounded, size: 14),
              onPressed: () => setState(() => _kinks.remove(kink)),
              backgroundColor: AppTheme.card,
              side: const BorderSide(color: Color(0xFF3A3A3A)),
              labelStyle: TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 13,
              ),
            );
          }).toList(),
        ),
        if (_kinks.length < _maxKinks) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _kinkController,
                  maxLength: _maxKinkLength,
                  decoration: InputDecoration(
                    hintText: '添加标签 (${_kinks.length}/$_maxKinks)',
                    counterText: '',
                  ),
                  onSubmitted: _addKink,
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: () => _addKink(_kinkController.text),
                icon: const Icon(Icons.add_circle_outline_rounded),
                color: AppTheme.primary,
              ),
            ],
          ),
        ],
        if (_kinks.length >= _maxKinks)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              '最多 $_maxKinks 个标签',
              style: TextStyle(color: AppTheme.textHint, fontSize: 12),
            ),
          ),
      ],
    );
  }

  void _addKink(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return;
    if (_kinks.length >= _maxKinks) return;
    if (_kinks.contains(trimmed)) return;
    setState(() {
      _kinks.add(trimmed);
      _kinkController.clear();
    });
  }

  Widget _buildPhotoSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Photos',
                style: TextStyle(fontWeight: FontWeight.w600)),
            Text(
              '${_photos.length}/$_maxPhotos',
              style: TextStyle(color: AppTheme.textHint, fontSize: 13),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Tap a photo to set as primary or remove. First photo is your main profile picture.',
          style: TextStyle(color: AppTheme.textHint, fontSize: 12),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 3 / 4,
          ),
          itemCount: _maxPhotos,
          itemBuilder: (context, index) {
            if (index < _photos.length) {
              return _buildFilledSlot(index);
            }
            // Empty slot — only first empty slot is tappable for adding
            if (index == _photos.length) {
              return _buildAddSlot();
            }
            return _buildEmptySlot();
          },
        ),
      ],
    );
  }

  Widget _buildFilledSlot(int index) {
    final isLoading = _loadingSlots.contains(index);
    final isPrimary = index == 0;

    return GestureDetector(
      onTap: isLoading ? null : () => _showPhotoOptions(index),
      child: Stack(
        fit: StackFit.expand,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: CachedNetworkImage(
              imageUrl: _photos[index],
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(color: AppTheme.card),
              errorWidget: (_, __, ___) => Container(
                color: AppTheme.card,
                child: const Icon(Icons.broken_image_rounded,
                    color: Color(0xFF3A3A3A)),
              ),
            ),
          ),

          // Loading overlay
          if (isLoading)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Container(
                color: Colors.black54,
                child: const Center(
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),

          // Primary badge
          if (isPrimary && !isLoading)
            Positioned(
              top: 6,
              left: 6,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                decoration: BoxDecoration(
                  color: AppTheme.premium.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'MAIN',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: Colors.black,
                  ),
                ),
              ),
            ),

          // Delete shortcut in corner
          if (!isLoading)
            Positioned(
              top: 4,
              right: 4,
              child: GestureDetector(
                onTap: () => _deletePhoto(index),
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close_rounded,
                      color: Colors.white, size: 14),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildAddSlot() {
    return GestureDetector(
      onTap: _addPhoto,
      child: Container(
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: AppTheme.primary.withValues(alpha: 0.4),
            width: 1.5,
            strokeAlign: BorderSide.strokeAlignInside,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: AppTheme.brandGradient,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.add_rounded,
                  color: Colors.white, size: 20),
            ),
            const SizedBox(height: 8),
            Text(
              'Add photo',
              style: TextStyle(
                  color: AppTheme.textHint,
                  fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptySlot() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF2A2A2A),
          width: 1,
        ),
      ),
    );
  }
}

enum _PhotoAction { setPrimary, delete }

// ── Body stat slider ──────────────────────────────────────────────────────────

class _BodyStatSlider extends StatelessWidget {
  final String label;
  final double value;
  final double min;
  final double max;
  final int divisions;
  final String unit;
  final ValueChanged<double> onChanged;

  const _BodyStatSlider({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.divisions,
    required this.unit,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label,
                  style: TextStyle(
                      color: AppTheme.textSecondary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600)),
              Text(
                '${value.round()} $unit',
                style: TextStyle(
                    color: AppTheme.primary,
                    fontSize: 15,
                    fontWeight: FontWeight.w700),
              ),
            ],
          ),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: AppTheme.primary,
              inactiveTrackColor: AppTheme.surface,
              thumbColor: AppTheme.primary,
              overlayColor: AppTheme.primary.withValues(alpha: 0.12),
              thumbShape:
                  const RoundSliderThumbShape(enabledThumbRadius: 9),
              trackHeight: 3,
            ),
            child: Slider(
              value: value,
              min: min,
              max: max,
              divisions: divisions,
              label: '${value.round()} $unit',
              onChanged: onChanged,
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${min.round()} $unit',
                  style: TextStyle(
                      color: AppTheme.textHint, fontSize: 11)),
              Text('${max.round()} $unit',
                  style: TextStyle(
                      color: AppTheme.textHint, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Role selector ─────────────────────────────────────────────────────────────

class _RoleSelector extends StatelessWidget {
  final String? value;
  final ValueChanged<String?> onChanged;

  const _RoleSelector({required this.value, required this.onChanged});

  static const _options = [
    _RoleOption('top', 'Top', Color(0xFF1565C0)),
    _RoleOption('versatile', 'Versatile', Color(0xFF6A1B9A)),
    _RoleOption('bottom', 'Bottom', Color(0xFFAD1457)),
  ];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: _options.map((opt) {
        final selected = value == opt.key;
        return Expanded(
          child: GestureDetector(
            onTap: () => onChanged(selected ? null : opt.key),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              margin: EdgeInsets.only(
                right: opt.key == 'bottom' ? 0 : 8,
              ),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: selected
                    ? opt.color.withValues(alpha: 0.9)
                    : AppTheme.card,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: selected ? opt.color : const Color(0xFF2A2A2A),
                  width: 1.5,
                ),
              ),
              alignment: Alignment.center,
              child: Text(
                opt.label,
                style: TextStyle(
                  color: selected ? Colors.white : AppTheme.textSecondary,
                  fontWeight:
                      selected ? FontWeight.w700 : FontWeight.w500,
                  fontSize: 13,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _RoleOption {
  final String key;
  final String label;
  final Color color;
  const _RoleOption(this.key, this.label, this.color);
}

// ── Looking For inline tile ───────────────────────────────────────────────────

class _LookingForTile extends ConsumerWidget {
  const _LookingForTile();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).user;
    final current = user?.lookingFor;

    return GestureDetector(
      onTap: () => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => LookingForSheet(current: current),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.card,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            current != null
                ? LookingForBadge(status: current)
                : Text('未设置',
                    style: TextStyle(
                        color: AppTheme.textHint, fontSize: 14)),
            const Spacer(),
            Icon(Icons.chevron_right_rounded, color: AppTheme.textHint),
          ],
        ),
      ),
    );
  }
}
