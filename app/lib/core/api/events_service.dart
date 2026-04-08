import '../models/event.dart';
import 'api_client.dart';

class EventsService {
  final ApiClient _client;
  EventsService(this._client);

  Future<List<AppEvent>> getEvents({
    String? category,
    double? lat,
    double? lng,
    int page = 1,
  }) async {
    final params = <String, dynamic>{'page': page, 'limit': 20};
    if (category != null && category != 'all') params['category'] = category;
    if (lat != null) params['lat'] = lat;
    if (lng != null) params['lng'] = lng;
    final res = await _client.dio.get('/events', queryParameters: params);
    final list = (res.data['data'] ?? res.data) as List;
    return list.map((j) => AppEvent.fromJson(j as Map<String, dynamic>)).toList();
  }

  Future<AppEvent> getEvent(String id) async {
    final res = await _client.dio.get('/events/$id');
    return AppEvent.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  Future<AppEvent> createEvent(Map<String, dynamic> body) async {
    final res = await _client.dio.post('/events', data: body);
    return AppEvent.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> joinEvent(String id,
      {String status = 'going'}) async {
    final res = await _client.dio
        .post('/events/$id/join', data: {'status': status});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> leaveEvent(String id) =>
      _client.dio.delete('/events/$id/leave');

  Future<Map<String, dynamic>> getMyEvents() async {
    final res = await _client.dio.get('/events/mine');
    return res.data['data'] as Map<String, dynamic>;
  }
}
