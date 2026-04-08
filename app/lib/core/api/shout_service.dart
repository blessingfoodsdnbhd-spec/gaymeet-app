import '../models/shout.dart';
import 'api_client.dart';

class ShoutService {
  final ApiClient _client;
  ShoutService(this._client);

  Future<List<ShoutModel>> getNearbyShouts({double radiusKm = 50}) async {
    final res = await _client.dio.get(
      '/shouts',
      queryParameters: {'radius': radiusKm},
    );
    final List data = res.data is List ? res.data : res.data['data'] ?? [];
    return data.map((j) => ShoutModel.fromJson(j)).toList();
  }

  Future<ShoutModel?> getMyShout() async {
    try {
      final res = await _client.dio.get('/shouts/mine');
      if (res.data == null) return null;
      return ShoutModel.fromJson(res.data);
    } catch (_) {
      return null;
    }
  }

  Future<ShoutModel> postShout(String content) async {
    final res = await _client.dio.post('/shouts', data: {'content': content});
    return ShoutModel.fromJson(res.data);
  }

  Future<void> deleteShout() async {
    await _client.dio.delete('/shouts');
  }
}
