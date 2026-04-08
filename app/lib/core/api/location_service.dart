import 'api_client.dart';

class LocationService {
  final ApiClient _client;
  LocationService(this._client);

  Future<void> setVirtualLocation(
    double lat,
    double lng, {
    String? label,
  }) async {
    await _client.dio.post('/users/me/teleport', data: {
      'latitude': lat,
      'longitude': lng,
      if (label != null) 'label': label,
    });
  }

  Future<void> clearVirtualLocation() async {
    await _client.dio.delete('/users/me/teleport');
  }

  Future<void> setStealthMode(bool enabled) async {
    await _client.dio.patch('/users/me/stealth', data: {'enabled': enabled});
  }
}
