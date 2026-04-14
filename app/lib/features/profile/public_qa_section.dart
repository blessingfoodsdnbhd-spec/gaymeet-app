import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/theme.dart';
import '../../core/models/question.dart';
import '../../core/providers/questions_provider.dart';

/// Displays answered public Q&A pairs on a user profile.
class PublicQASection extends ConsumerWidget {
  final String userId;
  const PublicQASection({super.key, required this.userId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(publicQAProvider(userId));

    if (state.isLoading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (state.questions.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(0, 0, 0, 12),
          child: Row(
            children: [
              const Text('📬',
                  style: TextStyle(fontSize: 16)),
              const SizedBox(width: 8),
              const Text(
                '提问箱',
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              Text(
                '${state.questions.length} 条回答',
                style: TextStyle(
                    color: AppTheme.textHint, fontSize: 12),
              ),
            ],
          ),
        ),
        ...state.questions.map((q) => _QAPair(question: q)),
      ],
    );
  }
}

class _QAPair extends StatelessWidget {
  final Question question;
  const _QAPair({required this.question});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Question
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: AppTheme.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text('Q',
                      style: TextStyle(
                        color: AppTheme.primary,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      )),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  question.content,
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      height: 1.4),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Answer
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  gradient: AppColors.pinkGradient,
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Text('A',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      )),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  question.answer!,
                  style: TextStyle(
                      fontSize: 14,
                      color: AppTheme.textPrimary,
                      height: 1.4),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
