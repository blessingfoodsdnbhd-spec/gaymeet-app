import 'api_client.dart';
import '../models/date_room.dart';

class DateRoomsService {
  final ApiClient _client;
  DateRoomsService(this._client);

  Future<DateRoom> create(int durationMinutes) async {
    final res = await _client.dio.post('/date-rooms', data: {'durationMinutes': durationMinutes});
    return DateRoom.fromJson(res.data['data']['room'] as Map<String, dynamic>);
  }

  Future<DateRoom> join(String roomId) async {
    final res = await _client.dio.post('/date-rooms/$roomId/join');
    return DateRoom.fromJson(res.data['data']['room'] as Map<String, dynamic>);
  }

  Future<void> end(String roomId) async {
    await _client.dio.post('/date-rooms/$roomId/end');
  }

  Future<DateRoom?> getActive() async {
    final res = await _client.dio.get('/date-rooms/active');
    final data = res.data['data']['room'];
    if (data == null) return null;
    return DateRoom.fromJson(data as Map<String, dynamic>);
  }

  Future<List<DateRoom>> getHistory() async {
    final res = await _client.dio.get('/date-rooms/history');
    final rooms = res.data['data']['rooms'] as List<dynamic>;
    return rooms.map((r) => DateRoom.fromJson(r as Map<String, dynamic>)).toList();
  }

  Future<DateRoom?> findByCode(String code) async {
    try {
      final res = await _client.dio.get('/date-rooms/by-code/$code');
      final data = res.data['data']['room'];
      if (data == null) return null;
      return DateRoom.fromJson(data as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }
}
