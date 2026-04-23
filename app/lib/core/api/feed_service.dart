import '../models/feed_item.dart';
import 'api_client.dart';

class FeedService {
  final ApiClient _client;
  FeedService(this._client);

  /// [tab] is 'discover' or 'following'.
  Future<List<FeedItem>> getFeed({
    String tab = 'discover',
    int page = 1,
    int limit = 20,
  }) async {
    final res = await _client.dio.get('/feed', queryParameters: {
      'tab': tab,
      'page': page,
      'limit': limit,
    });
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => FeedItem.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  /// Toggle like — only valid for type=moment|place items (they are Moments).
  Future<Map<String, dynamic>> toggleMomentLike(String momentId) async {
    final res = await _client.dio.post('/moments/$momentId/like');
    return res.data['data'] as Map<String, dynamic>;
  }
}
