import '../models/moment.dart';
import 'api_client.dart';

class MomentsService {
  final ApiClient _client;
  MomentsService(this._client);

  Future<List<Moment>> getFeed({
    int page = 1,
    String? userId,
    String feed = 'discover',
  }) async {
    final params = <String, dynamic>{'page': page, 'limit': 20};
    if (userId != null) params['userId'] = userId;
    if (feed != 'discover') params['feed'] = feed;
    final res = await _client.dio.get('/moments', queryParameters: params);
    final list = (res.data['data'] ?? res.data) as List;
    return list.map((j) => Moment.fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<Moment> getMoment(String id) async {
    final res = await _client.dio.get('/moments/$id');
    return Moment.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  Future<Moment> createMoment({
    required String content,
    required List<String> images,
    required String visibility,
    double? lat,
    double? lng,
  }) async {
    final body = <String, dynamic>{
      'content': content,
      'images': images,
      'visibility': visibility,
    };
    if (lat != null) body['lat'] = lat;
    if (lng != null) body['lng'] = lng;
    final res = await _client.dio.post('/moments', data: body);
    return Moment.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  Future<void> deleteMoment(String id) =>
      _client.dio.delete('/moments/$id');

  Future<Map<String, dynamic>> toggleLike(String id) async {
    final res = await _client.dio.post('/moments/$id/like');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<MomentComment> addComment(
      String momentId, String content, {String? parentCommentId}) async {
    final body = <String, dynamic>{'content': content};
    if (parentCommentId != null) body['parentCommentId'] = parentCommentId;
    final res = await _client.dio.post('/moments/$momentId/comment', data: body);
    return MomentComment.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  Future<void> deleteComment(String momentId, String commentId) =>
      _client.dio.delete('/moments/$momentId/comments/$commentId');

  Future<List<MomentComment>> getComments(String momentId,
      {int page = 1}) async {
    final res = await _client.dio.get('/moments/$momentId/comments',
        queryParameters: {'page': page});
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => MomentComment.fromJson(j as Map<String, dynamic>))
        .toList();
  }
}
