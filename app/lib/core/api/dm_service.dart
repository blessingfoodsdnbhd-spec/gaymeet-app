import 'api_client.dart';
import '../models/direct_message.dart';

class DmService {
  final ApiClient _client;
  DmService(this._client);

  Future<List<DirectMessage>> getInbox() async {
    final res = await _client.dio.get('/dm/inbox');
    final list = res.data['data'] as List;
    return list
        .map((e) => DirectMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<DirectMessage>> getSent() async {
    final res = await _client.dio.get('/dm/sent');
    final list = res.data['data'] as List;
    return list
        .map((e) => DirectMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<DirectMessage> send({
    required String receiverId,
    required String content,
  }) async {
    final res = await _client.dio.post('/dm/send', data: {
      'receiverId': receiverId,
      'content': content,
    });
    return DirectMessage.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  Future<void> accept(String id) async {
    await _client.dio.post('/dm/$id/accept');
  }

  Future<void> reply(String id, String content) async {
    await _client.dio.post('/dm/$id/reply', data: {'content': content});
  }

  Future<void> delete(String id) async {
    await _client.dio.delete('/dm/$id');
  }
}
