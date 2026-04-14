import '../models/group_chat.dart';
import 'api_client.dart';

class GroupsService {
  final ApiClient _client;
  GroupsService(this._client);

  Future<List<GroupChat>> getGroups({String tab = 'discover', int page = 1}) async {
    final res = await _client.dio.get('/groups',
        queryParameters: {'tab': tab, 'page': page, 'limit': 20});
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => GroupChat.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  Future<GroupChat> getGroup(String id) async {
    final res = await _client.dio.get('/groups/$id');
    return GroupChat.fromJson(
        (res.data['data'] ?? res.data) as Map<String, dynamic>);
  }

  Future<GroupChat> createGroup({
    required String name,
    String description = '',
    bool isPublic = true,
    List<String> tags = const [],
  }) async {
    final res = await _client.dio.post('/groups', data: {
      'name': name,
      'description': description,
      'isPublic': isPublic,
      'tags': tags,
    });
    return GroupChat.fromJson(
        (res.data['data'] ?? res.data) as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> joinGroup(String id) async {
    final res = await _client.dio.post('/groups/$id/join');
    return (res.data['data'] ?? res.data) as Map<String, dynamic>;
  }

  Future<void> leaveGroup(String id) =>
      _client.dio.post('/groups/$id/leave');

  Future<List<GroupMessage>> getMessages(String groupId,
      {int page = 1}) async {
    final res = await _client.dio.get('/groups/$groupId/messages',
        queryParameters: {'page': page, 'limit': 30});
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => GroupMessage.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  Future<GroupMessage> sendMessage(String groupId, String content,
      {String type = 'text'}) async {
    final res = await _client.dio.post('/groups/$groupId/messages',
        data: {'content': content, 'type': type});
    return GroupMessage.fromJson(
        (res.data['data'] ?? res.data) as Map<String, dynamic>);
  }
}
