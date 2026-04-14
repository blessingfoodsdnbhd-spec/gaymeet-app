import 'package:gaymeet/core/providers/auth_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/questions_service.dart';
import '../models/question.dart';

// ── Inbox ─────────────────────────────────────────────────────────────────────

class InboxState {
  final List<Question> questions;
  final bool isLoading;
  final String? error;

  const InboxState({
    this.questions = const [],
    this.isLoading = false,
    this.error,
  });

  InboxState copyWith({
    List<Question>? questions,
    bool? isLoading,
    String? error,
  }) =>
      InboxState(
        questions: questions ?? this.questions,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

class InboxNotifier extends StateNotifier<InboxState> {
  final QuestionsService _service;

  InboxNotifier(this._service) : super(const InboxState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final questions = await _service.getInbox();
      state = state.copyWith(questions: questions, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<bool> answer(
    String questionId, {
    required String answer,
    bool isPublic = false,
  }) async {
    try {
      final updated = await _service.answerQuestion(questionId,
          answer: answer, isPublic: isPublic);
      state = state.copyWith(
        questions: state.questions
            .map((q) => q.id == questionId ? updated : q)
            .toList(),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> delete(String questionId) async {
    try {
      await _service.deleteQuestion(questionId);
      state = state.copyWith(
        questions: state.questions.where((q) => q.id != questionId).toList(),
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ── Public Q&A (per-user, for profile display) ────────────────────────────────

class PublicQAState {
  final List<Question> questions;
  final bool isLoading;

  const PublicQAState({this.questions = const [], this.isLoading = false});

  PublicQAState copyWith({List<Question>? questions, bool? isLoading}) =>
      PublicQAState(
        questions: questions ?? this.questions,
        isLoading: isLoading ?? this.isLoading,
      );
}

class PublicQANotifier extends StateNotifier<PublicQAState> {
  final QuestionsService _service;
  final String _userId;

  PublicQANotifier(this._service, this._userId) : super(const PublicQAState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true);
    try {
      final questions = await _service.getPublicQA(_userId);
      state = state.copyWith(questions: questions, isLoading: false);
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────

final _questionsServiceProvider = Provider<QuestionsService>(
  (ref) => QuestionsService(ref.watch(apiClientProvider)),
);

final questionInboxProvider =
    StateNotifierProvider<InboxNotifier, InboxState>((ref) {
  return InboxNotifier(ref.watch(_questionsServiceProvider));
});

final publicQAProvider =
    StateNotifierProvider.family<PublicQANotifier, PublicQAState, String>(
  (ref, userId) => PublicQANotifier(ref.watch(_questionsServiceProvider), userId),
);
