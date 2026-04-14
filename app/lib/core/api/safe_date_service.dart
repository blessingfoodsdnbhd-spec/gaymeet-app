import '../models/safe_date.dart';
import 'api_client.dart';

class SafeDateService {
  final ApiClient _client;
  SafeDateService(this._client);

  Future<SafeDate> start({
    required List<String> trustedContactIds,
    required String meetingWith,
    required String venue,
    DateTime? expectedEndTime,
  }) async {
    final res = await _client.dio.post('/safe-date/start', data: {
      'trustedContactIds': trustedContactIds,
      'meetingWith': meetingWith,
      'venue': venue,
      if (expectedEndTime != null)
        'expectedEndTime': expectedEndTime.toIso8601String(),
    });
    return SafeDate.fromJson(
        (res.data['data'] ?? res.data) as Map<String, dynamic>);
  }

  Future<SafeDate> updateLocation(double lat, double lng) async {
    final res = await _client.dio.post(
      '/safe-date/update-location',
      data: {'lat': lat, 'lng': lng},
    );
    return SafeDate.fromJson(
        (res.data['data'] ?? res.data) as Map<String, dynamic>);
  }

  Future<Map<String, dynamic>> panic({double? lat, double? lng}) async {
    final res = await _client.dio.post('/safe-date/panic', data: {
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
    });
    return (res.data['data'] ?? res.data) as Map<String, dynamic>;
  }

  Future<SafeDate> end() async {
    final res = await _client.dio.post('/safe-date/end');
    return SafeDate.fromJson(
        (res.data['data'] ?? res.data) as Map<String, dynamic>);
  }

  Future<SafeDate?> getActive() async {
    final res = await _client.dio.get('/safe-date/active');
    final data = res.data['data'] ?? res.data;
    if (data == null) return null;
    return SafeDate.fromJson(data as Map<String, dynamic>);
  }

  Future<List<SafeDate>> getAlerts() async {
    final res = await _client.dio.get('/safe-date/alerts');
    final list = (res.data['data'] ?? res.data) as List;
    return list
        .map((j) => SafeDate.fromJson(j as Map<String, dynamic>))
        .toList();
  }
}
