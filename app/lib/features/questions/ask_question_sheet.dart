import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/api/api_client.dart';
import '../../core/providers/subscription_provider.dart';
import '../../core/theme/design_system.dart';

class AskQuestionSheet extends ConsumerStatefulWidget {
  final String targetUserId;
  final String targetNickname;

  const AskQuestionSheet({
    super.key,
    required this.targetUserId,
    required this.targetNickname,
  });

  @override
  ConsumerState<AskQuestionSheet> createState() => _AskQuestionSheetState();
}

class _AskQuestionSheetState extends ConsumerState<AskQuestionSheet> {
  final _ctrl = TextEditingController();
  bool _isAnonymous = true;
  bool _sending = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref.read(apiClientProvider).dio.post(
        '/users/${widget.targetUserId}/questions',
        data: {'content': text, 'isAnonymous': _isAnonymous},
      );
      if (mounted) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('提问已发送！')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _sending = false);
        final msg = e.toString().contains('429')
            ? '今日提问次数已达上限（3次），升级VIP即可无限提问'
            : '发送失败，请重试';
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sub = ref.watch(subscriptionProvider);
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottom),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: AppColors.pinkGradient,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.question_mark_rounded,
                    color: Colors.white, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '向 ${widget.targetNickname} 提问',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 16),
                    ),
                    if (!sub.isPremium)
                      Text(
                        '免费用户每天可提问3次',
                        style: TextStyle(
                            color: AppTheme.textHint, fontSize: 11),
                      ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Input
          TextField(
            controller: _ctrl,
            maxLength: 300,
            maxLines: 4,
            minLines: 2,
            autofocus: true,
            decoration: InputDecoration(
              hintText: '想问什么？（支持匿名）',
              hintStyle: TextStyle(color: AppTheme.textHint),
              filled: true,
              fillColor: AppTheme.card,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),

          const SizedBox(height: 12),

          // Anonymous toggle
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: AppTheme.card,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Icon(
                  _isAnonymous ? Icons.visibility_off_rounded : Icons.person_rounded,
                  size: 18,
                  color: _isAnonymous ? AppTheme.primary : AppTheme.textSecondary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _isAnonymous ? '匿名提问（对方看不到你是谁）' : '实名提问',
                    style:
                        TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                  ),
                ),
                Switch(
                  value: _isAnonymous,
                  activeColor: AppTheme.primary,
                  onChanged: (v) => setState(() => _isAnonymous = v),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Send button
          GestureDetector(
            onTap: _sending ? null : _send,
            child: Container(
              height: 50,
              decoration: BoxDecoration(
                gradient: AppColors.pinkGradient,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: _sending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text(
                        '发送提问',
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
    );
  }
}
