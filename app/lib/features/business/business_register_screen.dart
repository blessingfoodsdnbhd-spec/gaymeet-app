import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../config/theme.dart';
import '../../core/providers/business_provider.dart';

const _categories = [
  ('bar', '酒吧', '🍺'),
  ('club', '夜店', '🎵'),
  ('restaurant', '餐厅', '🍜'),
  ('sauna', '桑拿', '🧖'),
  ('hotel', '酒店', '🏨'),
  ('gym', '健身房', '💪'),
  ('other', '其他', '🏪'),
];

class BusinessRegisterScreen extends ConsumerStatefulWidget {
  const BusinessRegisterScreen({super.key});

  @override
  ConsumerState<BusinessRegisterScreen> createState() => _BusinessRegisterScreenState();
}

class _BusinessRegisterScreenState extends ConsumerState<BusinessRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _websiteCtrl = TextEditingController();
  final _hoursCtrl = TextEditingController();
  String _category = 'bar';

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _addressCtrl.dispose();
    _phoneCtrl.dispose();
    _websiteCtrl.dispose();
    _hoursCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final err = await ref.read(businessProvider.notifier).register({
      'businessName': _nameCtrl.text.trim(),
      'category': _category,
      'description': _descCtrl.text.trim(),
      'address': _addressCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
      'website': _websiteCtrl.text.trim().isEmpty ? null : _websiteCtrl.text.trim(),
      'openingHours': _hoursCtrl.text.trim().isEmpty ? null : _hoursCtrl.text.trim(),
    });
    if (!mounted) return;
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
      return;
    }
    context.pushReplacement('/business/dashboard');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(businessProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('商家入驻')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF1A1A3E), Color(0xFF2D1B4E)],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  const Text('🏪', style: TextStyle(fontSize: 48)),
                  const SizedBox(height: 12),
                  const Text('欢迎入驻 GayMeet 商家平台',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text(
                    '触达数千名本地用户，提升品牌曝光',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 28),

            _label('商家名称 *'),
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(hintText: '请输入商家名称'),
              validator: (v) => v == null || v.trim().isEmpty ? '请输入商家名称' : null,
            ),

            const SizedBox(height: 16),

            _label('商家类型 *'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _categories.map((c) {
                final (val, label, emoji) = c;
                final selected = _category == val;
                return GestureDetector(
                  onTap: () => setState(() => _category = val),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      gradient: selected
                          ? const LinearGradient(colors: [AppTheme.gradient1, AppTheme.gradient2])
                          : null,
                      color: selected ? null : AppTheme.card,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '$emoji $label',
                      style: TextStyle(
                        color: selected ? Colors.white : AppTheme.textSecondary,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),

            const SizedBox(height: 16),

            _label('商家简介'),
            TextFormField(
              controller: _descCtrl,
              maxLines: 3,
              maxLength: 500,
              decoration: const InputDecoration(hintText: '描述一下你的商家特色...'),
            ),

            const SizedBox(height: 16),

            _label('地址'),
            TextFormField(
              controller: _addressCtrl,
              decoration: const InputDecoration(hintText: '商家地址'),
            ),

            const SizedBox(height: 16),

            _label('联系电话'),
            TextFormField(
              controller: _phoneCtrl,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(hintText: '+60 12-345 6789'),
            ),

            const SizedBox(height: 16),

            _label('网站'),
            TextFormField(
              controller: _websiteCtrl,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(hintText: 'https://...'),
            ),

            const SizedBox(height: 16),

            _label('营业时间'),
            TextFormField(
              controller: _hoursCtrl,
              decoration: const InputDecoration(hintText: '例：周一至周日 18:00–03:00'),
            ),

            const SizedBox(height: 32),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: state.isLoading ? null : _submit,
                child: state.isLoading
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('提交入驻申请'),
              ),
            ),

            const SizedBox(height: 16),
            Center(
              child: Text(
                '提交后商家将在24小时内审核通过',
                style: TextStyle(color: AppTheme.textHint, fontSize: 12),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      );
}
