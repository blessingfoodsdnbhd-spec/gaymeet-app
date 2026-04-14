import '../models/calendar_event.dart';
import 'api_client.dart';

class CalendarService {
  final ApiClient _client;
  CalendarService(this._client);

  Future<List<CalendarEvent>> getEvents(int month, int year) async {
    final res = await _client.dio.get(
      '/calendar',
      queryParameters: {'month': month, 'year': year},
    );
    final data = res.data['data'] as Map<String, dynamic>? ?? res.data as Map<String, dynamic>;
    final list = data['events'] as List<dynamic>? ?? [];
    return list
        .map((j) => CalendarEvent.fromJson(j as Map<String, dynamic>))
        .toList();
  }
}
