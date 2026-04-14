import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/providers/groups_provider.dart';

class CreateGroupScreen extends ConsumerStatefulWidget {
  const CreateGroupScreen({super.key});

  @override
  ConsumerState<CreateGroupScreen> createState() => _CreateGroupScreenState();
}

class _CreateGroupScreenState extends ConsumerState<CreateGroupScreen> {
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  bool _isPublic = true;
  bool _isCreating = false;
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (!_formKey.currentState!.validate() || _isCreating) return;
    setState(() => _isCreating = true);
    final group = await ref.read(groupsProvider.notifier).createGroup(
          name: _nameCtrl.text.trim(),
          description: _descCtrl.text.trim(),
          isPublic: _isPublic,
        );
    if (mounted) {
      if (group != null) {
        Navigator.of(context).pop(group);
      } else {
        setState(() => _isCreating = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('创建失败，请重试')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('创建群组'),
        actions: [
          TextButton(
            onPressed: _isCreating ? null : _create,
            child: _isCreating
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text('创建',
                    style: TextStyle(
                        color: AppTheme.primary, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // Group name
            TextFormField(
              controller: _nameCtrl,
              maxLength: 30,
              decoration: InputDecoration(
                labelText: '群组名称',
                hintText: '输入群组名称',
                filled: true,
                fillColor: AppTheme.card,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return '请输入群组名称';
                if (v.trim().length < 2) return '群组名称至少2个字';
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Description
            TextFormField(
              controller: _descCtrl,
              maxLength: 200,
              maxLines: 3,
              decoration: InputDecoration(
                labelText: '群组介绍（可选）',
                hintText: '描述一下这个群组...',
                filled: true,
                fillColor: AppTheme.card,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 8),

            // Public toggle
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.card,
                borderRadius: BorderRadius.circular(12),
              ),
              child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('公开群组',
                    style: TextStyle(fontWeight: FontWeight.w500)),
                subtitle: Text(
                  _isPublic ? '所有人可以搜索并加入' : '仅通过邀请加入',
                  style: TextStyle(
                      fontSize: 12, color: AppTheme.textSecondary),
                ),
                value: _isPublic,
                activeColor: AppTheme.primary,
                onChanged: (v) => setState(() => _isPublic = v),
              ),
            ),

            const SizedBox(height: 32),

            // Create button
            GestureDetector(
              onTap: _isCreating ? null : _create,
              child: Container(
                height: 52,
                decoration: BoxDecoration(
                  gradient: AppTheme.brandGradient,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: _isCreating
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text(
                          '创建群组',
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
    );
  }
}
