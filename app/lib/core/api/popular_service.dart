import '../models/user.dart';
import 'api_client.dart';

class PopularService {
  final ApiClient _client;
  PopularService(this._client);

  Future<List<Map<String, dynamic>>> getPopular(String countryCode) async {
    final res = await _client.dio.get(
      '/popular',
      queryParameters: {'countryCode': countryCode},
    );
    final List data = res.data is List ? res.data : res.data['data'] ?? [];
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> useTicket(String countryCode) async {
    final res = await _client.dio.post(
      '/popular/ticket/use',
      data: {'countryCode': countryCode},
    );
    return res.data;
  }

  Future<Map<String, dynamic>> purchaseTicket() async {
    final res = await _client.dio.post('/popular/ticket/purchase');
    return res.data;
  }
}
