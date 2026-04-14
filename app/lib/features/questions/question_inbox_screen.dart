import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/models/question.dart';
import '../../core/providers/questions_provider.dart';

class QuestionInboxScreen extends ConsumerWidget {
  const QuestionInboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(questionInboxProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('提问箱 📬'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(questionInboxProvider.notifier).fetch(),
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : state.questions.isEmpty
              ? _buildEmpty(context)
              : RefreshIndicator(
                  color: AppTheme.primary,
                  onRefresh: () =>
                      ref.read(questionInboxProvider.notifier).fetch(),
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    itemCount: state.questions.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (_, i) =>
                        _QuestionCard(question: state.questions[i]),
                  ),
                ),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('📬', style: const TextStyle(fontSize: 52)),
          const SizedBox(height: 16),
          const Text(
            '还没有人提问',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            '在你的主页分享提问箱链接，\n让大家匿名提问吧！',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.textSecondary, height: 1.5),
          ),
        ],
      ),
    );
  }
}

// ── Question card ─────────────────────────────────────────────────────────────

class _QuestionCard extends ConsumerStatefulWidget {
  final Question question;
  const _QuestionCard({required this.question});

  @override
  ConsumerState<_QuestionCard> createState() => _QuestionCardState();
}

class _QuestionCardState extends ConsumerState<_QuestionCard> {
  bool _answerMode = false;
  bool _isPublic = false;
  final _answerCtrl = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.question.isAnswered) {
      _answerCtrl.text = widget.question.answer!;
      _isPublic = widget.question.isPublic;
    }
  }

  @override
  void dispose() {
    _answerCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _answerCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _submitting = true);
    final ok = await ref.read(questionInboxProvider.notifier).answer(
          widget.question.id,
          answer: text,
          isPublic: _isPublic,
        );
    if (mounted) {
      setState(() {
        _submitting = false;
        _answerMode = false;
      });
      if (!ok) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('回答失败，请重试')));
      }
    }
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        title: const Text('删除提问'),
        content: const Text('确定要删除这条提问吗？'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('取消')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('删除', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      ref.read(questionInboxProvider.notifier).delete(widget.question.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = widget.question;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: q.isAnswered
              ? AppTheme.primary.withOpacity(0.2)
              : Colors.white12,
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sender row
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: q.isAnonymous
                      ? AppTheme.card
                      : AppTheme.primary.withOpacity(0.2),
                  image: !q.isAnonymous && q.sender?.avatarUrl != null
                      ? DecorationImage(
                          image: NetworkImage(q.sender!.avatarUrl!),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: q.isAnonymous || q.sender?.avatarUrl == null
                    ? Icon(
                        q.isAnonymous
                            ? Icons.person_outline_rounded
                            : Icons.person_rounded,
                        size: 18,
                        color: AppTheme.textHint,
                      )
                    : null,
              ),
              const SizedBox(width: 8),
              Text(
                q.isAnonymous ? '匿名用户' : (q.sender?.nickname ?? '用户'),
                style: TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              Text(
                _timeAgo(q.createdAt),
                style: TextStyle(color: AppTheme.textHint, fontSize: 11),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _delete,
                child: Icon(Icons.close_rounded,
                    size: 18, color: AppTheme.textHint),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Question text
          Text(
            q.content,
            style: const TextStyle(
                fontSize: 15, fontWeight: FontWeight.w500, height: 1.4),
          ),

          // Answer (existing or input)
          if (q.isAnswered && !_answerMode) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.primary.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                    color: AppTheme.primary.withOpacity(0.2), width: 1),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.reply_rounded,
                          size: 14, color: AppTheme.primary),
                      const SizedBox(width: 4),
                      Text('我的回答',
                          style: TextStyle(
                              color: AppTheme.primary,
                              fontSize: 11,
                              fontWeight: FontWeight.w600)),
                      const Spacer(),
                      if (q.isPublic)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text('公开',
                              style: TextStyle(
                                  color: AppTheme.primary, fontSize: 10)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(q.answer!,
                      style: const TextStyle(fontSize: 14, height: 1.4)),
                ],
              ),
            ),
          ] else if (_answerMode) ...[
            const SizedBox(height: 12),
            TextField(
              controller: _answerCtrl,
              maxLength: 500,
              maxLines: 4,
              minLines: 2,
              autofocus: true,
              decoration: InputDecoration(
                hintText: '写下你的回答...',
                hintStyle: TextStyle(color: AppTheme.textHint),
                filled: true,
                fillColor: AppTheme.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.all(12),
              ),
            ),
            Row(
              children: [
                Switch(
                  value: _isPublic,
                  activeColor: AppTheme.primary,
                  onChanged: (v) => setState(() => _isPublic = v),
                ),
                Text('公开展示',
                    style:
                        TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                const Spacer(),
                TextButton(
                  onPressed: () => setState(() => _answerMode = false),
                  child: const Text('取消'),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Text('发布'),
                ),
              ],
            ),
          ],

          // Action buttons when not answered and not in answer mode
          if (!q.isAnswered && !_answerMode) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => setState(() => _answerMode = true),
                icon: const Icon(Icons.reply_rounded, size: 16),
                label: const Text('回答'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.primary,
                  side: BorderSide(color: AppTheme.primary.withOpacity(0.5)),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
          ] else if (q.isAnswered && !_answerMode) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => setState(() => _answerMode = true),
              child: Text('修改回答',
                  style: TextStyle(
                      color: AppTheme.textHint, fontSize: 12)),
            ),
          ],
        ],
      ),
    );
  }

  String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    return '${diff.inDays}天前';
  }
}
