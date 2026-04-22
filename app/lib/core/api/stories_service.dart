import 'dart:io';
import 'package:dio/dio.dart';
import '../models/story.dart';
import 'api_client.dart';

class StoriesService {
  final ApiClient _client;
  StoriesService(this._client);

  Future<List<StoryGroup>> getFeed({String feed = 'discover'}) async {
    final res = await _client.dio.get(
      '/stories',
      queryParameters: feed == 'following' ? {'feed': 'following'} : null,
    );
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => StoryGroup.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  Future<List<StoryItem>> getUserStories(String userId) async {
    final res = await _client.dio.get('/stories/$userId');
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => StoryItem.fromJson(j as Map<String, dynamic>))
        .toList();
  }

  Future<StoryItem> createStory({
    required File file,
    String mediaType = 'image',
    String caption = '',
    String visibility = 'followers',
    double? lat,
    double? lng,
  }) async {
    final fields = <String, dynamic>{
      'media': await MultipartFile.fromFile(file.path),
      'mediaType': mediaType,
      'caption': caption,
      'visibility': visibility,
    };
    if (lat != null) fields['lat'] = lat.toString();
    if (lng != null) fields['lng'] = lng.toString();
    final formData = FormData.fromMap(fields);
    final res = await _client.dio.post('/stories', data: formData);
    return StoryItem.fromJson(
        (res.data['data'] ?? res.data) as Map<String, dynamic>);
  }

  Future<void> deleteStory(String storyId) =>
      _client.dio.delete('/stories/$storyId');

  Future<void> markViewed(String storyId) =>
      _client.dio.post('/stories/$storyId/view');
}
