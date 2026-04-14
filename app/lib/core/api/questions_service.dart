import '../models/question.dart';
import 'api_client.dart';

class QuestionsService {
  final ApiClient _client;
  QuestionsService(this._client);

  Future<Question> sendQuestion(
    String targetUserId, {
    required String content,
    bool isAnonymous = true,
  }) async {
    final res = await _client.dio.post(
      '/users/$targetUserId/questions',
      data: {'content': content, 'isAnonymous': isAnonymous},
    );
    return Question.fromJson(
        (res.data['data'] ?? res.data) as Map<String, dynamic>);
  }

  Future<List<Question>> getInbox({int page = 1}) async {
    final res = await _client.dio
        .get('/questions/inbox', queryParameters: {'page': page, 'limit': 20});
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => Question.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  Future<Question> answerQuestion(
    String questionId, {
    required String answer,
    bool isPublic = false,
  }) async {
    final res = await _client.dio.post(
      '/questions/$questionId/answer',
      data: {'answer': answer, 'isPublic': isPublic},
    );
    return Question.fromJson(
        (res.data['data'] ?? res.data) as Map<String, dynamic>);
  }

  Future<void> deleteQuestion(String questionId) async {
    await _client.dio.delete('/questions/$questionId');
  }

  Future<List<Question>> getPublicQA(String userId, {int page = 1}) async {
    final res = await _client.dio.get(
      '/users/$userId/questions/public',
      queryParameters: {'page': page, 'limit': 10},
    );
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => Question.fromJson(j as Map<String, dynamic>))
        .toList();
  }
}
