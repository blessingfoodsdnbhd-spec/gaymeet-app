import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../core/models/place.dart';
import '../../core/providers/places_provider.dart';
import '../../shared/widgets/gradient_button.dart';

const _categoryOptions = [
  ('bar', '酒吧', '🍺'),
  ('club', '夜店', '🎵'),
  ('restaurant', '餐厅', '🍜'),
  ('cafe', '咖啡馆', '☕'),
  ('sauna', '桑拿', '🧖'),
  ('hotel', '酒店', '🏨'),
  ('event_venue', '活动场地', '🎪'),
  ('park', '公园', '🌳'),
  ('gym', '健身房', '💪'),
  ('other', '其他', '📍'),
];

const _priceOptions = ['\$', '\$\$', '\$\$\$'];

const _cityOptions = [
  'Kuala Lumpur', 'Petaling Jaya', 'Shah Alam', 'Subang Jaya',
  'Johor Bahru', 'Penang', 'Kota Kinabalu', 'Kuching',
  'Singapore', 'Bangkok', 'Jakarta', 'Other',
];

class CreatePlaceScreen extends ConsumerStatefulWidget {
  const CreatePlaceScreen({super.key});

  @override
  ConsumerState<CreatePlaceScreen> createState() => _CreatePlaceScreenState();
}

class _CreatePlaceScreenState extends ConsumerState<CreatePlaceScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameC = TextEditingController();
  final _descC = TextEditingController();
  final _addressC = TextEditingController();
  final _phoneC = TextEditingController();
  final _websiteC = TextEditingController();
  final _hoursC = TextEditingController();
  final _tagInputC = TextEditingController();

  String _category = 'bar';
  String _city = 'Kuala Lumpur';
  String _priceRange = '\$\$';
  List<String> _tags = [];
  bool _isLoading = false;

  @override
  void dispose() {
    _nameC.dispose();
    _descC.dispose();
    _addressC.dispose();
    _phoneC.dispose();
    _websiteC.dispose();
    _hoursC.dispose();
    _tagInputC.dispose();
    super.dispose();
  }

  void _addTag(String tag) {
    final t = tag.trim();
    if (t.isEmpty || _tags.contains(t) || _tags.length >= 10) return;
    setState(() => _tags.add(t));
    _tagInputC.clear();
  }

  void _removeTag(String tag) => setState(() => _tags.remove(tag));

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    final data = {
      'name': _nameC.text.trim(),
      'description': _descC.text.trim(),
      'category': _category,
      'address': _addressC.text.trim(),
      'city': _city,
      'phone': _phoneC.text.trim().isEmpty ? null : _phoneC.text.trim(),
      'website': _websiteC.text.trim().isEmpty ? null : _websiteC.text.trim(),
      'openingHours': _hoursC.text.trim().isEmpty ? null : _hoursC.text.trim(),
      'tags': _tags,
      'priceRange': _priceRange,
    };

    final error = await ref.read(placesProvider.notifier).createPlace(data);
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (error == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('地点已提交！感谢你的贡献 🙌'),
          backgroundColor: AppTheme.card,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      context.pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('提交失败: $error'),
          backgroundColor: AppTheme.card,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('添加地点')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // ── Name ────────────────────────────────────────────────────
            _SectionLabel(label: '地点名称 *'),
            TextFormField(
              controller: _nameC,
              decoration: const InputDecoration(hintText: '例：Utopia KL'),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? '请填写地点名称' : null,
            ),
            const SizedBox(height: 20),

            // ── Category ─────────────────────────────────────────────────
            _SectionLabel(label: '类别 *'),
            GridView.count(
              crossAxisCount: 5,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: _categoryOptions.map((opt) {
                final (val, label, emoji) = opt;
                final selected = _category == val;
                return GestureDetector(
                  onTap: () => setState(() => _category = val),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    decoration: BoxDecoration(
                      gradient: selected
                          ? const LinearGradient(
                              colors: [AppTheme.gradient1, AppTheme.gradient2])
                          : null,
                      color: selected ? null : AppTheme.card,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(emoji, style: const TextStyle(fontSize: 22)),
                        const SizedBox(height: 4),
                        Text(
                          label,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: selected ? Colors.white : AppTheme.textSecondary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // ── Description ──────────────────────────────────────────────
            _SectionLabel(label: '简介'),
            TextFormField(
              controller: _descC,
              maxLines: 3,
              maxLength: 500,
              decoration: const InputDecoration(
                hintText: '介绍这个地方的特色...',
                counterStyle: TextStyle(fontSize: 11),
              ),
            ),
            const SizedBox(height: 20),

            // ── Address ───────────────────────────────────────────────────
            _SectionLabel(label: '地址'),
            TextFormField(
              controller: _addressC,
              decoration: const InputDecoration(
                hintText: '例：Jalan Ampang, Kuala Lumpur',
                prefixIcon: Icon(Icons.location_on_outlined, size: 18),
              ),
            ),
            const SizedBox(height: 16),

            // ── City ─────────────────────────────────────────────────────
            _SectionLabel(label: '城市'),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(16),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _city,
                  dropdownColor: AppTheme.card,
                  isExpanded: true,
                  items: _cityOptions
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setState(() => _city = v ?? _city),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Opening hours ─────────────────────────────────────────────
            _SectionLabel(label: '营业时间'),
            TextFormField(
              controller: _hoursC,
              decoration: const InputDecoration(
                hintText: '例：Mon-Sat 8PM-3AM',
                prefixIcon: Icon(Icons.access_time_rounded, size: 18),
              ),
            ),
            const SizedBox(height: 16),

            // ── Phone ─────────────────────────────────────────────────────
            _SectionLabel(label: '电话（选填）'),
            TextFormField(
              controller: _phoneC,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                hintText: '例：012-3456789',
                prefixIcon: Icon(Icons.phone_outlined, size: 18),
              ),
            ),
            const SizedBox(height: 16),

            // ── Website ───────────────────────────────────────────────────
            _SectionLabel(label: '网站（选填）'),
            TextFormField(
              controller: _websiteC,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                hintText: '例：https://example.com',
                prefixIcon: Icon(Icons.language_rounded, size: 18),
              ),
            ),
            const SizedBox(height: 20),

            // ── Tags ──────────────────────────────────────────────────────
            _SectionLabel(label: '标签'),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _tagInputC,
                    decoration: const InputDecoration(hintText: '输入标签后按Enter'),
                    onSubmitted: _addTag,
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: () => _addTag(_tagInputC.text),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                          colors: [AppTheme.gradient1, AppTheme.gradient2]),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.add_rounded,
                        color: Colors.white, size: 20),
                  ),
                ),
              ],
            ),
            if (_tags.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _tags
                    .map((t) => Chip(
                          label: Text(t,
                              style: const TextStyle(fontSize: 12)),
                          deleteIcon: const Icon(Icons.close_rounded, size: 14),
                          onDeleted: () => _removeTag(t),
                          backgroundColor: AppTheme.surface,
                          side: BorderSide(
                              color: AppTheme.primary.withOpacity(0.3)),
                          labelStyle:
                              TextStyle(color: AppTheme.textPrimary),
                        ))
                    .toList(),
              ),
            ],
            const SizedBox(height: 20),

            // ── Price range ───────────────────────────────────────────────
            _SectionLabel(label: '价位'),
            Row(
              children: _priceOptions.map((p) {
                final selected = _priceRange == p;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _priceRange = p),
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        gradient: selected
                            ? const LinearGradient(
                                colors: [
                                  AppTheme.gradient1,
                                  AppTheme.gradient2
                                ])
                            : null,
                        color: selected ? null : AppTheme.card,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: Text(
                          p,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: selected
                                ? Colors.white
                                : AppTheme.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 32),

            GradientButton(
              text: '发布地点',
              isLoading: _isLoading,
              onPressed: _isLoading ? null : _submit,
            ),
            const SizedBox(height: 12),
            Center(
              child: Text(
                '免费用户最多发布3个地点，Premium无限制',
                style: TextStyle(color: AppTheme.textHint, fontSize: 11),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: AppTheme.textSecondary,
        ),
      ),
    );
  }
}
